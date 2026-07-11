import type { MemoMark } from '../game/useGame';

interface Props {
  /** 현재 입력(0~3자리). */
  input: string;
  /** 숫자별 메모 표시. */
  memo: Record<string, MemoMark>;
  /** 'input'=숫자 입력, 'memo'=탭하면 메모 표시 순환. */
  mode: 'input' | 'memo';
  disabled: boolean;
  onDigit: (digit: string) => void;
  onMemo: (digit: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/** 메모 표시 배지 기호. */
const BADGE: Record<MemoMark, string> = { strike: '○', ball: '△', out: '✗' };

export function Keypad({
  input,
  memo,
  mode,
  disabled,
  onDigit,
  onMemo,
  onDelete,
  onSubmit,
}: Props) {
  const isMemo = mode === 'memo';
  const canSubmit = !disabled && input.length === 3;

  /** 입력 모드에서만: 이미 쓴 숫자거나 맨 앞 0이면 비활성화. 메모 모드에선 모두 누를 수 있다. */
  const digitDisabled = (d: string) =>
    disabled || (!isMemo && (input.includes(d) || (input.length === 0 && d === '0')));

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
              {d}
              {mark && <span className="key-badge">{BADGE[mark]}</span>}
            </button>
          );
        })}
      </div>

      {isMemo ? (
        <p className="keypad-hint">숫자를 눌러 ○스트라이크 · △볼 · ✗아웃 표시</p>
      ) : (
        <div className="keypad-actions">
          <button
            type="button"
            className="key key-delete"
            disabled={disabled || input.length === 0}
            onClick={onDelete}
          >
            ⌫ 지우기
          </button>
          <button
            type="button"
            className="key key-submit"
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            확인
          </button>
        </div>
      )}
    </div>
  );
}
