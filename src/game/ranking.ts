// 팬 랭킹 점수 규칙(순수 함수). 서버 server/src/ranking.ts와 동일하게 유지(함께 수정).

/** 솔로 랭킹전 시도 상한(고정 — 설정의 시도 횟수와 무관). */
export const RANKED_MAX_ATTEMPTS = 20;

/**
 * 솔로 랭킹전 점수: 적게 시도할수록 높다. 1회=20점 … 20회=1점, 실패 0점. 4자리는 2배.
 */
export function soloPoints(attempts: number, won: boolean, digits: number): number {
  if (!won || attempts < 1 || attempts > RANKED_MAX_ATTEMPTS) return 0;
  return (RANKED_MAX_ATTEMPTS + 1 - attempts) * (digits >= 4 ? 2 : 1);
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
