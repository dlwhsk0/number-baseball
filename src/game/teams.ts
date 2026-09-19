// KBO 10개 구단 — 팬 랭킹(구단 선택·순위표)용. 서버 server/src/teams.ts와 동일하게 유지(함께 수정).
export interface Team {
  id: string;
  /** 정식 이름(예: 두산 베어스). */
  name: string;
  /** 짧은 이름(칩·순위표). */
  short: string;
  /** 대표색(순위 막대·선택 강조). */
  color: string;
  /** 구단 엠블럼(프론트 public/teams/, 각 구단 공식 홈페이지에서 받은 이미지). */
  logo: string;
  /** 다크 화면용 선명한 구단 포인트색(테마 액센트·VS 카드 발광). color가 너무 어두운 구단 대비. */
  accent: string;
  /** 솔로 랭킹전 중 적용할 테마(data-theme) — index.css. */
  theme: string;
}

export const TEAMS: Team[] = [
  { id: 'kia', name: 'KIA 타이거즈', short: 'KIA', color: '#EA0029', logo: '/teams/kia.png', accent: '#EA0029', theme: 'team-kia' },
  { id: 'samsung', name: '삼성 라이온즈', short: '삼성', color: '#074CA1', logo: '/teams/samsung.png', accent: '#1F7AE0', theme: 'team-samsung' },
  { id: 'lg', name: 'LG 트윈스', short: 'LG', color: '#C30452', logo: '/teams/lg.png', accent: '#E0114A', theme: 'lgtwins' },
  { id: 'doosan', name: '두산 베어스', short: '두산', color: '#1A1748', logo: '/teams/doosan.png', accent: '#E83A45', theme: 'doosan' },
  { id: 'kt', name: 'KT 위즈', short: 'KT', color: '#231F20', logo: '/teams/kt.png', accent: '#F2303A', theme: 'team-kt' },
  { id: 'ssg', name: 'SSG 랜더스', short: 'SSG', color: '#CE0E2D', logo: '/teams/ssg.png', accent: '#FF3348', theme: 'team-ssg' },
  { id: 'lotte', name: '롯데 자이언츠', short: '롯데', color: '#041E42', logo: '/teams/lotte.png', accent: '#E1263A', theme: 'team-lotte' },
  { id: 'hanwha', name: '한화 이글스', short: '한화', color: '#FC4E00', logo: '/teams/hanwha.png', accent: '#FF6A13', theme: 'team-hanwha' },
  { id: 'nc', name: 'NC 다이노스', short: 'NC', color: '#315288', logo: '/teams/nc.png', accent: '#D1AE6E', theme: 'team-nc' },
  { id: 'kiwoom', name: '키움 히어로즈', short: '키움', color: '#820024', logo: '/teams/kiwoom.png', accent: '#E0336E', theme: 'team-kiwoom' },
];

export const TEAM_IDS: string[] = TEAMS.map((t) => t.id);

export function isTeamId(v: unknown): v is string {
  return typeof v === 'string' && TEAM_IDS.includes(v);
}

export function teamById(id: string | null | undefined): Team | undefined {
  return TEAMS.find((t) => t.id === id);
}
