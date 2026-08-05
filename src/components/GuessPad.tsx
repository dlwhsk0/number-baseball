import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { gameReducer, initGame, toggleMemoMark, type MemoMark } from '../game/useGame';
import { Keypad } from './Keypad';
import { Seg7 } from './Seg7';

export interface GuessPadProps {
  digits: number;
  /** guess: 메모(O/B/S)·후보 메모·[던지기]. secret: 비밀 숫자 정하기(메모 없음)·[확인]. */
  variant?: 'guess' | 'secret';
  /** 내 차례 여부. false면 숫자 입력·제출은 막고 메모(마크·후보)만 가능(상대 차례). */
  active?: boolean;
  /** 게임 종료 등 완전 비활성(입력·메모 모두 off). */
  disabled?: boolean;
  /** 입력칸(세그먼트) 표시 여부. false면 메모 전용 키패드(비밀 정하기 대기 등). */
  showInput?: boolean;
  /** 제출 라벨(기본: guess='던지기', secret='확인'). */
  submitLabel?: string;
  /** 제출(꽉 찼을 때만 호출). 값은 입력 문자열. */
  onSubmit: (value: string) => void;
  /** 입력 변화 중계(실시간 미리보기용). active일 때만. */
  onChange?: (value: string) => void;
  /** 제출 후 입력칸을 비울지(기본 true). */
  clearOnSubmit?: boolean;
  /** 이 값이 바뀌면 입력칸을 강제로 비운다(외부 이벤트 후 리셋용). */
  resetSignal?: number;

  // ----- 메모(O/B/S). 미지정이면 내부 상태로 관리, 지정하면 controlled. guess 전용. -----
  memo?: Record<string, MemoMark>;
  onMemoToggle?: (digit: string, mark: MemoMark) => void;
  onMemoClear?: () => void;

  // ----- 자리별 후보 메모(길게 누르기). 미지정이면 내부 상태. guess 전용. -----
  notes?: string[][];
  onNoteToggle?: (pos: number, digit: string) => void;
  onNoteClear?: (pos: number) => void;

  // ----- 온라인 턴제 스테이지 스왑: active면 입력칸, 아니면 이 노드(결과/대기)를 같은 자리에. -----
  stageContent?: ReactNode;
  /** 루트 board에 덧붙일 클래스(예: online-board — 입력칸 프레임, batter-box — 솔로 타자석). */
  boardClass?: string;
  /** board 안에 겹쳐 그릴 노드(예: 솔로 결과 발표 카드). */
  overlay?: ReactNode;
}

const NUMS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/**
 * 정답 입력 세그먼트 + 키패드 + 메모(O/B/S) + 자리별 후보 메모를 하나로 묶은 공용 보드.
 * 판정은 하지 않는다(입력값만 구성해 onSubmit으로 넘김). 모든 모드(솔로·로컬·온라인)가 공유.
 */
export function GuessPad({
  digits,
  variant = 'guess',
  active = true,
  disabled = false,
  showInput = true,
  submitLabel,
  onSubmit,
  onChange,
  clearOnSubmit = true,
  resetSignal,
  memo: memoProp,
  onMemoToggle,
  onMemoClear,
  notes: notesProp,
  onNoteToggle,
  onNoteClear,
  stageContent,
  boardClass,
  overlay,
}: GuessPadProps) {
  const isGuess = variant === 'guess';
  // 입력칸(슬롯)은 gameReducer의 push/pop/clearSlot/reset만 사용(판정 없음, secret='').
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    initGame('', Infinity, digits, false),
  );
  const [memoMark, setMemoMark] = useState<MemoMark | null>(null);
  // 메모·후보는 controlled(prop 있음) 또는 내부 상태.
  const [memoInner, setMemoInner] = useState<Record<string, MemoMark>>({});
  const [notesInner, setNotesInner] = useState<string[][]>(() =>
    Array.from({ length: digits }, () => []),
  );
  const memo = memoProp ?? memoInner;
  const notes = notesProp ?? notesInner;
  const [editingPos, setEditingPos] = useState<number | null>(null);

  const full = !state.slots.includes('');

  // 자릿수 변경·리셋 신호 → 입력칸·후보·편집 상태 비움.
  useEffect(() => {
    dispatch({ type: 'reset', secret: '', maxAttempts: Infinity, digits, beginner: false });
    setEditingPos(null);
    if (!notesProp) setNotesInner(Array.from({ length: digits }, () => []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits, resetSignal]);

  // 입력 변화 중계(active일 때만). 콜백 identity 무관하게 최신값 사용.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (active) onChangeRef.current?.(state.slots.join(''));
  }, [state.slots, active]);

  const toggleMemo = (digit: string, mark: MemoMark) => {
    if (onMemoToggle) onMemoToggle(digit, mark);
    else setMemoInner((m) => toggleMemoMark(m, digit, mark));
  };
  const clearMemo = () => {
    if (onMemoClear) onMemoClear();
    else setMemoInner({});
  };
  const toggleNote = (pos: number, digit: string) => {
    if (onNoteToggle) onNoteToggle(pos, digit);
    else
      setNotesInner((n) =>
        n.map((arr, i) =>
          i !== pos ? arr : arr.includes(digit) ? arr.filter((d) => d !== digit) : [...arr, digit],
        ),
      );
  };
  const clearNote = (pos: number) => {
    if (onNoteClear) onNoteClear(pos);
    else setNotesInner((n) => n.map((arr, i) => (i === pos ? [] : arr)));
  };

  const handleSubmit = () => {
    if (!active || disabled || !full) return;
    onSubmit(state.slots.join(''));
    if (clearOnSubmit) {
      dispatch({ type: 'reset', secret: '', maxAttempts: Infinity, digits, beginner: false });
      setEditingPos(null);
    }
  };

  // ----- 입력칸 길게 누르기(후보 메모 편집). 짧은 탭은 지우기. guess 전용. -----
  const holdRef = useRef<number | undefined>(undefined);
  const firedRef = useRef(false);
  const startHold = (index: number) => {
    if (!isGuess || !active || disabled) return;
    firedRef.current = false;
    holdRef.current = window.setTimeout(() => {
      firedRef.current = true;
      setEditingPos(index);
    }, 400);
  };
  const cancelHold = () => {
    if (holdRef.current !== undefined) {
      window.clearTimeout(holdRef.current);
      holdRef.current = undefined;
    }
  };
  const onSlotClick = (index: number) => {
    if (firedRef.current) {
      firedRef.current = false;
      return;
    }
    if (state.slots[index]) dispatch({ type: 'clearSlot', index });
  };

  const submitText = submitLabel ?? (isGuess ? '던지기' : '확인');

  const inputDisplay = (
    <div
      className="input-display"
      aria-label="현재 입력"
      style={{ gridTemplateColumns: `repeat(${state.slots.length}, 1fr)` }}
    >
      {state.slots.map((d, i) => (
        <button
          key={i}
          type="button"
          className={`slot cell${d ? ' filled' : ''}${editingPos === i ? ' editing' : ''}`}
          aria-label={d ? `${i + 1}번째 칸 ${d}` : `${i + 1}번째 빈 칸`}
          onPointerDown={() => startHold(i)}
          onPointerUp={cancelHold}
          onPointerLeave={cancelHold}
          onContextMenu={(e) => e.preventDefault()}
          onClick={() => onSlotClick(i)}
        >
          <Seg7 char={d} />
          {isGuess && notes[i] && notes[i].length > 0 && (
            <span className="slot-cands" aria-hidden="true">
              {[...notes[i]].sort().join('')}
            </span>
          )}
        </button>
      ))}
    </div>
  );

  return (
    <section
      className={`board guesspad${boardClass ? ` ${boardClass}` : ''}${active ? '' : ' memo-only'}`}
    >
      {showInput &&
        (stageContent !== undefined ? (
          <div className="play-stage">{active ? inputDisplay : stageContent}</div>
        ) : (
          active && inputDisplay
        ))}

      <Keypad
        slots={active ? state.slots : Array(digits).fill('')}
        memo={memo}
        memoMark={isGuess ? memoMark : null}
        disabled={disabled}
        markButtons={isGuess}
        showSubmit={isGuess && showInput}
        showMemo={false}
        submitLabel={submitText}
        onDigit={(d) => active && !disabled && dispatch({ type: 'push', digit: d })}
        onMemo={(d) => isGuess && memoMark && toggleMemo(d, memoMark)}
        onDelete={() => active && !disabled && dispatch({ type: 'pop' })}
        onSubmit={handleSubmit}
        onPickMark={(m) => setMemoMark((cur) => (cur === m ? null : m))}
        onClearMemo={clearMemo}
      />

      {isGuess && editingPos !== null && (
        <div className="note-pop" role="dialog" aria-label={`${editingPos + 1}번 칸 후보`}>
          <div className="note-pop-head">
            <span className="note-pop-title">{editingPos + 1}번 칸 후보</span>
            <button
              type="button"
              className="note-pop-clear"
              disabled={(notes[editingPos] ?? []).length === 0}
              onClick={() => clearNote(editingPos)}
            >
              비우기
            </button>
            <button
              type="button"
              className="note-pop-close"
              aria-label="닫기"
              onClick={() => setEditingPos(null)}
            >
              ✕
            </button>
          </div>
          <div className="note-pop-nums">
            {NUMS.map((dd) => (
              <button
                key={dd}
                type="button"
                className={`note-num${(notes[editingPos] ?? []).includes(dd) ? ' on' : ''}`}
                aria-pressed={(notes[editingPos] ?? []).includes(dd)}
                onClick={() => toggleNote(editingPos, dd)}
              >
                {dd}
              </button>
            ))}
          </div>
        </div>
      )}

      {overlay}
    </section>
  );
}
