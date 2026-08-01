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
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/** 메모 표시 기호(키 전체에 크게 겹쳐 보인다). */
const BADGE: Record<MemoMark, string> = { strike: '○', ball: '△', out: '✕' };
const MARK_LABEL: Record<MemoMark, string> = { strike: '스트라이크', ball: '볼', out: '아웃' };

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

      {isMemo && (
        <p className="keypad-hint">
          숫자를 눌러 <span className={`mark-${memoMark}`}>{BADGE[memoMark!]}{MARK_LABEL[memoMark!]}</span> 표시·해제 · 메모 버튼으로 아웃·볼·스트라이크 전환
        </p>
      )}
    </div>
  );
}
