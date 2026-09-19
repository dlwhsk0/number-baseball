// 솔로 랭킹전 — 정답을 서버만 쥐고 판정한다(클라 조작 방지). 진행 중인 판은 메모리(플레이어당 1판).
// 끝나면(맞힘/10회 소진/포기) Postgres에 기록. 서버 재시작 시 진행 중인 판은 사라진다(방과 같은 한계).
import { randomBytes } from 'node:crypto';
import { generateSecret, isValidGuess, judge, isWin } from './logic.js';
import { RANKED_MAX_ATTEMPTS, soloPoints } from './ranking.js';
import { isTeamId } from './teams.js';
import { recordSolo, soloCountLastDay, teamSolo, myRank, dbEnabled } from './db.js';
import { rankedGames } from './metrics.js';
import type { GuessRecord, RankedStartAck, RankedGuessAck, RankedResult } from './types.js';

/** 하루(24시간) 랭킹전 판 수 상한 — 판 수로 밀어붙이는 파밍 방지. */
const DAILY_LIMIT = Number(process.env.RANKED_DAILY_LIMIT) || 30;
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
function forfeit(g: RankedGame): void {
  if (g.guesses.length === 0) {
    drop(g);
    return;
  }
  void finish(g, false);
}

// 방치된 판 정리.
setInterval(() => {
  const now = Date.now();
  for (const g of byId.values()) if (now - g.lastAt > TTL_MS) forfeit(g);
}, 60 * 1000).unref();

export async function rankedStart(p: {
  playerId: unknown;
  nick: string;
  team: unknown;
  digits: unknown;
  forfeit?: unknown;
}): Promise<RankedStartAck> {
  if (!dbEnabled()) return { ok: false, error: '지금은 랭킹전을 할 수 없어요.' };
  if (!isPlayerId(p.playerId)) return { ok: false, error: '플레이어 정보가 올바르지 않아요.' };
  if (!isTeamId(p.team)) return { ok: false, error: '응원 구단을 골라주세요.' };
  const playerId = p.playerId;
  const digits = p.digits === 4 ? 4 : 3;

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
    forfeit(cur);
  }

  if ((await soloCountLastDay(playerId)) >= DAILY_LIMIT) {
    return { ok: false, error: `랭킹전은 하루 ${DAILY_LIMIT}판까지예요. 내일 또 만나요!` };
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
