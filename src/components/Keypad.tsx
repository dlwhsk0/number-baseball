import type { MemoMark } from '../game/useGame';
import { Seg7 } from './Seg7';

interface Props {
  /** 입력 칸(길이 3, 빈 칸은 ''). */
  slots: string[];
  /** 숫자별 메모 표시. */
  memo: Record<string, MemoMark>;
  /** 활성 메모 표시. null이면 숫자 입력 모드, 값이 있으면 그 표시를 탭으로 토글. */
  memoMark?: MemoMark | null;
  disabled: boolean;
  onDigit: (digit: string) => void;
  onMemo: (digit: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  /** 메모 버튼을 눌러 활성 표시를 순환(아웃→볼→스트라이크→끄기). */
  onCycleMemo?: () => void;
  /** 메모 버튼 노출 여부. 대결의 숫자 입력(비밀 설정)에선 끈다. 기본 true. */
  showMemo?: boolean;
  /** 확인 버튼 라벨(기본 '확인'). */
  submitLabel?: string;
  /** 메모 표시를 분리 버튼 [아웃][볼][스트라이크][비우기]로(순환식 대신). 솔로·멀티 공용. */
  markButtons?: boolean;
  /** markButtons 모드에서도 그 아래 [확인][지우기] 줄을 함께 보임(솔로 입력용). */
  showSubmit?: boolean;
  /** 마크 직접 선택(markButtons 모드). */
  onPickMark?: (mark: MemoMark) => void;
  /** 메모 전체 지우기(markButtons 모드). */
  onClearMemo?: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/** 메모 표시 기호(키 전체에 크게 겹쳐 보인다). */
const BADGE: Record<MemoMark, string> = { strike: '○', ball: '△', out: '✕' };
const MARK_LABEL: Record<MemoMark, string> = { strike: '스트라이크', ball: '볼', out: '아웃' };
/** 마크 버튼 라벨(영문 약자). */
const MARK_SHORT: Record<MemoMark, string> = { strike: 'S', ball: 'B', out: 'O' };
/** 메모 전용 액션 버튼 순서: 아웃 → 볼 → 스트라이크(자주 쓰는 순). */
const MARKS: MemoMark[] = ['out', 'ball', 'strike'];

export function Keypad({
  slots,
  memo,
  memoMark = null,
  disabled,
  onDigit,
  onMemo,
  onDelete,
  onSubmit,
  onCycleMemo,
  showMemo = true,
  submitLabel = '확인',
  markButtons = false,
  showSubmit = false,
  onPickMark,
  onClearMemo,
}: Props) {
  const isMemo = memoMark !== null;
  const firstEmpty = slots.indexOf('');
  const isFull = firstEmpty === -1;
  const canSubmit = !disabled && isFull;
  const hasInput = slots.some((s) => s !== '');

  /** 입력 모드에서만: 이미 쓴 숫자·꽉 참·맨 앞 0이면 비활성화. 메모 모드에선 모두 누를 수 있다. */
  const digitDisabled = (d: string) => {
    if (disabled) return true;
    if (isMemo) return false;
    return slots.includes(d) || isFull || (firstEmpty === 0 && d === '0');
  };

  return (
    <div className={`keypad${isMemo ? ' is-memo' : ''}`}>
      <div className="keypad-digits">
        {KEYS.map((d) => {
          const mark = memo[d];
          return (
            <button
              key={d}
              type="button"
              className={`key key-digit cell${mark ? ` mark-${mark}` : ''}`}
              aria-label={d}
              disabled={digitDisabled(d)}
              onClick={() => (isMemo ? onMemo(d) : onDigit(d))}
            >
              <span className="key-digit-num">
                <Seg7 char={d} off={mark === 'out'} />
              </span>
              {mark && <span className="key-badge">{BADGE[mark]}</span>}
            </button>
          );
        })}
      </div>

      {markButtons ? (
        <div className="keypad-actions memo-marks">
          {MARKS.map((m) => (
            <button
              key={m}
              type="button"
              className={`key key-mark mark-${m}${memoMark === m ? ' active' : ''}`}
              aria-pressed={memoMark === m}
              aria-label={MARK_LABEL[m]}
              onClick={() => onPickMark?.(m)}
            >
              <span className="mark-badge">{BADGE[m]}</span>
              <span className="mark-label">{MARK_SHORT[m]}</span>
            </button>
          ))}
          <button
            type="button"
            className="key key-clear"
            aria-label="메모 전체 초기화"
            title="메모 전체 초기화"
            onClick={onClearMemo}
          >
            ↺
          </button>
        </div>
      ) : null}

      {markButtons && showSubmit && (
        <div className="keypad-actions no-memo">
          <button type="button" className="key key-submit" disabled={!canSubmit} onClick={onSubmit}>
            {submitLabel}
          </button>
          <button
            type="button"
            className="key key-icon key-delete"
            aria-label="지우기"
            title="지우기"
            disabled={disabled || !hasInput}
            onClick={onDelete}
          >
            ⌫
          </button>
        </div>
      )}

      {!markButtons && (
        <div className={`keypad-actions${showMemo ? '' : ' no-memo'}`}>
          {showMemo && (
            <button
              type="button"
              className={`key key-icon key-memo${isMemo ? ` active mark-${memoMark}` : ''}`}
              aria-pressed={isMemo}
              aria-label={
                memoMark ? `메모: ${MARK_LABEL[memoMark]} (눌러서 전환)` : '메모 (아웃/볼/스트라이크)'
              }
              title="메모 표시 전환"
              disabled={disabled}
              onClick={onCycleMemo}
            >
              {memoMark ? BADGE[memoMark] : '✎'}
            </button>
          )}
          <button
            type="button"
            className="key key-submit"
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {submitLabel}
          </button>
          <button
            type="button"
            className="key key-icon key-delete"
            aria-label="지우기"
            title="지우기"
            disabled={disabled || !hasInput}
            onClick={onDelete}
          >
            ⌫
          </button>
        </div>
      )}

      {isMemo && (
        <p className="keypad-hint">
          숫자를 눌러{' '}
          <span className={`mark-${memoMark}`}>
            {BADGE[memoMark!]} {MARK_LABEL[memoMark!]}
          </span>{' '}
          표시 · 다시 눌러 해제
        </p>
      )}
    </div>
  );
}
