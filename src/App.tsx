import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useGame, LEVELS, type Level } from './game/useGame';
import { Keypad } from './components/Keypad';
import { History } from './components/History';
import { ResultBanner } from './components/ResultBanner';
import { UpdatePrompt } from './components/UpdatePrompt';
import { Seg7 } from './components/Seg7';
import { Intro } from './components/Intro';
import { RulesModal } from './components/RulesModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { SpeedVersus } from './versus/SpeedVersus';
import { DuelVersus } from './versus/DuelVersus';
import './App.css';

type Section = 'solo' | 'multi';
type MultiMode = 'speed' | 'duel';
const MULTI_TABS: { key: MultiMode; label: string }[] = [
  { key: 'speed', label: '스피드 대결' },
  { key: 'duel', label: '턴제 대결' },
];

const LEVEL_ORDER: Level[] = ['beginner', 'intermediate', 'advanced'];

function getInitialLevel(): Level {
  try {
    const saved = localStorage.getItem('level');
    if (saved === 'beginner' || saved === 'intermediate' || saved === 'advanced') return saved;
  } catch {
    /* 저장 불가 환경 무시 */
  }
  return 'intermediate';
}

export default function App() {
  const [level, setLevel] = useState<Level>(getInitialLevel);
  const { state, pushDigit, popDigit, clearSlot, submit, cycleMemo, reset } = useGame(level);
  const [section, setSection] = useState<Section>('solo');
  const [multiMode, setMultiMode] = useState<MultiMode>('speed');
  const [memoMode, setMemoMode] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return !sessionStorage.getItem('nb_intro');
    } catch {
      return false;
    }
  });
  const dismissIntro = () => {
    try {
      sessionStorage.setItem('nb_intro', '1');
    } catch {
      /* 저장 불가 환경 무시 */
    }
    setShowIntro(false);
  };
  const [pendingLevel, setPendingLevel] = useState<Level | null>(null);
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
  // 혼자 모드의 빈 판에서만 조용히 자동 적용(대결 진행 중에 리로드되면 안 됨).
  const pristine =
    state.status === 'playing' &&
    state.guesses.length === 0 &&
    state.slots.every((s) => s === '') &&
    Object.keys(state.memo).length === 0;
  const canAutoReload = pristine && section === 'solo';
  useEffect(() => {
    if (needRefresh && canAutoReload) updateServiceWorker(true);
  }, [needRefresh, canAutoReload, updateServiceWorker]);

  // 대기 중 업데이트가 있으면 새 판을 시작하는 이 시점에 적용(새로고침)하고 끝낸다.
  const applyUpdateIfPending = () => {
    if (needRefresh) {
      updateServiceWorker(true);
      return true;
    }
    return false;
  };

  const newGame = () => {
    if (applyUpdateIfPending()) return;
    setMemoMode(false);
    reset(level);
  };

  // 실제로 난이도를 바꾸고 새 판을 시작한다.
  const doChangeLevel = (lv: Level) => {
    setLevel(lv);
    try {
      localStorage.setItem('level', lv);
    } catch {
      /* 저장 불가 환경 무시 */
    }
    if (applyUpdateIfPending()) return;
    setMemoMode(false);
    reset(lv);
  };

  // 진행 중인 판(입력·추측·메모가 있는 상태)이면 확인창을 띄우고, 아니면 바로 바꾼다.
  const gameInProgress = state.status === 'playing' && !pristine;
  const changeLevel = (lv: Level) => {
    if (lv === level) return;
    if (gameInProgress) {
      setPendingLevel(lv);
      return;
    }
    doChangeLevel(lv);
  };

  return (
    <main className="app">
      {showIntro && <Intro onDone={dismissIntro} />}
      <UpdatePrompt
        show={needRefresh}
        onRefresh={() => updateServiceWorker(true)}
        onDismiss={() => setNeedRefresh(false)}
      />
      <header className="app-header">
        <div className="corner corner-left">
          <button
            type="button"
            className="help-btn"
            onClick={() => setShowRules(true)}
            aria-label="게임 방법"
            title="게임 방법"
          >
            ?
          </button>
        </div>

        <div className="corner corner-right">
          {section === 'solo' ? (
            <>
              <button type="button" className="corner-btn" onClick={newGame}>
                새 게임
              </button>
              <button
                type="button"
                className="corner-btn corner-btn-accent"
                onClick={() => setSection('multi')}
              >
                멀티 ▶
              </button>
            </>
          ) : (
            <button
              type="button"
              className="corner-btn"
              onClick={() => setSection('solo')}
            >
              ◀ 혼자
            </button>
          )}
        </div>
      </header>

      {section === 'multi' && (
        <div className="nav">
          <div className="mode-tabs" role="group" aria-label="대결 선택">
            {MULTI_TABS.map((m) => (
              <button
                key={m.key}
                type="button"
                className={`mode-tab${multiMode === m.key ? ' active' : ''}`}
                aria-pressed={multiMode === m.key}
                onClick={() => setMultiMode(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {section === 'solo' ? (
        <>
      <div className="level-bar">
        <div className="level-select" role="group" aria-label="난이도 선택">
          {LEVEL_ORDER.map((lv) => (
            <button
              key={lv}
              type="button"
              className={`level-btn${lv === level ? ' active' : ''}`}
              aria-pressed={lv === level}
              onClick={() => changeLevel(lv)}
            >
              {LEVELS[lv].label}
            </button>
          ))}
        </div>
        <p className="level-caption">
          {level === 'advanced' ? '4자리' : '3자리'}
          {LEVELS[level].beginner ? ' · 자동 힌트(3아웃이면 ✕ 표시)' : ''}
        </p>
      </div>

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
              onClick={() => clearSlot(i)}
            >
              <Seg7 char={d} />
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
          <Keypad
            slots={state.slots}
            memo={state.memo}
            mode={memoMode ? 'memo' : 'input'}
            disabled={finished}
            onDigit={pushDigit}
            onMemo={cycleMemo}
            onDelete={popDigit}
            onSubmit={submit}
            onToggleMemo={() => setMemoMode((v) => !v)}
          />
        )}
      </section>

      <section className="history-section">
        <div className="history-head">
          <span>history</span>
          <span className="attempts">
            {state.guesses.length} / {state.maxAttempts}
          </span>
        </div>
        <History guesses={state.guesses} />
      </section>
        </>
      ) : multiMode === 'speed' ? (
        <SpeedVersus onExit={() => setSection('solo')} />
      ) : (
        <DuelVersus onExit={() => setSection('solo')} />
      )}

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

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}

      {pendingLevel && (
        <ConfirmDialog
          message={`진행 중인 게임이 있어요. '${LEVELS[pendingLevel].label}'(으)로 바꾸면 지금 판은 사라져요. 바꿀까요?`}
          confirmLabel="바꾸기"
          cancelLabel="취소"
          onConfirm={() => {
            const lv = pendingLevel;
            setPendingLevel(null);
            doChangeLevel(lv);
          }}
          onCancel={() => setPendingLevel(null)}
        />
      )}
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
