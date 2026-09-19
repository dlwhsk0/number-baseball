import type { CSSProperties } from 'react';
import { teamById } from '../game/teams';

/** 구단 칩(구단색 배경 + 짧은 이름). 구단이 없으면 아무것도 안 그림. */
export function TeamChip({ team, full = false }: { team: string | null | undefined; full?: boolean }) {
  const t = teamById(team);
  if (!t) return null;
  return (
    <span className="team-chip" style={{ '--team': t.color } as CSSProperties} title={t.name}>
      {full ? t.name : t.short}
    </span>
  );
}
