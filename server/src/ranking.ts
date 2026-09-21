// 팬 랭킹 점수 규칙(순수 함수). 프론트 src/game/ranking.ts와 동일하게 유지(함께 수정).

/** 솔로 랭킹전 시도 상한(고정 — 설정의 시도 횟수와 무관). */
export const RANKED_MAX_ATTEMPTS = 15;

/**
 * 솔로 랭킹전 점수: 적게 시도할수록 높다. 1회=15점 … 15회=1점, 실패 0점. 4자리는 2배.
 */
export function soloPoints(attempts: number, won: boolean, digits: number): number {
  if (!won || attempts < 1 || attempts > RANKED_MAX_ATTEMPTS) return 0;
  return (RANKED_MAX_ATTEMPTS + 1 - attempts) * (digits >= 4 ? 2 : 1);
}

/**
 * 개인 순위는 **한 판 평균 점수**(실패=0점 포함). 판 수로 밀어붙이는 누적 합계 대신 실력이 드러나게.
 * 이 판 수를 채우기 전(배치고사)엔 순위에 안 오른다 — 한두 판 운 좋은 15점이 1위가 되지 않게.
 */
export const PLACEMENT_GAMES = 10;

/** 평균 점수 등급(높은 것부터). 3자리 평균 7번 만에 맞히면 9점=주전, 4자리는 점수 2배라 MVP가 현실적. */
export const TIERS = [
  { id: 'mvp', name: 'MVP', min: 12 },
  { id: 'allstar', name: '올스타', min: 10 },
  { id: 'starter', name: '주전', min: 8 },
  { id: 'prospect', name: '유망주', min: 6 },
  { id: 'rookie', name: '루키', min: 0 },
] as const;
export type Tier = (typeof TIERS)[number];

export function tierOf(avg: number): Tier {
  return TIERS.find((t) => avg >= t.min) ?? TIERS[TIERS.length - 1];
}

/** 대결 기록에 참여하는 한 사람(순위 순서대로 넘긴다 — 앞이 상위). */
export interface RankedEntrant {
  playerId: string | null;
  team: string | null;
  /** 맞혔는지(스피드). 둘 다 못 맞힌 쌍은 무승부. */
  solved: boolean;
}

export interface MatchRow {
  teamW: string;
  teamL: string;
  draw: boolean;
  playerW: string | null;
  playerL: string | null;
}

/**
 * 스피드 최종 순위(상위→하위)를 구단 대결 기록으로 쪼갠다.
 * 구단이 다른 모든 쌍: 상위=승·하위=패, 둘 다 미해결이면 무승부.
 * 구단 없음·같은 구단·같은 사람(playerId) 쌍은 제외.
 */
export function pairMatches(ordered: RankedEntrant[]): MatchRow[] {
  const rows: MatchRow[] = [];
  for (let i = 0; i < ordered.length; i++) {
    for (let j = i + 1; j < ordered.length; j++) {
      const a = ordered[i];
      const b = ordered[j];
      if (!a.team || !b.team || a.team === b.team) continue;
      if (a.playerId && a.playerId === b.playerId) continue;
      rows.push({
        teamW: a.team,
        teamL: b.team,
        draw: !a.solved && !b.solved,
        playerW: a.playerId,
        playerL: b.playerId,
      });
    }
  }
  return rows;
}

/** 승률(무승부 제외). 경기 없으면 0. */
export function winPct(w: number, l: number): number {
  return w + l === 0 ? 0 : w / (w + l);
}

/** 게임차 — 1위 대비. */
export function gamesBehind(leader: { w: number; l: number }, t: { w: number; l: number }): number {
  return (leader.w - t.w + (t.l - leader.l)) / 2;
}

/**
 * 동률 순위(1, 1, 3…) — KBO 순위표처럼 기준값이 같으면 같은 순위, 다음 순위는 그만큼 건너뛴다.
 * rows는 기준값 내림차순으로 이미 정렬돼 있어야 한다.
 */
export function tieRanks<T>(rows: readonly T[], key: (row: T) => number): number[] {
  const ranks: number[] = [];
  rows.forEach((row, i) => {
    ranks.push(i > 0 && key(rows[i - 1]) === key(row) ? ranks[i - 1] : i + 1);
  });
  return ranks;
}
