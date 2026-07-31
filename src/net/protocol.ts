// 클라이언트↔서버 이벤트 계약. server/src/types.ts와 동일하게 유지한다.
import type { Judgement } from '../game/logic';

export type Outcome = 'draw' | 0 | 1;

export interface CreateAck {
  ok: true;
  code: string;
  index: 0;
  digits: number;
}
export interface JoinAck {
  ok: boolean;
  error?: string;
  code?: string;
  index?: 1;
  digits?: number;
  opponentNick?: string;
}
export interface OkAck {
  ok: boolean;
  error?: string;
  judgement?: Judgement;
}

export interface ClientToServerEvents {
  create: (p: { nick: string; digits: number }, ack: (r: CreateAck) => void) => void;
  join: (p: { nick: string; code: string }, ack: (r: JoinAck) => void) => void;
  setSecret: (p: { secret: string }, ack: (r: OkAck) => void) => void;
  guess: (p: { guess: string }, ack: (r: OkAck) => void) => void;
  rematch: () => void;
}

export interface ServerToClientEvents {
  opponentJoined: (p: { nick: string }) => void;
  phase: (p: { phase: 'secret'; digits: number }) => void;
  secretProgress: (p: { ready: boolean[] }) => void;
  start: (p: { turn: 0 | 1; digits: number }) => void;
  opponentGuessed: (p: { attempts: number; solved: boolean }) => void;
  turn: (p: { turn: 0 | 1 }) => void;
  over: (p: { outcome: Outcome; secrets: (string | null)[]; attempts: number[] }) => void;
  opponentLeft: () => void;
  errorMsg: (p: { message: string }) => void;
}
