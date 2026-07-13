import { useEffect, useState } from 'react';
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
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // 새 버전 확인 시점을 늘린다. 모바일/설치앱은 앱을 껐다 켜도 메모리에서
      // '재개(resume)'만 되어 자동 확인이 안 돌기 때문에, 앱이 보일 때마다 확인한다.
      const check = () => {
        if (document.visibilityState === 'visible') registration.update();
      };
      check();
      document.addEventListener('visibilitychange', check);
      setInterval(check, 30 * 60 * 1000);
    },
  });

  // 빈 판(게임 시작 전)에서 업데이트가 잡히면 조용히 즉시 적용한다.
  // 게임 중이면 건드리지 않고 배너만 보여준다(진행 중 초기화 방지).
  const pristine =
    state.status === 'playing' &&
    state.guesses.length === 0 &&
    state.slots.every((s) => s === '') &&
    Object.keys(state.memo).length === 0;
  useEffect(() => {
    if (needRefresh && pristine) updateServiceWorker(true);
  }, [needRefresh, pristine, updateServiceWorker]);

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

      <footer className="app-footer">
        <a
          className="footer-link"
          href="https://github.com/dlwhsk0"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub 프로필"
          title="GitHub @dlwhsk0"
        >
          <GitHubIcon />
        </a>
      </footer>
    </main>
  );
}

function GitHubIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.05-.02-2.06-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.12-.3-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.23 0 4.63-2.81 5.65-5.49 5.95.43.37.81 1.1.81 2.22 0 1.61-.01 2.9-.01 3.3 0 .32.22.7.83.58A12.01 12.01 0 0 0 24 12.5C24 5.87 18.63.5 12 .5z" />
    </svg>
  );
}
