// 클라이언트↔서버 이벤트 계약(온라인 대결 — 턴제 duel + 스피드 speed).
// 프론트 net 레이어(src/net/protocol.ts)에서도 이 형태를 동일하게 유지한다.
import type { Judgement } from './logic.js';

export interface GuessRecord {
  guess: string;
  judgement: Judgement;
}

/** 게임 종류. */
export type Mode = 'duel' | 'speed';

/** 턴제 결과: 무승부 / 0=선공 승 / 1=후공 승. */
export type Outcome = 'draw' | 0 | 1;

/** 스피드 종료 후 공개할 플레이어별 추측 기록. */
export interface SpeedHistoryEntry {
  index: number;
  nick: string;
  history: GuessRecord[];
}

/** 스피드 리더보드 한 줄. */
export interface SpeedStanding {
  index: number;
  nick: string;
  attempts: number;
  solved: boolean;
  /** 맞힌 경우 시작~맞힘 경과(ms), 아니면 null. */
  solveMs: number | null;
  connected: boolean;
  /** 응원 구단 id(없으면 null). */
  team: string | null;
  /** 합산 순위 점수(횟수 + 시간/포인트, 낮을수록 상위). 미해결이면 null. */
  score: number | null;
}

export interface CreateAck {
  ok: true;
  code: string;
  index: 0;
  digits: number;
  mode: Mode;
  /** 재접속(rejoin) 인증용 토큰. */
  token: string;
}
export interface JoinAck {
  ok: boolean;
  error?: string;
  code?: string;
  /** 내 자리(턴제=1, 스피드=0~3). */
  index?: number;
  digits?: number;
  mode?: Mode;
  /** 턴제: 방장 닉네임. */
  opponentNick?: string;
  /** 턴제: 방장 응원 구단. */
  opponentTeam?: string | null;
  /** 스피드: 현재 방의 전체 인원 명단. */
  players?: { index: number; nick: string; team: string | null }[];
  token?: string;
}
export interface OkAck {
  ok: boolean;
  error?: string;
  /** guess 성공 시 서버 판정(추측한 본인에게만). */
  judgement?: Judgement;
}
/** 코드로 방의 종류만 미리 조회(입장 전, 부수효과 없음). */
export interface PeekAck {
  ok: boolean;
  error?: string;
  mode?: Mode;
  digits?: number;
}

/** 재접속 복원 — 턴제. */
export interface DuelResume {
  mode: 'duel';
  phase: 'lobby' | 'secret' | 'playing' | 'over';
  digits: number;
  turn: 0 | 1;
  secretReady: boolean[];
  mySecretSet: boolean;
  oppAttempts: number;
  oppSolved: boolean;
  oppHistory: GuessRecord[];
  opponentNick: string;
  opponentTeam: string | null;
  opponentConnected: boolean;
  over?: { outcome: Outcome; secrets: (string | null)[]; attempts: number[] };
}
/** 재접속 복원 — 스피드. */
export interface SpeedResume {
  mode: 'speed';
  phase: 'lobby' | 'playing' | 'over';
  digits: number;
  /** 레이스 시작 시각(ms epoch). 0이면 아직 로비. */
  startAt: number;
  /** 한 판 제한시간(ms). */
  limitMs: number;
  myHistory: GuessRecord[];
  standings: SpeedStanding[];
  over?: { standings: SpeedStanding[]; secret: string; histories: SpeedHistoryEntry[] };
}
export type ResumeInfo = DuelResume | SpeedResume;
export interface RejoinAck {
  ok: boolean;
  error?: string;
  resume?: ResumeInfo;
}

// ---------- 팬 랭킹(KBO 구단) ----------
/** 방·랭킹전에 함께 보내는 팬 신원(익명 기기 id + 응원 구단). */
export interface FanIdentity {
  playerId?: string;
  team?: string;
}
/** 구단별 솔로 랭킹전 누적. */
export interface TeamSoloRow {
  team: string;
  points: number;
  games: number;
  wins: number;
  /** 맞힌 판의 평균 시도(없으면 null). */
  avgAttempts: number | null;
  /** 참여한 팬 수. */
  fans: number;
}
/** 개인 솔로 누적 순위 한 줄. */
export interface PlayerRow {
  /** 평균 점수 순위(동순위). 배치고사 중(games < PLACEMENT_GAMES)이면 null. */
  rank: number | null;
  nick: string;
  team: string;
  /** 누적 점수. */
  points: number;
  games: number;
  /** 한 판 평균 점수(소수 둘째 자리, 실패 0점 포함) — 개인 순위 기준. */
  avg: number;
  /** 바로 위 순위의 평균(내 행에만 — 1위·배치 중이면 null). '다음 순위까지 +x점'. */
  aboveAvg?: number | null;
  /** 요청한 본인인지. */
  me: boolean;
  /** 서버 내부용(클라로는 안 보냄). */
  playerId?: string;
}
/** 구단 대결(멀티) 순위표 한 줄 — KBO 순위표 형식. */
export interface VersusRow {
  team: string;
  w: number;
  l: number;
  d: number;
  /** 승률(무 제외). */
  pct: number;
  /** 1위와의 게임차. */
  gb: number;
}
export interface Leaderboard {
  team: TeamSoloRow[];
  players: PlayerRow[];
  versus: VersusRow[];
  me: PlayerRow | null;
}
export interface LeaderboardAck {
  ok: boolean;
  error?: string;
  data?: Leaderboard;
}
export interface RankedStartAck {
  ok: boolean;
  error?: string;
  gameId?: string;
  digits?: number;
  maxAttempts?: number;
  /** 이어하기(같은 기기에서 진행 중이던 판)면 그동안의 기록. */
  guesses?: GuessRecord[];
}
/** 랭킹전 종료 시 결과(점수·누적·구단 순위). */
export interface RankedResult {
  points: number;
  /** DB 기록 성공 여부(실패해도 게임 결과는 유효). */
  recorded: boolean;
  /** 내 누적 점수(옛 클라 호환용). */
  total: number | null;
  /** 내 개인 순위(평균 기준, 배치고사 중이면 null). */
  rank: number | null;
  /** 내 한 판 평균 점수·판 수(배치 진행도). */
  avg?: number | null;
  games?: number | null;
  team: string;
  teamPoints: number;
  teamRank: number;
}
export interface RankedGuessAck {
  ok: boolean;
  error?: string;
  /** 판이 사라짐(서버 재시작·만료) — 새 판 필요. */
  expired?: boolean;
  judgement?: Judgement;
  status?: 'playing' | 'won' | 'lost';
  /** 종료 시 정답 공개. */
  secret?: string;
  result?: RankedResult;
}

export interface ClientToServerEvents {
  create: (
    p: { nick: string; digits: number; mode?: Mode } & FanIdentity,
    ack: (r: CreateAck) => void,
  ) => void;
  join: (p: { nick: string; code: string } & FanIdentity, ack: (r: JoinAck) => void) => void;
  /** 솔로 랭킹전 시작(서버가 정답 보관·판정). 진행 중인 판이 있으면 이어하기, forfeit면 실패 처리 후 새 판. */
  rankedStart: (
    p: { playerId: string; nick: string; team: string; digits: number; forfeit?: boolean },
    ack: (r: RankedStartAck) => void,
  ) => void;
  rankedGuess: (p: { gameId: string; guess: string }, ack: (r: RankedGuessAck) => void) => void;
  /** 순위표 조회(구단 솔로·개인·구단 대결). */
  leaderboard: (p: { playerId?: string }, ack: (r: LeaderboardAck) => void) => void;
  /** 입장 전 방 종류만 조회(스피드/턴제 자동 판별용). */
  peek: (p: { code: string }, ack: (r: PeekAck) => void) => void;
  setSecret: (p: { secret: string }, ack: (r: OkAck) => void) => void;
  /** 스피드: 방장이 레이스 시작(공통 숫자 생성·전원 동시 시작). */
  startSpeed: (ack: (r: OkAck) => void) => void;
  /** 스피드: 종료 후 재대결(방을 로비로 리셋). */
  speedRematch: () => void;
  guess: (p: { guess: string }, ack: (r: OkAck) => void) => void;
  /** 추측 입력 중간 상태(실시간 미리보기용, 턴제 전용). */
  input: (p: { value: string }) => void;
  rematch: () => void;
  /** 의도적으로 방을 떠남(백그라운드 이탈과 구분). */
  leave: (ack: () => void) => void;
  /** 재접속: 저장한 방 코드·자리·토큰으로 다시 합류. */
  rejoin: (
    p: { code: string; index: number; token: string },
    ack: (r: RejoinAck) => void,
  ) => void;
}

export interface ServerToClientEvents {
  // --- 턴제(duel) ---
  opponentJoined: (p: { nick: string; team: string | null }) => void;
  phase: (p: { phase: 'secret'; digits: number }) => void;
  secretProgress: (p: { ready: boolean[] }) => void;
  start: (p: { turn: 0 | 1; digits: number }) => void;
  reveal: (p: {
    by: 0 | 1;
    guess: string;
    judgement: Judgement;
    solved: boolean;
    attempts: number;
  }) => void;
  turn: (p: { turn: 0 | 1 }) => void;
  opponentInput: (p: { value: string }) => void;
  over: (p: { outcome: Outcome; secrets: (string | null)[]; attempts: number[] }) => void;
  rematchRequested: () => void;

  // --- 스피드(speed) ---
  /** 로비 인원 명단 갱신(입장·이탈 시). */
  speedRoster: (p: {
    players: { index: number; nick: string; connected: boolean; team: string | null }[];
  }) => void;
  /** 레이스 시작 — 전원 동시. */
  /** introMs: 매치업 연출 길이 — startAt은 이미 그만큼 미래(연출 뒤 레이스 시작). */
  speedStart: (p: { startAt: number; digits: number; limitMs: number; introMs?: number }) => void;
  /** 리더보드 라이브 갱신(누가 몇 번, 맞혔는지). */
  speedProgress: (p: { standings: SpeedStanding[] }) => void;
  /** 전원 맞힘 → 종료·순위. */
  speedOver: (p: {
    standings: SpeedStanding[];
    secret: string;
    histories: SpeedHistoryEntry[];
  }) => void;
  /** 재대결 — 방을 로비로 리셋. 전원 로비로 복귀. */
  speedReset: (p: {
    players: { index: number; nick: string; connected: boolean; team: string | null }[];
  }) => void;

  // --- 공통 ---
  opponentDisconnected: () => void;
  opponentReconnected: () => void;
  opponentLeft: () => void;
  errorMsg: (p: { message: string }) => void;
}

export interface SocketData {
  code?: string;
  index?: number;
}
