import { teamById } from '../game/teams';

/** 구단 엠블럼(공식 로고). withName이면 옆에 구단명. 구단이 없으면 아무것도 안 그림. */
export function TeamChip({
  team,
  withName = false,
}: {
  team: string | null | undefined;
  withName?: boolean;
}) {
  const t = teamById(team);
  if (!t) return null;
  return (
    <span className={`team-chip${withName ? ' with-name' : ''}`} title={t.name}>
      <img className="team-logo" src={t.logo} alt={withName ? '' : t.name} draggable={false} />
      {withName && <span className="team-chip-name">{t.name}</span>}
    </span>
  );
}
