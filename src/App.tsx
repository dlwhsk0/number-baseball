import { useGame } from './game/useGame';
import { DIGITS } from './game/logic';
import { Keypad } from './components/Keypad';
import { History } from './components/History';
import { ResultBanner } from './components/ResultBanner';
import './App.css';

export default function App() {
  const { state, pushDigit, popDigit, submit, reset } = useGame();
  const finished = state.status !== 'playing';
  const slots = Array.from({ length: DIGITS }, (_, i) => state.input[i] ?? '');

  return (
    <main className="app">
      <header className="app-header">
        <h1>숫자 야구</h1>
        <p className="subtitle">서로 다른 세 자리 숫자를 맞혀보세요</p>
        <button type="button" className="new-game" onClick={reset}>
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
            onRestart={reset}
          />
        ) : (
          <Keypad
            input={state.input}
            disabled={finished}
            onDigit={pushDigit}
            onDelete={popDigit}
            onSubmit={submit}
          />
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
