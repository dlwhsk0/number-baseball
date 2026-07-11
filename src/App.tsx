import { useState } from 'react';
import { useGame } from './game/useGame';
import { DIGITS } from './game/logic';
import { Keypad } from './components/Keypad';
import { History } from './components/History';
import { ResultBanner } from './components/ResultBanner';
import './App.css';

export default function App() {
  const { state, pushDigit, popDigit, submit, cycleMemo, reset } = useGame();
  const [memoMode, setMemoMode] = useState(false);
  const finished = state.status !== 'playing';
  const slots = Array.from({ length: DIGITS }, (_, i) => state.input[i] ?? '');

  const newGame = () => {
    setMemoMode(false);
    reset();
  };

  return (
    <main className="app">
      <header className="app-header">
        <h1>숫자 야구</h1>
        <p className="subtitle">서로 다른 세 자리 숫자를 맞혀보세요</p>
        <button type="button" className="new-game" onClick={newGame}>
          새 게임
        </button>
      </header>

      <section className="board">
        <div className="input-display" aria-label="현재 입력">
          {slots.map((d, i) => (
            <span key={i} className={`slot${d ? ' filled' : ''}`}>
              {d || '·'}
            </span>
          ))}
        </div>

        {finished ? (
          <ResultBanner
            status={state.status}
            secret={state.secret}
            attempts={state.guesses.length}
            onRestart={newGame}
          />
        ) : (
          <>
            <div className="mode-bar">
              <button
                type="button"
                className={`memo-toggle${memoMode ? ' active' : ''}`}
                aria-pressed={memoMode}
                onClick={() => setMemoMode((v) => !v)}
              >
                ✎ 메모 모드 {memoMode ? 'ON' : 'OFF'}
              </button>
            </div>
            <Keypad
              input={state.input}
              memo={state.memo}
              mode={memoMode ? 'memo' : 'input'}
              disabled={finished}
              onDigit={pushDigit}
              onMemo={cycleMemo}
              onDelete={popDigit}
              onSubmit={submit}
            />
          </>
        )}
      </section>

      <section className="history-section">
        <div className="history-head">
          <span>추측 기록</span>
          <span className="attempts">
            {state.guesses.length} / {state.maxAttempts}
          </span>
        </div>
        <History guesses={state.guesses} />
      </section>
    </main>
  );
}
