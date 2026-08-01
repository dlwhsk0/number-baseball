// 클라이언트↔서버 이벤트 계약. server/src/types.ts와 동일하게 유지한다.
import type { Judgement } from '../game/logic';

export type Outcome = 'draw' | 0 | 1;

export interface CreateAck {
  ok: true;
  code: string;
  index: 0;
  digits: number;
  token: string;
}
export interface JoinAck {
  ok: boolean;
  error?: string;
  code?: string;
  index?: 1;
  digits?: number;
  opponentNick?: string;
  token?: string;
}
export interface OkAck {
  ok: boolean;
  error?: string;
  judgement?: Judgement;
}

export interface ResumeInfo {
  phase: 'lobby' | 'secret' | 'playing' | 'over';
  digits: number;
  turn: 0 | 1;
  secretReady: boolean[];
  mySecretSet: boolean;
  oppAttempts: number;
  oppSolved: boolean;
  oppHistory: { guess: string; judgement: Judgement }[];
  opponentNick: string;
  opponentConnected: boolean;
  over?: { outcome: Outcome; secrets: (string | null)[]; attempts: number[] };
}
export interface RejoinAck {
  ok: boolean;
  error?: string;
  resume?: ResumeInfo;
}

export interface ClientToServerEvents {
  create: (p: { nick: string; digits: number }, ack: (r: CreateAck) => void) => void;
  join: (p: { nick: string; code: string }, ack: (r: JoinAck) => void) => void;
  setSecret: (p: { secret: string }, ack: (r: OkAck) => void) => void;
  guess: (p: { guess: string }, ack: (r: OkAck) => void) => void;
  input: (p: { value: string }) => void;
  rematch: () => void;
  /** 의도적으로 방을 떠남(백그라운드 이탈과 구분). 서버가 상대에게 즉시 알리고 방을 정리. */
  leave: (ack: () => void) => void;
  rejoin: (p: { code: string; index: 0 | 1; token: string }, ack: (r: RejoinAck) => void) => void;
}

export interface ServerToClientEvents {
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
  opponentDisconnected: () => void;
  opponentReconnected: () => void;
  opponentLeft: () => void;
  errorMsg: (p: { message: string }) => void;
}
