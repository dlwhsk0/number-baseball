import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useGame } from './game/useGame';
import { Keypad } from './components/Keypad';
import { History } from './components/History';
import { ResultBanner } from './components/ResultBanner';
import { UpdatePrompt } from './components/UpdatePrompt';
import { ThemeToggle } from './components/ThemeToggle';
import './App.css';

export default function App() {
  const { state, pushDigit, popDigit, clearSlot, submit, cycleMemo, reset } = useGame();
  const [memoMode, setMemoMode] = useState(false);
  const finished = state.status !== 'playing';

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // 앱을 오래 켜둬도 주기적으로 새 버전을 확인(1시간마다).
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000);
      }
    },
  });

  const newGame = () => {
    // 대기 중인 업데이트가 있으면, 새 판을 시작하는 이 시점에 적용한다(새로고침).
    // 어차피 새 판이라 잃는 게 없다 → "게임 끝나고 다시 시작하면 자동 업데이트".
    if (needRefresh) {
      updateServiceWorker(true);
      return;
    }
    setMemoMode(false);
    reset();
  };

  return (
    <main className="app">
      <UpdatePrompt
        show={needRefresh}
        onRefresh={() => updateServiceWorker(true)}
        onDismiss={() => setNeedRefresh(false)}
      />
      <header className="app-header">
        <ThemeToggle />
        <h1>숫자 야구</h1>
        <p className="subtitle">서로 다른 세 자리 숫자를 맞혀보세요</p>
        <button type="button" className="new-game" onClick={newGame}>
          새 게임
        </button>
      </header>

      <section className="board">
        <div className="input-display" aria-label="현재 입력">
          {state.slots.map((d, i) => (
            <button
              key={i}
              type="button"
              className={`slot${d ? ' filled' : ''}`}
              disabled={finished || !d}
              aria-label={d ? `${i + 1}번째 칸 ${d} 지우기` : `${i + 1}번째 빈 칸`}
              onClick={() => clearSlot(i)}
            >
              {d || '·'}
            </button>
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
              slots={state.slots}
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
