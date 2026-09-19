// KBO 10개 구단 — 팬 랭킹(구단 선택·순위표)용. 프론트 src/game/teams.ts와 동일하게 유지(함께 수정).
export interface Team {
  id: string;
  /** 정식 이름(예: 두산 베어스). */
  name: string;
  /** 짧은 이름(칩·순위표). */
  short: string;
  /** 대표색(칩 배경·막대). */
  color: string;
}

export const TEAMS: Team[] = [
  { id: 'kia', name: 'KIA 타이거즈', short: 'KIA', color: '#EA0029' },
  { id: 'samsung', name: '삼성 라이온즈', short: '삼성', color: '#074CA1' },
  { id: 'lg', name: 'LG 트윈스', short: 'LG', color: '#C30452' },
  { id: 'doosan', name: '두산 베어스', short: '두산', color: '#1A1748' },
  { id: 'kt', name: 'KT 위즈', short: 'KT', color: '#231F20' },
  { id: 'ssg', name: 'SSG 랜더스', short: 'SSG', color: '#CE0E2D' },
  { id: 'lotte', name: '롯데 자이언츠', short: '롯데', color: '#041E42' },
  { id: 'hanwha', name: '한화 이글스', short: '한화', color: '#FC4E00' },
  { id: 'nc', name: 'NC 다이노스', short: 'NC', color: '#315288' },
  { id: 'kiwoom', name: '키움 히어로즈', short: '키움', color: '#820024' },
];

export const TEAM_IDS: string[] = TEAMS.map((t) => t.id);

export function isTeamId(v: unknown): v is string {
  return typeof v === 'string' && TEAM_IDS.includes(v);
}

export function teamById(id: string | null | undefined): Team | undefined {
  return TEAMS.find((t) => t.id === id);
}
