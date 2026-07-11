interface Props {
  /** 현재 입력(0~3자리). */
  input: string;
  disabled: boolean;
  onDigit: (digit: string) => void;
  onDelete: () => void;
  onSubmit: () => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

export function Keypad({ input, disabled, onDigit, onDelete, onSubmit }: Props) {
  const canSubmit = !disabled && input.length === 3;

  /** 이미 쓴 숫자거나, 맨 앞에 올 수 없는 0이면 비활성화. */
  const digitDisabled = (d: string) =>
    disabled || input.includes(d) || (input.length === 0 && d === '0');

  return (
    <div className="keypad">
      <div className="keypad-digits">
        {KEYS.map((d) => (
          <button
            key={d}
            type="button"
            className="key key-digit"
            disabled={digitDisabled(d)}
            onClick={() => onDigit(d)}
          >
            {d}
          </button>
        ))}
      </div>
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
    </div>
  );
}
