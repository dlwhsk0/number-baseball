// 팬 랭킹 저장소(Postgres). DATABASE_URL이 없으면 랭킹 기능만 꺼지고 대전은 그대로 동작한다.
// 기록 실패는 게임 진행을 막지 않는다(로그 + rank_write_errors 메트릭).
import pg from 'pg';
import { logger } from './logger.js';
import { rankWriteErrors } from './metrics.js';
import { TEAMS } from './teams.js';
import { winPct, gamesBehind, type MatchRow } from './ranking.js';
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

// ---------- 쓰기 ----------
async function upsertPlayer(c: pg.PoolClient | pg.Pool, id: string, nick: string, team: string) {
  await c.query(
    `INSERT INTO players (id, nick, team) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET nick = EXCLUDED.nick, team = EXCLUDED.team, updated_at = now()`,
    [id, nick, team],
  );
}

/**
 * 닉네임·구단만 갱신(랭킹전 시작 때). 기록은 판이 끝나야 남기 때문에, 이게 없으면
 * 닉네임을 바꿔도 순위표에는 '다음 판을 끝낼 때까지' 옛 이름이 뜬다.
 * 실제로 바뀐 게 있을 때만 캐시를 버린다(시작마다 무효화하면 30초 캐시가 무의미).
 */
export async function touchPlayer(playerId: string, nick: string, team: string): Promise<void> {
  if (!pool) return;
  try {
    const r = await pool.query(
      `INSERT INTO players (id, nick, team) VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET nick = EXCLUDED.nick, team = EXCLUDED.team, updated_at = now()
       WHERE players.nick IS DISTINCT FROM EXCLUDED.nick OR players.team IS DISTINCT FROM EXCLUDED.team`,
      [playerId, nick, team],
    );
    if (r.rowCount) invalidate();
  } catch (err) {
    rankWriteErrors.inc({ kind: 'player' });
    logger.error({ err }, 'player 갱신 실패');
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
    await upsertPlayer(pool, r.playerId, r.nick, r.team);
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
    await client.query('BEGIN');
    for (const p of players) await upsertPlayer(client, p.id, p.nick, p.team);
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
    const r = await pool!.query<{ id: string; nick: string; team: string; points: string; games: string }>(
      `SELECT s.player_id AS id, p.nick, p.team, SUM(s.points) AS points, COUNT(*) AS games
       FROM solo_games s JOIN players p ON p.id = s.player_id
       GROUP BY s.player_id, p.nick, p.team
       ORDER BY points DESC, games ASC LIMIT 50`,
    );
    return r.rows.map((row, i) => ({
      rank: i + 1,
      nick: row.nick,
      team: row.team,
      points: Number(row.points),
      games: Number(row.games),
      me: false,
      playerId: row.id,
    }));
  });
}

/** 내 개인 누적 점수·순위(없으면 null). 캐시 안 함(방금 판 결과가 바로 보이게). */
export async function myRank(playerId: string): Promise<PlayerRow | null> {
  if (!pool) return null;
  const r = await pool.query<{ nick: string; team: string; points: string; games: string; rank: string }>(
    `WITH t AS (SELECT player_id, SUM(points) AS pts, COUNT(*) AS games FROM solo_games GROUP BY player_id)
     SELECT p.nick, p.team, t.pts AS points, t.games,
            (SELECT COUNT(*) + 1 FROM t t2 WHERE t2.pts > t.pts) AS rank
     FROM t JOIN players p ON p.id = t.player_id WHERE t.player_id = $1`,
    [playerId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    rank: Number(row.rank),
    nick: row.nick,
    team: row.team,
    points: Number(row.points),
    games: Number(row.games),
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
