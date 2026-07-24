import { useEffect, useReducer, useRef, useState } from 'react';
import { gameReducer, initGame } from '../game/useGame';
import { Keypad } from './Keypad';
import { History } from './History';
import { Seg7 } from './Seg7';
import { LampBank } from './LampBank';

interface Props {
  /** 맞혀야 할 정답. */
  secret: string;
  digits: number;
  /** 시도 제한. 대결에선 무제한(Infinity)으로 끝까지 푼다. */
  maxAttempts?: number;
  /** 정답을 맞혔을 때(승리) 시도 횟수를 넘겨 호출. */
  onWin: (attempts: number) => void;
}

/**
 * 재사용 가능한 추측 보드(입력 칸 + 키패드 + 메모 + 히스토리).
 * 순수 `gameReducer`로 자체 상태를 관리한다. 대결 모드의 한 플레이어 턴에 사용.
 */
export function GuessBoard({ secret, digits, maxAttempts = Infinity, onWin }: Props) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    initGame(secret, maxAttempts, digits, false),
  );
  const [memoMode, setMemoMode] = useState(false);
  const finished = state.status !== 'playing';

  const lastJudge = state.guesses[state.guesses.length - 1]?.judgement;
  const lampStrikes = lastJudge?.strikes ?? 0;
  const lampBalls = lastJudge?.balls ?? 0;
  const lampOuts = lastJudge ? state.digits - lampStrikes - lampBalls : 0;

  // 승리하면 한 번만 콜백.
  const firedRef = useRef(false);
  useEffect(() => {
    if (state.status === 'won' && !firedRef.current) {
      firedRef.current = true;
      onWin(state.guesses.length);
    }
  }, [state.status, state.guesses.length, onWin]);

  return (
    <>
      <section className="board">
        <div
          className="input-display"
          aria-label="현재 입력"
          style={{ gridTemplateColumns: `repeat(${state.slots.length}, 1fr)` }}
        >
          {state.slots.map((d, i) => (
            <button
              key={i}
              type="button"
              className={`slot cell${d ? ' filled' : ''}`}
              disabled={finished || !d}
              aria-label={d ? `${i + 1}번째 칸 ${d} 지우기` : `${i + 1}번째 빈 칸`}
              onClick={() => dispatch({ type: 'clearSlot', index: i })}
            >
              <Seg7 char={d} />
            </button>
          ))}
        </div>

        <LampBank
          strikes={lampStrikes}
          balls={lampBalls}
          outs={lampOuts}
          digits={state.digits}
        />

        <Keypad
          slots={state.slots}
          memo={state.memo}
          mode={memoMode ? 'memo' : 'input'}
          disabled={finished}
          onDigit={(digit) => dispatch({ type: 'push', digit })}
          onMemo={(digit) => dispatch({ type: 'memo', digit })}
          onDelete={() => dispatch({ type: 'pop' })}
          onSubmit={() => dispatch({ type: 'submit' })}
          onToggleMemo={() => setMemoMode((v) => !v)}
        />
      </section>

      <section className="history-section">
        <div className="history-head">
          <span>추측 기록</span>
          <span className="attempts">{state.guesses.length}회</span>
        </div>
        <History guesses={state.guesses} />
      </section>
    </>
  );
}
