// 팬 랭킹 저장소(Postgres). DATABASE_URL이 없으면 랭킹 기능만 꺼지고 대전은 그대로 동작한다.
// 기록 실패는 게임 진행을 막지 않는다(로그 + rank_write_errors 메트릭).
import pg from 'pg';
import { randomInt } from 'node:crypto';
import { logger } from './logger.js';
import { rankWriteErrors } from './metrics.js';
import { TEAMS } from './teams.js';
import { cleanNick, randomNick, NICK_MAX } from './nickname.js';
import { winPct, gamesBehind, tieRanks, PLACEMENT_GAMES, type MatchRow } from './ranking.js';
import type { TeamSoloRow, PlayerRow, VersusRow, Leaderboard } from './types.js';

let pool: pg.Pool | null = null;

export function dbEnabled(): boolean {
  return pool !== null;
}

const MIGRATION = `
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY,
  nick text NOT NULL,
  team text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS solo_games (
  id bigserial PRIMARY KEY,
  player_id uuid NOT NULL,
  team text NOT NULL,
  digits smallint NOT NULL,
  attempts smallint NOT NULL,
  won boolean NOT NULL,
  points integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS solo_games_team_idx ON solo_games (team);
CREATE INDEX IF NOT EXISTS solo_games_player_idx ON solo_games (player_id, created_at);
CREATE TABLE IF NOT EXISTS match_results (
  id bigserial PRIMARY KEY,
  mode text NOT NULL,
  team_w text NOT NULL,
  team_l text NOT NULL,
  draw boolean NOT NULL,
  player_w uuid,
  player_l uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS match_results_created_idx ON match_results (created_at);
CREATE TABLE IF NOT EXISTS transfer_codes (
  code text PRIMARY KEY,
  player_id uuid NOT NULL,
  expires_at timestamptz NOT NULL
);
`;

export async function initDb(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    logger.warn('DATABASE_URL 없음 — 팬 랭킹 비활성(대전은 정상 동작)');
    return;
  }
  const p = new pg.Pool({ connectionString: url, max: 5 });
  p.on('error', (err) => logger.error({ err }, 'postgres pool error'));
  try {
    await p.query(MIGRATION);
    await migrateNicks(p);
    pool = p;
    logger.info('postgres 연결 + 마이그레이션 완료 — 팬 랭킹 활성');
  } catch (err) {
    logger.error({ err }, 'postgres 초기화 실패 — 팬 랭킹 비활성');
    await p.end().catch(() => {});
  }
}

// ---------- 캐시(순위표는 30초, 기록이 들어오면 즉시 무효화) ----------
const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; value: unknown }>();
/** 무효화 세대 — 조회 도중 기록이 들어오면 그 조회 결과(기록 전 값)는 캐시에 안 넣는다. */
let generation = 0;
async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value as T;
  const gen = generation;
  const value = await load();
  if (gen === generation) cache.set(key, { at: Date.now(), value });
  return value;
}
function invalidate(): void {
  generation++;
  cache.clear();
}

// ---------- 닉네임(유일) ----------
type Db = pg.PoolClient | pg.Pool;

/** 대소문자 무시 유일 인덱스 — 같은 닉네임이 둘이면 순위표에서 누가 누군지 모른다. */
const NICK_INDEX = 'players_nick_uniq';

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === '23505';
}

async function currentNick(c: Db, id: string): Promise<string | null> {
  const r = await c.query<{ nick: string }>('SELECT nick FROM players WHERE id = $1', [id]);
  return r.rows[0]?.nick ?? null;
}

/** 다른 플레이어가 이미 쓰는 닉네임인지(대소문자 무시). */
async function nickTaken(c: Db, nick: string, id: string | null): Promise<boolean> {
  const r = await c.query(
    'SELECT 1 FROM players WHERE lower(nick) = lower($1) AND ($2::uuid IS NULL OR id <> $2) LIMIT 1',
    [nick, id],
  );
  return (r.rowCount ?? 0) > 0;
}

/** 아무도 안 쓰는 랜덤 닉네임(두 자리 숫자가 계속 겹치면 네 자리로). */
async function freshNick(c: Db, team: string | null): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const n = randomNick(team, i >= 8);
    if (!(await nickTaken(c, n, null))) return n;
  }
  throw new Error('랜덤 닉네임 생성 실패');
}

/** 닉네임·구단 저장. 실제로 바뀐 행이 있으면 true(순위 캐시 무효화 판단용). */
async function writePlayer(c: Db, id: string, nick: string, team: string): Promise<boolean> {
  const r = await c.query(
    `INSERT INTO players (id, nick, team) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET nick = EXCLUDED.nick, team = EXCLUDED.team, updated_at = now()
     WHERE players.nick IS DISTINCT FROM EXCLUDED.nick OR players.team IS DISTINCT FROM EXCLUDED.team`,
    [id, nick, team],
  );
  return (r.rowCount ?? 0) > 0;
}

/**
 * 게임 중 들어온 닉네임을 반영하고 실제로 쓰인 닉네임을 돌려준다(명시적 변경은 claimNick).
 * - 비었으면(옛 기본값 '플레이어' 포함) 원래 닉네임 유지, 처음이면 랜덤 닉네임.
 * - 다른 사람이 쓰는 닉네임이면 무시하고 원래 닉네임 유지 — 확인 없이 바꾸는 경로(멀티 메뉴·옛 클라)라도 중복이 안 생기게.
 */
async function savePlayer(c: Db, id: string, requested: string, team: string): Promise<{ nick: string; changed: boolean }> {
  const cur = await currentNick(c, id);
  const want = cleanNick(requested);
  const sameAsMine = !!want && !!cur && want.toLowerCase() === cur.toLowerCase();
  let nick = want && (sameAsMine || !(await nickTaken(c, want, id))) ? want : (cur ?? (await freshNick(c, team)));
  try {
    return { nick, changed: await writePlayer(c, id, nick, team) };
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // 확인과 저장 사이에 누가 먼저 가져감 → 원래 닉네임(없으면 새 랜덤)으로 한 번 더.
    nick = cur ?? (await freshNick(c, team));
    return { nick, changed: await writePlayer(c, id, nick, team) };
  }
}

export type ClaimNickResult = { ok: true; nick: string } | { ok: false; taken?: boolean; error: string };

/** 닉네임 변경(중복 확인). 비워 보내면 원래 닉네임 유지, 처음이면 랜덤 닉네임을 받아 간다. */
export async function claimNick(playerId: string, requested: string, team: string): Promise<ClaimNickResult> {
  if (!pool) return { ok: false, error: '지금은 닉네임을 확인할 수 없어요.' };
  const want = cleanNick(requested);
  const taken = { ok: false as const, taken: true, error: '이미 누가 쓰고 있는 닉네임이에요.' };
  try {
    if (want && (await nickTaken(pool, want, playerId))) return taken;
    const r = await savePlayer(pool, playerId, want, team);
    if (want && r.nick !== want) return taken; // 확인 직후 선점당함
    if (r.changed) invalidate();
    return { ok: true, nick: r.nick };
  } catch (err) {
    if (isUniqueViolation(err)) return taken;
    rankWriteErrors.inc({ kind: 'player' });
    logger.error({ err }, 'nick 변경 실패');
    return { ok: false, error: '닉네임을 저장하지 못했어요.' };
  }
}

/**
 * 시작 시 1회: 유일 인덱스가 아직 없으면 기존 데이터부터 정리하고 만든다.
 * - '플레이어'(옛 기본값)·빈 닉네임 → 랜덤 닉네임
 * - 겹치는 닉네임 → 판을 많이 한 사람이 원래 이름을 갖고, 나머지는 뒤에 숫자(곰돌이 → 곰돌이2)
 * 무중단 배포 때 두 컨테이너가 겹쳐 떠도 한 번만 돌게 advisory lock.
 */
async function migrateNicks(p: pg.Pool): Promise<void> {
  const c = await p.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT pg_advisory_xact_lock(hashtext('nb_nick_migration'))");
    const exists = await c.query<{ r: string | null }>('SELECT to_regclass($1) AS r', [NICK_INDEX]);
    if (exists.rows[0]?.r) {
      await c.query('COMMIT');
      return;
    }
    const rows = await c.query<{ id: string; nick: string; team: string }>(
      `SELECT p.id, p.nick, p.team FROM players p
       LEFT JOIN (SELECT player_id, COUNT(*) AS n FROM solo_games GROUP BY player_id) g ON g.player_id = p.id
       ORDER BY COALESCE(g.n, 0) DESC, p.updated_at ASC`,
    );
    const seen = new Set<string>();
    // 원래 이름 전부 예약 — 뒤에 숫자를 붙인 이름이 아직 순회 안 한 다른 사람의 원래 이름(곰돌이2)을 뺏지 않게.
    const originals = new Set(rows.rows.map((r) => cleanNick(r.nick).toLowerCase()).filter(Boolean));
    const used = (x: string) => seen.has(x.toLowerCase());
    const reserved = (x: string) => used(x) || originals.has(x.toLowerCase());
    let renamed = 0;
    for (const row of rows.rows) {
      const n = cleanNick(row.nick);
      let next = n;
      if (!n) {
        for (let i = 0; !next || reserved(next); i++) next = randomNick(row.team, i >= 8);
      } else if (used(n)) {
        for (let k = 2; reserved(next); k++) {
          next = `${n.slice(0, NICK_MAX - String(k).length)}${k}`;
        }
      }
      seen.add(next.toLowerCase());
      if (next !== row.nick) {
        await c.query('UPDATE players SET nick = $2, updated_at = now() WHERE id = $1', [row.id, next]);
        renamed++;
      }
    }
    await c.query(`CREATE UNIQUE INDEX ${NICK_INDEX} ON players (lower(nick))`);
    await c.query('COMMIT');
    logger.info({ players: rows.rowCount, renamed }, '닉네임 정리 + 유일 인덱스 생성');
  } catch (err) {
    await c.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    c.release();
  }
}

// ---------- 기기 옮기기 ----------
/** 코드 글자 — 헷갈리는 0/O·1/I/L은 뺀다. */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TRANSFER_CODE_LEN = 6;
const TRANSFER_TTL_MIN = 10;

function makeCode(): string {
  let out = '';
  for (let i = 0; i < TRANSFER_CODE_LEN; i++) out += CODE_CHARS[randomInt(CODE_CHARS.length)];
  return out;
}

export type TransferCreateResult = { ok: true; code: string; expiresAt: number } | { ok: false; error: string };

/** 옛 기기: 기록을 옮길 코드 발급(10분·1회용). 이전에 받은 코드는 무효. */
export async function createTransferCode(playerId: string): Promise<TransferCreateResult> {
  if (!pool) return { ok: false, error: '지금은 기기 옮기기를 할 수 없어요.' };
  if ((await currentNick(pool, playerId)) === null) {
    return { ok: false, error: '옮길 기록이 없어요. 응원 구단을 고르고 랭킹전을 해보세요.' };
  }
  await pool.query('DELETE FROM transfer_codes WHERE player_id = $1 OR expires_at < now()', [playerId]);
  for (let i = 0; i < 5; i++) {
    const code = makeCode();
    const r = await pool.query<{ expires_at: Date }>(
      `INSERT INTO transfer_codes (code, player_id, expires_at)
       VALUES ($1, $2, now() + make_interval(mins => $3))
       ON CONFLICT (code) DO NOTHING RETURNING expires_at`,
      [code, playerId, TRANSFER_TTL_MIN],
    );
    if (r.rows[0]) return { ok: true, code, expiresAt: r.rows[0].expires_at.getTime() };
  }
  return { ok: false, error: '코드를 만들지 못했어요. 다시 시도해주세요.' };
}

export type TransferRedeemResult =
  | { ok: true; playerId: string; nick: string; team: string }
  | { ok: false; invalid?: boolean; error: string };

/**
 * 새 기기: 코드를 입력하면 옛 기기의 id를 받아 간다. 이 기기 id로 쌓인 기록은 옛 id로 합치고 이 기기 id는 지운다
 * (한 사람 기록이 두 id로 갈라지지 않게). 코드는 한 번 쓰면 사라진다.
 */
export async function redeemTransferCode(code: string, fromId: string): Promise<TransferRedeemResult> {
  if (!pool) return { ok: false, error: '지금은 기기 옮기기를 할 수 없어요.' };
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query<{ player_id: string }>(
      'DELETE FROM transfer_codes WHERE code = $1 AND expires_at > now() RETURNING player_id',
      [code],
    );
    const target = r.rows[0]?.player_id;
    if (!target) {
      await client.query('ROLLBACK');
      return { ok: false, invalid: true, error: '코드가 틀렸거나 시간이 지났어요.' };
    }
    if (target !== fromId) {
      await client.query('UPDATE solo_games SET player_id = $2 WHERE player_id = $1', [fromId, target]);
      await client.query('UPDATE match_results SET player_w = $2 WHERE player_w = $1', [fromId, target]);
      await client.query('UPDATE match_results SET player_l = $2 WHERE player_l = $1', [fromId, target]);
      await client.query('DELETE FROM players WHERE id = $1', [fromId]);
    }
    const p = await client.query<{ nick: string; team: string }>('SELECT nick, team FROM players WHERE id = $1', [target]);
    await client.query('COMMIT');
    invalidate();
    const row = p.rows[0];
    if (!row) return { ok: false, error: '옮길 기록을 찾지 못했어요.' };
    return { ok: true, playerId: target, nick: row.nick, team: row.team };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    rankWriteErrors.inc({ kind: 'transfer' });
    logger.error({ err }, '기기 옮기기 실패');
    return { ok: false, error: '기록을 옮기지 못했어요. 다시 시도해주세요.' };
  } finally {
    client.release();
  }
}

// ---------- 쓰기 ----------
/**
 * 닉네임·구단 갱신(랭킹전 시작 때). 기록은 판이 끝나야 남기 때문에, 이게 없으면
 * 닉네임을 바꿔도 순위표에는 '다음 판을 끝낼 때까지' 옛 이름이 뜬다.
 * 실제로 바뀐 게 있을 때만 캐시를 버린다(시작마다 무효화하면 30초 캐시가 무의미).
 * 실제로 쓰인 닉네임을 돌려준다(클라 동기화용, 실패하면 null).
 */
export async function touchPlayer(playerId: string, nick: string, team: string): Promise<string | null> {
  if (!pool) return null;
  try {
    const r = await savePlayer(pool, playerId, nick, team);
    if (r.changed) invalidate();
    return r.nick;
  } catch (err) {
    rankWriteErrors.inc({ kind: 'player' });
    logger.error({ err }, 'player 갱신 실패');
    return null;
  }
}

export interface SoloRecord {
  playerId: string;
  nick: string;
  team: string;
  digits: number;
  attempts: number;
  won: boolean;
  points: number;
}

export async function recordSolo(r: SoloRecord): Promise<boolean> {
  if (!pool) return false;
  try {
    await savePlayer(pool, r.playerId, r.nick, r.team);
    await pool.query(
      `INSERT INTO solo_games (player_id, team, digits, attempts, won, points)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [r.playerId, r.team, r.digits, r.attempts, r.won, r.points],
    );
    invalidate();
    return true;
  } catch (err) {
    rankWriteErrors.inc({ kind: 'solo' });
    logger.error({ err }, 'solo 기록 실패');
    return false;
  }
}

export async function recordMatches(
  mode: string,
  rows: MatchRow[],
  players: { id: string; nick: string; team: string }[],
): Promise<void> {
  if (!pool || rows.length === 0) return;
  // 한 판의 쌍들은 한 트랜잭션으로 — 중간 실패로 일부 쌍만 남아 승패가 비대칭으로 쌓이지 않게.
  const client = await pool.connect().catch((err) => {
    rankWriteErrors.inc({ kind: 'match' });
    logger.error({ err }, 'match 기록 실패(연결)');
    return null;
  });
  if (!client) return;
  try {
    // 닉네임은 트랜잭션 밖에서 — 중복 충돌(23505)이 나면 트랜잭션 전체가 깨지므로. 승패 기록과 원자적일 필요는 없다.
    for (const p of players) await savePlayer(client, p.id, p.nick, p.team);
    await client.query('BEGIN');
    for (const r of rows) {
      await client.query(
        `INSERT INTO match_results (mode, team_w, team_l, draw, player_w, player_l)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [mode, r.teamW, r.teamL, r.draw, r.playerW, r.playerL],
      );
    }
    await client.query('COMMIT');
    invalidate();
    logger.info({ mode, rows: rows.length }, 'team match 기록');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    rankWriteErrors.inc({ kind: 'match' });
    logger.error({ err }, 'match 기록 실패');
  } finally {
    client.release();
  }
}

/** 최근 24시간 랭킹전 판 수(남용 방지 상한용). DB 없으면 0. */
export async function soloCountLastDay(playerId: string): Promise<number> {
  if (!pool) return 0;
  const r = await pool.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM solo_games WHERE player_id = $1 AND created_at > now() - interval '1 day'`,
    [playerId],
  );
  return Number(r.rows[0]?.n ?? 0);
}

// ---------- 읽기(순위표) ----------
export async function teamSolo(): Promise<TeamSoloRow[]> {
  return cached('team', async () => {
    const r = await pool!.query<{
      team: string;
      points: string;
      games: string;
      wins: string;
      avg_attempts: string | null;
      fans: string;
    }>(
      `SELECT team, SUM(points) AS points, COUNT(*) AS games, SUM(won::int) AS wins,
              AVG(attempts) FILTER (WHERE won) AS avg_attempts, COUNT(DISTINCT player_id) AS fans
       FROM solo_games GROUP BY team`,
    );
    const by = new Map(r.rows.map((row) => [row.team, row]));
    return TEAMS.map((t) => {
      const row = by.get(t.id);
      return {
        team: t.id,
        points: Number(row?.points ?? 0),
        games: Number(row?.games ?? 0),
        wins: Number(row?.wins ?? 0),
        avgAttempts: row?.avg_attempts != null ? Number(Number(row.avg_attempts).toFixed(2)) : null,
        fans: Number(row?.fans ?? 0),
      };
    }).sort((a, b) => b.points - a.points || b.games - a.games);
  });
}

export async function topPlayers(): Promise<PlayerRow[]> {
  return cached('player', async () => {
    // 개인 순위 = 한 판 평균 점수(배치 PLACEMENT_GAMES판 이상만). 평균은 소수 둘째 자리로 반올림해
    // 비교한다 — myRank와 같은 값으로 순위를 매겨야 목록과 '내 순위'가 어긋나지 않는다.
    const r = await pool!.query<{
      id: string;
      nick: string;
      team: string;
      points: string;
      games: string;
      avg: string;
    }>(
      `SELECT s.player_id AS id, p.nick, p.team, SUM(s.points) AS points, COUNT(*) AS games,
              ROUND(AVG(s.points)::numeric, 2) AS avg
       FROM solo_games s JOIN players p ON p.id = s.player_id
       GROUP BY s.player_id, p.nick, p.team
       HAVING COUNT(*) >= $1
       ORDER BY avg DESC, games DESC LIMIT 50`,
      [PLACEMENT_GAMES],
    );
    // 평균이 같으면 같은 순위(1, 1, 3…).
    const ranks = tieRanks(r.rows, (row) => Number(row.avg));
    return r.rows.map((row, i) => ({
      rank: ranks[i],
      nick: row.nick,
      team: row.team,
      points: Number(row.points),
      games: Number(row.games),
      avg: Number(row.avg),
      me: false,
      playerId: row.id,
    }));
  });
}

/** 내 개인 기록·순위(판이 없으면 null). 캐시 안 함(방금 판 결과가 바로 보이게). 배치고사 중이면 rank=null. */
export async function myRank(playerId: string): Promise<PlayerRow | null> {
  if (!pool) return null;
  const r = await pool.query<{
    nick: string;
    team: string;
    points: string;
    games: string;
    avg: string;
    rank: string;
    above_avg: string | null;
  }>(
    `WITH t AS (SELECT player_id, SUM(points) AS pts, COUNT(*) AS games,
                       ROUND(AVG(points)::numeric, 2) AS avg
                FROM solo_games GROUP BY player_id),
          q AS (SELECT avg FROM t WHERE games >= $2)
     SELECT p.nick, p.team, t.pts AS points, t.games, t.avg,
            (SELECT COUNT(*) + 1 FROM q WHERE q.avg > t.avg) AS rank,
            (SELECT MIN(q.avg) FROM q WHERE q.avg > t.avg) AS above_avg
     FROM t JOIN players p ON p.id = t.player_id WHERE t.player_id = $1`,
    [playerId, PLACEMENT_GAMES],
  );
  const row = r.rows[0];
  if (!row) return null;
  const placed = Number(row.games) >= PLACEMENT_GAMES;
  return {
    rank: placed ? Number(row.rank) : null,
    nick: row.nick,
    team: row.team,
    points: Number(row.points),
    games: Number(row.games),
    avg: Number(row.avg),
    aboveAvg: placed && row.above_avg != null ? Number(row.above_avg) : null,
    me: true,
  };
}

export async function teamVersus(): Promise<VersusRow[]> {
  return cached('versus', async () => {
    const r = await pool!.query<{ team: string; w: string; l: string; d: string }>(
      `SELECT team, SUM(w) AS w, SUM(l) AS l, SUM(d) AS d FROM (
         SELECT team_w AS team, (NOT draw)::int AS w, 0 AS l, draw::int AS d FROM match_results
         UNION ALL
         SELECT team_l AS team, 0 AS w, (NOT draw)::int AS l, draw::int AS d FROM match_results
       ) x GROUP BY team`,
    );
    const by = new Map(r.rows.map((row) => [row.team, row]));
    const rows = TEAMS.map((t) => {
      const row = by.get(t.id);
      const w = Number(row?.w ?? 0);
      const l = Number(row?.l ?? 0);
      const d = Number(row?.d ?? 0);
      return { team: t.id, w, l, d, pct: winPct(w, l), gb: 0 };
    }).sort((a, b) => b.pct - a.pct || b.w - a.w || a.l - b.l);
    const leader = rows[0];
    for (const row of rows) row.gb = leader ? gamesBehind(leader, row) : 0;
    return rows;
  });
}

export async function leaderboard(playerId: string | null): Promise<Leaderboard | null> {
  if (!pool) return null;
  const [team, players, versus, me] = await Promise.all([
    teamSolo(),
    topPlayers(),
    teamVersus(),
    playerId ? myRank(playerId) : Promise.resolve(null),
  ]);
  return {
    team,
    // playerId는 내부 식별용 — 남의 id는 내보내지 않는다.
    players: players.map(({ playerId: id, ...row }) => ({ ...row, me: !!playerId && id === playerId })),
    versus,
    me,
  };
}
