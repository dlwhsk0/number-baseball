import type { MemoMark } from '../game/useGame';

interface Props {
  /** 입력 칸(길이 3, 빈 칸은 ''). */
  slots: string[];
  /** 숫자별 메모 표시. */
  memo: Record<string, MemoMark>;
  /** 'input'=숫자 입력, 'memo'=탭하면 메모 표시 순환. */
  mode: 'input' | 'memo';
  disabled: boolean;
  onDigit: (digit: string) => void;
  onMemo: (digit: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
  onToggleMemo?: () => void;
  /** 메모 버튼 노출 여부. 대결의 숫자 입력에선 끈다. 기본 true. */
  showMemo?: boolean;
  /** 확인 버튼 라벨(기본 '확인'). */
  submitLabel?: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/** 메모 표시 기호(키 전체에 크게 겹쳐 보인다). */
const BADGE: Record<MemoMark, string> = { strike: '○', ball: '△', out: '✕' };

export function Keypad({
  slots,
  memo,
  mode,
  disabled,
  onDigit,
  onMemo,
  onDelete,
  onSubmit,
  onToggleMemo,
  showMemo = true,
  submitLabel = '확인',
}: Props) {
  const isMemo = mode === 'memo';
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
              className={`key key-digit${mark ? ` mark-${mark}` : ''}`}
              disabled={digitDisabled(d)}
              onClick={() => (isMemo ? onMemo(d) : onDigit(d))}
            >
              <span className="key-digit-num">{d}</span>
              {mark && <span className="key-badge">{BADGE[mark]}</span>}
            </button>
          );
        })}
      </div>

      <div className={`keypad-actions${showMemo ? '' : ' no-memo'}`}>
        {showMemo && (
          <button
            type="button"
            className={`key key-icon key-memo${isMemo ? ' active' : ''}`}
            aria-pressed={isMemo}
            aria-label="메모 모드"
            title="메모 모드"
            disabled={disabled}
            onClick={onToggleMemo}
          >
            ✎
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
        <p className="keypad-hint">숫자를 눌러 ○스트라이크 · △볼 · ✕아웃 표시</p>
      )}
    </div>
  );
}
