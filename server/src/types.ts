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

/** 스피드 리더보드 한 줄. */
export interface SpeedStanding {
  index: number;
  nick: string;
  attempts: number;
  solved: boolean;
  /** 맞힌 경우 시작~맞힘 경과(ms), 아니면 null. */
  solveMs: number | null;
  connected: boolean;
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
  /** 스피드: 현재 방의 전체 인원 명단. */
  players?: { index: number; nick: string }[];
  token?: string;
}
export interface OkAck {
  ok: boolean;
  error?: string;
  /** guess 성공 시 서버 판정(추측한 본인에게만). */
  judgement?: Judgement;
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
  myHistory: GuessRecord[];
  standings: SpeedStanding[];
  over?: { standings: SpeedStanding[]; secret: string };
}
export type ResumeInfo = DuelResume | SpeedResume;
export interface RejoinAck {
  ok: boolean;
  error?: string;
  resume?: ResumeInfo;
}

export interface ClientToServerEvents {
  create: (
    p: { nick: string; digits: number; mode?: Mode },
    ack: (r: CreateAck) => void,
  ) => void;
  join: (p: { nick: string; code: string }, ack: (r: JoinAck) => void) => void;
  setSecret: (p: { secret: string }, ack: (r: OkAck) => void) => void;
  /** 스피드: 방장이 레이스 시작(공통 숫자 생성·전원 동시 시작). */
  startSpeed: (ack: (r: OkAck) => void) => void;
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
  opponentJoined: (p: { nick: string }) => void;
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
    players: { index: number; nick: string; connected: boolean }[];
  }) => void;
  /** 레이스 시작 — 전원 동시. */
  speedStart: (p: { startAt: number; digits: number }) => void;
  /** 리더보드 라이브 갱신(누가 몇 번, 맞혔는지). */
  speedProgress: (p: { standings: SpeedStanding[] }) => void;
  /** 전원 맞힘 → 종료·순위. */
  speedOver: (p: { standings: SpeedStanding[]; secret: string }) => void;

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
