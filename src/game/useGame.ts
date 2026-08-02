// 게임 상태 관리 — reducer는 순수 함수라 단위 테스트 가능하고,
// useGame 훅이 난수(정답 생성)를 감싸 React에 연결한다.
import { useReducer } from 'react';
import { DIGITS, generateSecret, judge, isWin, type Judgement } from './logic';

export type GameStatus = 'playing' | 'won' | 'lost';

/** 키패드 메모 표시. 판정과 대응: ○스트라이크 · △볼 · ✕아웃. 없으면 무표시. */
export type MemoMark = 'strike' | 'ball' | 'out';

export interface GuessRecord {
  guess: string;
  judgement: Judgement;
}

export interface GameState {
  secret: string;
  /** 자릿수(3 또는 4). */
  digits: number;
  /** 힌트(개인 기능, 자릿수 무관): 3아웃이면 그 숫자들을 자동으로 아웃 표시. */
  beginner: boolean;
  /** 입력 칸. 길이 digits, 빈 칸은 ''. 칸마다 독립적으로 지울 수 있다. */
  slots: string[];
  /** 고정된 칸(길게 눌러 고정). 제출해도 유지되고 탭으로 안 지워진다. */
  locked: boolean[];
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
  | { type: 'toggleLock'; index: number }
  | { type: 'submit' }
  | { type: 'memo'; digit: string; mark: MemoMark }
  | { type: 'clearMemo' }
  | { type: 'setBeginner'; beginner: boolean }
  | { type: 'reset'; secret: string; maxAttempts: number; digits?: number; beginner?: boolean };

function emptySlots(digits: number): string[] {
  return Array<string>(digits).fill('');
}

/** 가장 왼쪽 빈 칸 index. 없으면 -1. */
function firstEmpty(slots: string[]): number {
  return slots.indexOf('');
}

export function initGame(
  secret: string,
  maxAttempts: number,
  digits: number = DIGITS,
  beginner = false,
): GameState {
  return {
    secret,
    digits,
    beginner,
    slots: emptySlots(digits),
    locked: Array<boolean>(digits).fill(false),
    guesses: [],
    status: 'playing',
    maxAttempts,
    memo: {},
  };
}

/** 메모 표시 순환: 기본 → ○스트라이크 → △볼 → ✕아웃 → 기본. */
/** 메모 표시 선택기 순환: 없음(입력) → 아웃 → 볼 → 스트라이크 → 없음.
 *  allowOff=false면 메모 전용 화면용으로 '없음' 없이 아웃↔볼↔스트라이크만 돈다. */
export function cycleMemoMark(cur: MemoMark | null, allowOff = true): MemoMark | null {
  if (cur === null) return 'out';
  if (cur === 'out') return 'ball';
  if (cur === 'ball') return 'strike';
  return allowOff ? null : 'out';
}

/** 숫자에 선택된 표시를 토글: 같은 표시면 떼고, 아니면 그 표시로 붙인다. */
export function toggleMemoMark(
  memo: Record<string, MemoMark>,
  digit: string,
  mark: MemoMark,
): Record<string, MemoMark> {
  const next = { ...memo };
  if (next[digit] === mark) delete next[digit];
  else next[digit] = mark;
  return next;
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
      // 고정된 칸은 건너뛰고 마지막으로 채워진 칸을 지운다.
      let target = -1;
      for (let i = state.slots.length - 1; i >= 0; i--) {
        if (state.slots[i] !== '' && !state.locked[i]) {
          target = i;
          break;
        }
      }
      if (target === -1) return state;
      const slots = [...state.slots];
      slots[target] = '';
      return { ...state, slots };
    }
    case 'clearSlot': {
      if (state.status !== 'playing') return state;
      if (state.slots[action.index] === '') return state;
      if (state.locked[action.index]) return state; // 고정된 칸은 탭으로 안 지워짐
      const slots = [...state.slots];
      slots[action.index] = '';
      return { ...state, slots };
    }
    case 'toggleLock': {
      if (state.status !== 'playing') return state;
      // 빈 칸은 고정할 수 없다. 채워진 칸만 토글.
      if (state.slots[action.index] === '') return state;
      const locked = [...state.locked];
      locked[action.index] = !locked[action.index];
      return { ...state, locked };
    }
    case 'submit': {
      if (state.status !== 'playing') return state;
      if (state.slots.includes('')) return state; // 다 채워야 제출
      const guess = state.slots.join('');
      const judgement = judge(state.secret, guess);
      const guesses = [...state.guesses, { guess, judgement }];
      let status: GameStatus = 'playing';
      if (isWin(judgement, state.digits)) status = 'won';
      else if (guesses.length >= state.maxAttempts) status = 'lost';

      // 힌트(개인 기능). 자릿수 무관.
      let memo = state.memo;
      if (state.beginner) {
        if (judgement.isOut) {
          // 전부 아웃 → 그 숫자들은 무조건 정답에 '없음' → 아웃(✕) 표시.
          memo = { ...state.memo };
          for (const d of guess) memo[d] = 'out';
        } else if (judgement.strikes + judgement.balls === state.digits && status !== 'won') {
          // 0아웃(S+B=자릿수) → 그 숫자들은 무조건 정답에 '있음'(위치는 미정) → 볼(△) 표시.
          //   단, 이미 스트라이크로 확정한 건 그대로 둔다(더 구체적).
          memo = { ...state.memo };
          for (const d of guess) if (memo[d] !== 'strike') memo[d] = 'ball';
        }
      }

      // 고정된 칸은 다음 추측에도 유지, 나머지는 비운다.
      const nextSlots = state.slots.map((d, i) => (state.locked[i] ? d : ''));
      return { ...state, guesses, slots: nextSlots, status, memo };
    }
    case 'memo': {
      if (state.status !== 'playing') return state;
      return { ...state, memo: toggleMemoMark(state.memo, action.digit, action.mark) };
    }
    case 'clearMemo':
      return { ...state, memo: {} };
    case 'setBeginner':
      // 힌트 토글(라이브). 이후 제출부터 적용.
      return { ...state, beginner: action.beginner };
    case 'reset':
      return initGame(
        action.secret,
        action.maxAttempts,
        action.digits ?? DIGITS,
        action.beginner ?? false,
      );
    default:
      return state;
  }
}

export function useGame(initialDigits = 3, initialHint = false, maxAttempts = 10) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    initGame(generateSecret(initialDigits), maxAttempts, initialDigits, initialHint),
  );

  return {
    state,
    pushDigit: (digit: string) => dispatch({ type: 'push', digit }),
    popDigit: () => dispatch({ type: 'pop' }),
    clearSlot: (index: number) => dispatch({ type: 'clearSlot', index }),
    toggleLock: (index: number) => dispatch({ type: 'toggleLock', index }),
    submit: () => dispatch({ type: 'submit' }),
    toggleMemo: (digit: string, mark: MemoMark) => dispatch({ type: 'memo', digit, mark }),
    clearMemo: () => dispatch({ type: 'clearMemo' }),
    /** 힌트(개인 기능) 라이브 토글. */
    setHint: (hint: boolean) => dispatch({ type: 'setBeginner', beginner: hint }),
    /** 지정 자릿수·힌트로 새 게임. */
    reset: (digits: number, hint: boolean) => {
      dispatch({ type: 'reset', secret: generateSecret(digits), maxAttempts, digits, beginner: hint });
    },
  };
}
