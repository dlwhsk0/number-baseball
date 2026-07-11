// 게임 상태 관리 — reducer는 순수 함수라 단위 테스트 가능하고,
// useGame 훅이 난수(정답 생성)를 감싸 React에 연결한다.
import { useReducer } from 'react';
import { DIGITS, generateSecret, judge, isWin, type Judgement } from './logic';

export type GameStatus = 'playing' | 'won' | 'lost';

/** 메모판에서 각 숫자에 매기는 표시. 없으면 기본(무표시). */
export type MemoMark = 'out' | 'in';

export interface GuessRecord {
  guess: string;
  judgement: Judgement;
}

export interface GameState {
  secret: string;
  input: string;
  guesses: GuessRecord[];
  status: GameStatus;
  maxAttempts: number;
  /** 숫자별 메모 표시. 키가 없으면 기본 상태. 라운드마다 초기화된다. */
  memo: Record<string, MemoMark>;
}

export type GameAction =
  | { type: 'push'; digit: string }
  | { type: 'pop' }
  | { type: 'submit' }
  | { type: 'memo'; digit: string }
  | { type: 'reset'; secret: string; maxAttempts: number };

export function initGame(secret: string, maxAttempts: number): GameState {
  return { secret, input: '', guesses: [], status: 'playing', maxAttempts, memo: {} };
}

/** 메모 표시 순환: 기본 → 아웃(✗) → 있음(○) → 기본. */
function nextMark(cur: MemoMark | undefined): MemoMark | undefined {
  if (cur === undefined) return 'out';
  if (cur === 'out') return 'in';
  return undefined;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'push': {
      if (state.status !== 'playing') return state;
      if (state.input.length >= DIGITS) return state;
      if (state.input.includes(action.digit)) return state; // 중복 금지
      if (state.input.length === 0 && action.digit === '0') return state; // 맨 앞 0 금지
      return { ...state, input: state.input + action.digit };
    }
    case 'pop': {
      if (state.status !== 'playing') return state;
      return { ...state, input: state.input.slice(0, -1) };
    }
    case 'submit': {
      if (state.status !== 'playing') return state;
      if (state.input.length !== DIGITS) return state;
      const judgement = judge(state.secret, state.input);
      const guesses = [...state.guesses, { guess: state.input, judgement }];
      let status: GameStatus = 'playing';
      if (isWin(judgement)) status = 'won';
      else if (guesses.length >= state.maxAttempts) status = 'lost';
      return { ...state, guesses, input: '', status };
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
    submit: () => dispatch({ type: 'submit' }),
    cycleMemo: (digit: string) => dispatch({ type: 'memo', digit }),
    reset: () => dispatch({ type: 'reset', secret: generateSecret(), maxAttempts }),
  };
}
