// 클라이언트↔서버 이벤트 계약(온라인 턴제 대결). 프론트 net 레이어에서도 이 형태를 맞춘다.
import type { Judgement } from './logic.js';

export interface GuessRecord {
  guess: string;
  judgement: Judgement;
}

/** 결과: 무승부 / 0=선공 승 / 1=후공 승. */
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
  /** guess 성공 시 서버 판정(추측한 본인에게만). */
  judgement?: Judgement;
}

export interface ClientToServerEvents {
  create: (p: { nick: string; digits: number }, ack: (r: CreateAck) => void) => void;
  join: (p: { nick: string; code: string }, ack: (r: JoinAck) => void) => void;
  setSecret: (p: { secret: string }, ack: (r: OkAck) => void) => void;
  guess: (p: { guess: string }, ack: (r: OkAck) => void) => void;
  /** 추측 입력 중간 상태(실시간 미리보기용). 내 차례에만 상대에게 중계된다. */
  input: (p: { value: string }) => void;
  rematch: () => void;
}

export interface ServerToClientEvents {
  opponentJoined: (p: { nick: string }) => void;
  /** 둘 다 입장 → 비밀 숫자 정하기 단계로. */
  phase: (p: { phase: 'secret'; digits: number }) => void;
  secretProgress: (p: { ready: boolean[] }) => void;
  /** 둘 다 비밀 설정 완료 → 플레이 시작. */
  start: (p: { turn: 0 | 1; digits: number }) => void;
  /** 추측 결과 발표(양쪽에 잠깐 표시). by=추측한 사람, 이후 delay 뒤 turn/over가 온다. */
  reveal: (p: {
    by: 0 | 1;
    guess: string;
    judgement: Judgement;
    solved: boolean;
    attempts: number;
  }) => void;
  turn: (p: { turn: 0 | 1 }) => void;
  /** 상대의 실시간 추측 입력 상태(부분 문자열). */
  opponentInput: (p: { value: string }) => void;
  over: (p: { outcome: Outcome; secrets: (string | null)[]; attempts: number[] }) => void;
  /** 상대가 재대결을 신청함(내가 수락하면 시작). */
  rematchRequested: () => void;
  opponentLeft: () => void;
  errorMsg: (p: { message: string }) => void;
}

export interface SocketData {
  code?: string;
  index?: 0 | 1;
}
