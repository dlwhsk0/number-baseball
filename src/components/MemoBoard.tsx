import type { MemoMark } from '../game/useGame';

interface Props {
  memo: Record<string, MemoMark>;
  disabled: boolean;
  onCycle: (digit: string) => void;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];

/** 메모 표시 배지. */
const BADGE: Record<MemoMark, string> = { out: '✗', in: '○' };

export function MemoBoard({ memo, disabled, onCycle }: Props) {
  return (
    <div className="memo">
      <div className="memo-head">
        <span>메모</span>
        <span className="memo-hint">탭하면 ✗아웃 · ○있음 순환</span>
      </div>
      <div className="memo-grid">
        {KEYS.map((d) => {
          const mark = memo[d];
          return (
            <button
              key={d}
              type="button"
              className={`memo-chip${mark ? ` mark-${mark}` : ''}`}
              disabled={disabled}
              aria-label={`${d} 메모${mark === 'out' ? ' 아웃' : mark === 'in' ? ' 있음' : ''}`}
              onClick={() => onCycle(d)}
            >
              <span className="memo-digit">{d}</span>
              {mark && <span className="memo-badge">{BADGE[mark]}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
