// 클라이언트↔서버 이벤트 계약. server/src/types.ts와 동일하게 유지한다.
import type { Judgement } from '../game/logic';

export interface GuessRecord {
  guess: string;
  judgement: Judgement;
}

export type Mode = 'duel' | 'speed';
export type Outcome = 'draw' | 0 | 1;

export interface SpeedHistoryEntry {
  index: number;
  nick: string;
  history: GuessRecord[];
}
export interface SpeedStanding {
  index: number;
  nick: string;
  attempts: number;
  solved: boolean;
  solveMs: number | null;
  connected: boolean;
}

export interface CreateAck {
  ok: true;
  code: string;
  index: 0;
  digits: number;
  mode: Mode;
  token: string;
}
export interface JoinAck {
  ok: boolean;
  error?: string;
  code?: string;
  index?: number;
  digits?: number;
  mode?: Mode;
  opponentNick?: string;
  players?: { index: number; nick: string }[];
  token?: string;
}
export interface OkAck {
  ok: boolean;
  error?: string;
  judgement?: Judgement;
}
export interface PeekAck {
  ok: boolean;
  error?: string;
  mode?: Mode;
  digits?: number;
}

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
export interface SpeedResume {
  mode: 'speed';
  phase: 'lobby' | 'playing' | 'over';
  digits: number;
  startAt: number;
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

export interface ClientToServerEvents {
  create: (p: { nick: string; digits: number; mode?: Mode }, ack: (r: CreateAck) => void) => void;
  join: (p: { nick: string; code: string }, ack: (r: JoinAck) => void) => void;
  peek: (p: { code: string }, ack: (r: PeekAck) => void) => void;
  setSecret: (p: { secret: string }, ack: (r: OkAck) => void) => void;
  startSpeed: (ack: (r: OkAck) => void) => void;
  guess: (p: { guess: string }, ack: (r: OkAck) => void) => void;
  input: (p: { value: string }) => void;
  rematch: () => void;
  /** 의도적으로 방을 떠남(백그라운드 이탈과 구분). */
  leave: (ack: () => void) => void;
  rejoin: (
    p: { code: string; index: number; token: string },
    ack: (r: RejoinAck) => void,
  ) => void;
}

export interface ServerToClientEvents {
  // 턴제
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
  // 스피드
  speedRoster: (p: {
    players: { index: number; nick: string; connected: boolean }[];
  }) => void;
  speedStart: (p: { startAt: number; digits: number; limitMs: number }) => void;
  speedProgress: (p: { standings: SpeedStanding[] }) => void;
  speedOver: (p: { standings: SpeedStanding[]; secret: string; histories: SpeedHistoryEntry[] }) => void;
  // 공통
  opponentDisconnected: () => void;
  opponentReconnected: () => void;
  opponentLeft: () => void;
  errorMsg: (p: { message: string }) => void;
}
