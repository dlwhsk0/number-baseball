// 게임 상태 관리 — reducer는 순수 함수라 단위 테스트 가능하고,
// useGame 훅이 난수(정답 생성)를 감싸 React에 연결한다.
import { useReducer } from 'react';
import { DIGITS, generateSecret, judge, isWin, type Judgement } from './logic';

export type GameStatus = 'playing' | 'won' | 'lost';

/** 키패드 메모 표시. 판정과 대응: ○스트라이크 · △볼 · ✗아웃. 없으면 무표시. */
export type MemoMark = 'strike' | 'ball' | 'out';

export interface GuessRecord {
  guess: string;
  judgement: Judgement;
}

export interface GameState {
  secret: string;
  /** 입력 칸. 길이 DIGITS, 빈 칸은 ''. 칸마다 독립적으로 지울 수 있다. */
  slots: string[];
  guesses: GuessRecord[];
  status: GameStatus;
  maxAttempts: number;
  /** 숫자별 메모 표시. 키가 없으면 기본 상태. 라운드마다 초기화된다. */
  memo: Record<string, MemoMark>;
}

export type GameAction =
  | { type: 'push'; digit: string }
  | { type: 'pop' }
  | { type: 'clearSlot'; index: number }
  | { type: 'submit' }
  | { type: 'memo'; digit: string }
  | { type: 'reset'; secret: string; maxAttempts: number };

function emptySlots(): string[] {
  return Array<string>(DIGITS).fill('');
}

/** 가장 왼쪽 빈 칸 index. 없으면 -1. */
function firstEmpty(slots: string[]): number {
  return slots.indexOf('');
}

/** 가장 오른쪽 채워진 칸 index. 없으면 -1. */
function lastFilled(slots: string[]): number {
  for (let i = slots.length - 1; i >= 0; i--) if (slots[i] !== '') return i;
  return -1;
}

export function initGame(secret: string, maxAttempts: number): GameState {
  return {
    secret,
    slots: emptySlots(),
    guesses: [],
    status: 'playing',
    maxAttempts,
    memo: {},
  };
}

/** 메모 표시 순환: 기본 → ○스트라이크 → △볼 → ✗아웃 → 기본. */
function nextMark(cur: MemoMark | undefined): MemoMark | undefined {
  if (cur === undefined) return 'strike';
  if (cur === 'strike') return 'ball';
  if (cur === 'ball') return 'out';
  return undefined;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'push': {
      if (state.status !== 'playing') return state;
      const target = firstEmpty(state.slots);
      if (target === -1) return state; // 다 참
      if (state.slots.includes(action.digit)) return state; // 중복 금지
      if (target === 0 && action.digit === '0') return state; // 맨 앞 0 금지
      const slots = [...state.slots];
      slots[target] = action.digit;
      return { ...state, slots };
    }
    case 'pop': {
      if (state.status !== 'playing') return state;
      const target = lastFilled(state.slots);
      if (target === -1) return state;
      const slots = [...state.slots];
      slots[target] = '';
      return { ...state, slots };
    }
    case 'clearSlot': {
      if (state.status !== 'playing') return state;
      if (state.slots[action.index] === '') return state;
      const slots = [...state.slots];
      slots[action.index] = '';
      return { ...state, slots };
    }
    case 'submit': {
      if (state.status !== 'playing') return state;
      if (state.slots.includes('')) return state; // 다 채워야 제출
      const guess = state.slots.join('');
      const judgement = judge(state.secret, guess);
      const guesses = [...state.guesses, { guess, judgement }];
      let status: GameStatus = 'playing';
      if (isWin(judgement)) status = 'won';
      else if (guesses.length >= state.maxAttempts) status = 'lost';
      return { ...state, guesses, slots: emptySlots(), status };
    }
    case 'memo': {
      if (state.status !== 'playing') return state;
      const memo = { ...state.memo };
      const mark = nextMark(memo[action.digit]);
      if (mark === undefined) delete memo[action.digit];
      else memo[action.digit] = mark;
      return { ...state, memo };
    }
    case 'reset':
      return initGame(action.secret, action.maxAttempts);
    default:
      return state;
  }
}

export function useGame(maxAttempts = 10) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    initGame(generateSecret(), maxAttempts),
  );

  return {
    state,
    pushDigit: (digit: string) => dispatch({ type: 'push', digit }),
    popDigit: () => dispatch({ type: 'pop' }),
    clearSlot: (index: number) => dispatch({ type: 'clearSlot', index }),
    submit: () => dispatch({ type: 'submit' }),
    cycleMemo: (digit: string) => dispatch({ type: 'memo', digit }),
    reset: () => dispatch({ type: 'reset', secret: generateSecret(), maxAttempts }),
  };
}
