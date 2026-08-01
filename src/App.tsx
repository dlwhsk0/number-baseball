import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  useGame,
  LEVELS,
  cycleMemoMark,
  type Level,
  type MemoMark,
  type GuessRecord,
} from './game/useGame';
import { Keypad } from './components/Keypad';
import { History } from './components/History';
import { ResultBanner } from './components/ResultBanner';
import { RevealCard } from './components/RevealCard';
import { Seg7 } from './components/Seg7';
import { Intro } from './components/Intro';
import { RulesModal } from './components/RulesModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { SpeedVersus } from './versus/SpeedVersus';
import { DuelVersus } from './versus/DuelVersus';
import { OnlineDuel } from './versus/OnlineDuel';
import './App.css';

type Section = 'solo' | 'multi';
type MultiMode = 'speed' | 'duel' | 'online';
const MULTI_TABS: { key: MultiMode; label: string }[] = [
  { key: 'online', label: '온라인' },
  { key: 'speed', label: '스피드' },
  { key: 'duel', label: '턴제' },
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
  const { state, pushDigit, popDigit, clearSlot, submit, toggleMemo, reset } = useGame(level);
  const [section, setSection] = useState<Section>('solo');
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  // 멀티 기본값은 온라인(연결 없으면 스피드).
  const [multiMode, setMultiMode] = useState<MultiMode>(() =>
    typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'speed',
  );
  const [netMsg, setNetMsg] = useState<string | null>(null);
  const netTimerRef = useRef<number | undefined>(undefined);
  const showNet = (m: string) => {
    setNetMsg(m);
    if (netTimerRef.current) window.clearTimeout(netTimerRef.current);
    netTimerRef.current = window.setTimeout(() => setNetMsg(null), 1900);
  };
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  // 연결이 끊기면 온라인 모드에서 스피드로 폴백.
  useEffect(() => {
    if (!online && multiMode === 'online') {
      setMultiMode('speed');
      showNet('네트워크 연결이 필요해요');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, multiMode]);
  const [memoMark, setMemoMark] = useState<MemoMark | null>(null);
  // 추측할 때마다 잠깐 뜨는 결과 발표 카드(승리/패배 아닌 진행 중 추측만).
  const [soloReveal, setSoloReveal] = useState<GuessRecord | null>(null);
  const prevGuessCountRef = useRef(0);
  const revealTimerRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    const n = state.guesses.length;
    if (n > prevGuessCountRef.current && state.status === 'playing') {
      setSoloReveal(state.guesses[n - 1]);
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
      revealTimerRef.current = window.setTimeout(() => setSoloReveal(null), 1500);
    }
    prevGuessCountRef.current = n;
  }, [state.guesses, state.status]);
  const [showRules, setShowRules] = useState(false);
  // 첫 방문이면 게임 방법(?) 버튼을 반짝여 규칙을 보게 유도. 한 번 열면 localStorage에 기록.
  const [seenRules, setSeenRules] = useState(() => {
    try {
      return !!localStorage.getItem('nb_seen_rules');
    } catch {
      return true;
    }
  });
  const openRules = () => {
    setShowRules(true);
    if (!seenRules) {
      setSeenRules(true);
      try {
        localStorage.setItem('nb_seen_rules', '1');
      } catch {
        /* 저장 불가 환경 무시 */
      }
    }
  };
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

  // 이스터에그: 라이트('주간') 모드. 다크가 무조건 기본 — 세션 한정이라 새로고침하면 다시 다크.
  // 'history' 라벨을 길게 눌러 전환.
  const [dayMode, setDayMode] = useState(false);
  const [eggMsg, setEggMsg] = useState<string | null>(null);
  const holdRef = useRef<number | undefined>(undefined);
  const firstThemeRef = useRef(true);

  useEffect(() => {
    const root = document.documentElement;
    if (dayMode) root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dayMode ? '#eef1f5' : '#000000');
    if (firstThemeRef.current) {
      firstThemeRef.current = false;
      return;
    }
    setEggMsg(dayMode ? '☀️ 주간 모드' : '🌙 야간 모드');
    const t = window.setTimeout(() => setEggMsg(null), 1500);
    return () => window.clearTimeout(t);
  }, [dayMode]);

  const startHold = () => {
    holdRef.current = window.setTimeout(() => setDayMode((v) => !v), 800);
  };
  const cancelHold = () => {
    if (holdRef.current !== undefined) {
      window.clearTimeout(holdRef.current);
      holdRef.current = undefined;
    }
  };

  // 이스터에그 2: 하단 깃허브 로고를 여러 번 누르면 '개발자 모드' 해금(삼성 개발자모드 오마주).
  const devTapRef = useRef(0);
  const devResetRef = useRef<number | undefined>(undefined);
  const devToastRef = useRef<number | undefined>(undefined);
  const [devMsg, setDevMsg] = useState<string | null>(null);
  const [devUnlocked, setDevUnlocked] = useState(false);
  const DEV_TOTAL = 7;
  const DEV_MSGS = ['개발자가 깨어나는 중...', '조금만 더...', '거의 다 왔어요...', '한 번만 더!'];

  const tapGithub = () => {
    if (devUnlocked) return;
    devTapRef.current += 1;
    const n = devTapRef.current;
    if (devResetRef.current) window.clearTimeout(devResetRef.current);
    devResetRef.current = window.setTimeout(() => {
      devTapRef.current = 0;
    }, 1500);
    if (n >= DEV_TOTAL) {
      devTapRef.current = 0;
      setDevMsg(null);
      setDevUnlocked(true);
      return;
    }
    if (n >= 3) {
      const idx = Math.min(n - 3, DEV_MSGS.length - 1);
      setDevMsg(`${DEV_MSGS[idx]} (${DEV_TOTAL - n})`);
      if (devToastRef.current) window.clearTimeout(devToastRef.current);
      devToastRef.current = window.setTimeout(() => setDevMsg(null), 1100);
    }
  };
  const [pendingLevel, setPendingLevel] = useState<Level | null>(null);
  const finished = state.status !== 'playing';

  // PWA: 새 버전은 autoUpdate로 백그라운드 설치 → 다음 실행 때 자동 적용(팝업 없음).
  // 진행 중 강제 리로드를 막기 위해 여기서 즉시 리로드는 하지 않는다.
  useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // 앱이 보일 때마다 + 1분마다 새 버전 확인(모바일/설치앱은 자동 확인이 잘 안 돎).
      const check = () => {
        if (document.visibilityState === 'visible') registration.update();
      };
      check();
      document.addEventListener('visibilitychange', check);
      setInterval(check, 60 * 1000);
    },
  });

  // 빈 판(진행 중 난이도 변경 확인용).
  const pristine =
    state.status === 'playing' &&
    state.guesses.length === 0 &&
    state.slots.every((s) => s === '') &&
    Object.keys(state.memo).length === 0;

  const clearReveal = () => {
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    setSoloReveal(null);
  };

  const newGame = () => {
    setMemoMark(null);
    clearReveal();
    reset(level);
  };

  const doChangeLevel = (lv: Level) => {
    setLevel(lv);
    try {
      localStorage.setItem('level', lv);
    } catch {
      /* 저장 불가 환경 무시 */
    }
    setMemoMark(null);
    clearReveal();
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

  // 온라인 대결 진행 중 이탈 방지 — 모드 전환 시 확인창.
  const [onlineActive, setOnlineActive] = useState(false);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const guardedSwitch = (fn: () => void) => {
    if (onlineActive) setPendingLeave(() => fn);
    else fn();
  };

  return (
    <main className="app">
      {showIntro && <Intro onDone={dismissIntro} />}
      <header className="controls">
        <div className="controls-row">
          <button
            type="button"
            className={`help-btn${seenRules ? '' : ' pulse-hint'}`}
            onClick={openRules}
            aria-label="게임 방법"
            title="게임 방법"
          >
            ?
          </button>
          <div className="seg" role="group" aria-label="모드 선택">
            <button
              type="button"
              className={`seg-btn${section === 'solo' ? ' active' : ''}`}
              aria-pressed={section === 'solo'}
              onClick={() => guardedSwitch(() => setSection('solo'))}
            >
              혼자
            </button>
            <button
              type="button"
              className={`seg-btn${section === 'multi' ? ' active' : ''}`}
              aria-pressed={section === 'multi'}
              onClick={() => setSection('multi')}
            >
              멀티
            </button>
          </div>
        </div>

        <div className="controls-row">
          {section === 'solo' ? (
            <>
              <div className="seg" role="group" aria-label="난이도 선택">
                {LEVEL_ORDER.map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    className={`seg-btn${lv === level ? ' active' : ''}`}
                    aria-pressed={lv === level}
                    onClick={() => changeLevel(lv)}
                  >
                    {LEVELS[lv].label}
                  </button>
                ))}
              </div>
              <button type="button" className="corner-btn" onClick={newGame}>
                ↻ 새 게임
              </button>
            </>
          ) : (
            <div className="seg" role="group" aria-label="대결 선택">
              {MULTI_TABS.map((m) => {
                const off = m.key === 'online' && !online;
                return (
                  <button
                    key={m.key}
                    type="button"
                    className={`seg-btn${multiMode === m.key ? ' active' : ''}${off ? ' disabled' : ''}`}
                    aria-pressed={multiMode === m.key}
                    aria-disabled={off}
                    onClick={() => {
                      if (off) {
                        showNet('온라인은 네트워크 연결이 필요해요');
                        return;
                      }
                      if (m.key === multiMode) return;
                      guardedSwitch(() => setMultiMode(m.key));
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {section === 'solo' && (
          <p className="level-caption">
            {level === 'advanced' ? '4자리' : '3자리'}
            {LEVELS[level].beginner ? ' · 자동 힌트(3아웃이면 ✕ 표시)' : ''}
          </p>
        )}
      </header>

      {section === 'solo' ? (
        <>
      <section className="board">
        {finished ? (
          <ResultBanner
            status={state.status}
            secret={state.secret}
            attempts={state.guesses.length}
            onRestart={newGame}
          />
        ) : (
          <>
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
                  disabled={!d}
                  aria-label={d ? `${i + 1}번째 칸 ${d} 지우기` : `${i + 1}번째 빈 칸`}
                  onClick={() => clearSlot(i)}
                >
                  <Seg7 char={d} />
                </button>
              ))}
            </div>

            <Keypad
              slots={state.slots}
              memo={state.memo}
              memoMark={memoMark}
              disabled={finished}
              onDigit={pushDigit}
              onMemo={(d) => memoMark && toggleMemo(d, memoMark)}
              onDelete={popDigit}
              onSubmit={submit}
              onCycleMemo={() => setMemoMark((m) => cycleMemoMark(m))}
            />

            {/* 추측 직후 잠깐 뜨는 결과 발표 카드(입력 영역 위로 팝업, 입력은 계속 가능). */}
            {soloReveal && (
              <div className="solo-reveal" aria-live="polite">
                <RevealCard
                  guess={soloReveal.guess}
                  judgement={soloReveal.judgement}
                  digits={state.digits}
                />
              </div>
            )}
          </>
        )}
      </section>

      <section className="history-section">
        <div className="history-head">
          <span
            className="egg-trigger"
            onPointerDown={startHold}
            onPointerUp={cancelHold}
            onPointerLeave={cancelHold}
            onContextMenu={(e) => e.preventDefault()}
          >
            history
          </span>
          <span className="attempts">
            {state.guesses.length} / {state.maxAttempts}
          </span>
        </div>
        <History guesses={state.guesses} />
      </section>
        </>
      ) : multiMode === 'speed' ? (
        <SpeedVersus onExit={() => setSection('solo')} />
      ) : multiMode === 'duel' ? (
        <DuelVersus onExit={() => setSection('solo')} />
      ) : (
        <OnlineDuel onExit={() => setSection('solo')} onActiveChange={setOnlineActive} />
      )}

      <footer className="app-footer">
        <button
          type="button"
          className="footer-link"
          onClick={tapGithub}
          aria-label="야구공"
        >
          <span className="footer-ball" aria-hidden="true">
            ⚾
          </span>
        </button>
      </footer>

      {eggMsg && <div className="egg-toast">{eggMsg}</div>}
      {netMsg && <div className="egg-toast">{netMsg}</div>}
      {devMsg && <div className="egg-toast dev-toast">{devMsg}</div>}

      {devUnlocked && (
        <div className="dev-modal-backdrop" onClick={() => setDevUnlocked(false)}>
          <div
            className="dev-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="dev-emblem">⚾</div>
            <h3 className="dev-title">저를 찾아내셨군요!</h3>
            <a
              className="dev-link"
              href="https://github.com/dlwhsk0"
              target="_blank"
              rel="noopener noreferrer"
            >
              <GitHubIcon />
              <span>dlwhsk0</span>
            </a>
            <button type="button" className="dev-close" onClick={() => setDevUnlocked(false)}>
              닫기
            </button>
          </div>
        </div>
      )}

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

      {pendingLeave && (
        <ConfirmDialog
          message="온라인 대결이 진행 중이에요. 나가면 게임이 종료돼요. 나갈까요?"
          confirmLabel="나가기"
          cancelLabel="계속하기"
          onConfirm={() => {
            const fn = pendingLeave;
            setPendingLeave(null);
            setOnlineActive(false);
            fn();
          }}
          onCancel={() => setPendingLeave(null)}
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
