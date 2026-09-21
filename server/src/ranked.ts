// 솔로 랭킹전 — 정답을 서버만 쥐고 판정한다(클라 조작 방지). 진행 중인 판은 메모리(플레이어당 1판).
// 끝나면(맞힘/15회 소진/포기) Postgres에 기록. 서버 재시작 시 진행 중인 판은 사라진다(방과 같은 한계).
import { randomBytes } from 'node:crypto';
import { generateSecret, isValidGuess, judge, isWin } from './logic.js';
import { RANKED_MAX_ATTEMPTS, soloPoints } from './ranking.js';
import { isTeamId } from './teams.js';
import { recordSolo, soloCountLastDay, teamSolo, myRank, dbEnabled, touchPlayer } from './db.js';
import { rankedGames } from './metrics.js';
import { logger } from './logger.js';
import type { GuessRecord, RankedStartAck, RankedGuessAck, RankedResult } from './types.js';

/** 하루(24시간) 랭킹전 판 수 상한 — 판 수로 밀어붙이는 파밍 방지. */
const DAILY_LIMIT = Number(process.env.RANKED_DAILY_LIMIT) || 30;
/**
 * IP당 24시간 새 판 상한(0이면 끔) — 계정이 없어 playerId(uuid)를 바꿔가며 자동으로 푸는 스크립트를 늦추는 보조 장치.
 * 랭킹 무결성 보장이 아니다. 통신사 NAT로 여러 명이 한 IP를 쓰므로 넉넉히, 메모리라 재시작 시 초기화.
 */
const IP_DAILY_LIMIT = Number(process.env.RANKED_IP_DAILY_LIMIT ?? 200);
const DAY_MS = 24 * 60 * 60 * 1000;
const startsByIp = new Map<string, number[]>();

/** 사설·루프백 주소면 실제 클라이언트 IP가 아니다(프록시 뒤 내부망) → 상한 적용 안 함. */
function isPublicIp(ip: string): boolean {
  const v = ip.replace(/^::ffff:/, '');
  return !(
    /^(10\.|127\.|192\.168\.|169\.254\.)/.test(v) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(v) ||
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(v) ||
    v === '::1' ||
    /^f[cd]/i.test(v)
  );
}

/** 이 IP로 새 판을 열 수 있는지(열 수 있으면 기록까지). */
function takeIpSlot(ip: string | null): boolean {
  if (!IP_DAILY_LIMIT || !ip || !isPublicIp(ip)) return true;
  const now = Date.now();
  const recent = (startsByIp.get(ip) ?? []).filter((t) => now - t < DAY_MS);
  if (recent.length >= IP_DAILY_LIMIT) {
    startsByIp.set(ip, recent);
    return false;
  }
  recent.push(now);
  startsByIp.set(ip, recent);
  return true;
}

/** 방치된 판 만료(추측이 있었으면 실패로 기록). */
const TTL_MS = 30 * 60 * 1000;
/** 추측 최소 간격(스크립트 연타 방지). */
const MIN_GUESS_GAP_MS = 250;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isPlayerId(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

interface RankedGame {
  id: string;
  playerId: string;
  nick: string;
  team: string;
  digits: number;
  secret: string;
  guesses: GuessRecord[];
  lastAt: number;
}

const byPlayer = new Map<string, RankedGame>();
const byId = new Map<string, RankedGame>();

function drop(g: RankedGame): void {
  byId.delete(g.id);
  if (byPlayer.get(g.playerId) === g) byPlayer.delete(g.playerId);
}

/** 판 종료 기록 + 결과(점수·누적·구단 순위). */
async function finish(g: RankedGame, won: boolean): Promise<RankedResult> {
  drop(g);
  const attempts = g.guesses.length;
  const points = soloPoints(attempts, won, g.digits);
  rankedGames.inc({ result: won ? 'won' : 'lost' });
  const recorded = await recordSolo({
    playerId: g.playerId,
    nick: g.nick,
    team: g.team,
    digits: g.digits,
    attempts,
    won,
    points,
  });
  let total: number | null = null;
  let rank: number | null = null;
  let teamPoints = 0;
  let teamRank = 0;
  if (dbEnabled()) {
    try {
      const [me, teams] = await Promise.all([myRank(g.playerId), teamSolo()]);
      total = me?.points ?? null;
      rank = me?.rank ?? null;
      const i = teams.findIndex((t) => t.team === g.team);
      teamPoints = teams[i]?.points ?? 0;
      teamRank = i + 1;
    } catch {
      /* 순위 조회 실패는 결과 표시만 생략 */
    }
  }
  return { points, recorded, total, rank, team: g.team, teamPoints, teamRank };
}

/** 추측이 있었던 판을 포기/방치하면 실패로 기록(나쁜 판만 버리고 다시 하는 체리피킹 방지). */
async function forfeit(g: RankedGame): Promise<void> {
  if (g.guesses.length === 0) {
    drop(g);
    return;
  }
  await finish(g, false);
}

// 방치된 판 정리(기록 완료를 기다릴 필요 없음).
setInterval(() => {
  const now = Date.now();
  for (const g of byId.values()) if (now - g.lastAt > TTL_MS) void forfeit(g);
  for (const [ip, ts] of startsByIp) {
    const recent = ts.filter((t) => now - t < DAY_MS);
    if (recent.length) startsByIp.set(ip, recent);
    else startsByIp.delete(ip);
  }
}, 60 * 1000).unref();

/**
 * 같은 플레이어의 시작 요청은 한 줄로 세운다 — 동시 요청이 한도 검사를 함께 통과하거나,
 * 포기 기록이 DB에 들어가기 전에 다음 판 한도를 세는 일을 막는다.
 */
const startLocks = new Map<string, Promise<unknown>>();
function serialize<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = startLocks.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => {});
  startLocks.set(key, tail);
  void tail.then(() => {
    if (startLocks.get(key) === tail) startLocks.delete(key);
  });
  return run;
}

export function rankedStart(p: {
  playerId: unknown;
  nick: string;
  team: unknown;
  digits: unknown;
  forfeit?: unknown;
  /** 접속 IP(Traefik이 붙인 X-Forwarded-For 맨 오른쪽). */
  ip: string | null;
}): Promise<RankedStartAck> {
  if (!isPlayerId(p.playerId)) {
    return Promise.resolve({ ok: false, error: '플레이어 정보가 올바르지 않아요.' });
  }
  return serialize(p.playerId, () => startLocked(p));
}

async function startLocked(p: {
  playerId: unknown;
  nick: string;
  team: unknown;
  digits: unknown;
  forfeit?: unknown;
  ip: string | null;
}): Promise<RankedStartAck> {
  if (!dbEnabled()) return { ok: false, error: '지금은 랭킹전을 할 수 없어요.' };
  if (!isPlayerId(p.playerId)) return { ok: false, error: '플레이어 정보가 올바르지 않아요.' };
  if (!isTeamId(p.team)) return { ok: false, error: '응원 구단을 골라주세요.' };
  const playerId = p.playerId;
  const digits = p.digits === 4 ? 4 : 3;
  // 닉네임·구단은 판을 시작할 때마다 갱신 — 바꾼 이름이 다음 판을 기다리지 않고 순위표에 뜨게.
  // 판정과 무관하니 기다리지 않는다(시작 지연 X).
  void touchPlayer(playerId, p.nick, p.team);

  const cur = byPlayer.get(playerId);
  if (cur) {
    // 같은 자릿수면 이어하기(새로고침·재접속 — 구단을 바꿨어도 이 판은 시작한 구단으로 기록).
    // 아니면(자릿수 변경·새 게임) 포기 처리.
    if (!p.forfeit && cur.digits === digits) {
      cur.nick = p.nick;
      cur.lastAt = Date.now();
      return {
        ok: true,
        gameId: cur.id,
        digits,
        maxAttempts: RANKED_MAX_ATTEMPTS,
        guesses: cur.guesses,
      };
    }
    await forfeit(cur);
  }

  if ((await soloCountLastDay(playerId)) >= DAILY_LIMIT) {
    return { ok: false, error: `랭킹전은 하루 ${DAILY_LIMIT}판까지예요. 내일 또 만나요!` };
  }
  if (!takeIpSlot(p.ip)) {
    return { ok: false, error: '이 네트워크에서 오늘 랭킹전을 너무 많이 했어요. 내일 다시 도전해요!' };
  }

  const g: RankedGame = {
    id: randomBytes(12).toString('hex'),
    playerId,
    nick: p.nick,
    team: p.team,
    digits,
    secret: generateSecret(digits),
    guesses: [],
    lastAt: Date.now(),
  };
  byPlayer.set(playerId, g);
  byId.set(g.id, g);
  // IP 자체는 안 남기고, 프록시 뒤에서 실제 공인 IP가 보이는지만(IP 상한이 동작하는지 확인용).
  logger.info({ digits, ipPublic: !!p.ip && isPublicIp(p.ip) }, 'ranked start');
  return { ok: true, gameId: g.id, digits, maxAttempts: RANKED_MAX_ATTEMPTS, guesses: [] };
}

export async function rankedGuess(p: { gameId: unknown; guess: unknown }): Promise<RankedGuessAck> {
  const g = typeof p.gameId === 'string' ? byId.get(p.gameId) : undefined;
  if (!g) return { ok: false, expired: true, error: '랭킹전 판이 끊겼어요. 새 판을 시작할게요.' };
  const guess = String(p.guess ?? '');
  if (!isValidGuess(guess, g.digits)) return { ok: false, error: '유효하지 않은 추측이에요.' };
  const now = Date.now();
  if (now - g.lastAt < MIN_GUESS_GAP_MS && g.guesses.length > 0) {
    return { ok: false, error: '천천히 던져주세요.' };
  }
  g.lastAt = now;
  const judgement = judge(g.secret, guess);
  g.guesses.push({ guess, judgement });
  const won = isWin(judgement, g.digits);
  if (!won && g.guesses.length < RANKED_MAX_ATTEMPTS) {
    return { ok: true, judgement, status: 'playing' };
  }
  const result = await finish(g, won);
  return { ok: true, judgement, status: won ? 'won' : 'lost', secret: g.secret, result };
}
