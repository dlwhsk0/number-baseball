import { useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useGame, type GuessRecord } from './game/useGame';
import { GuessPad } from './components/GuessPad';
import { History } from './components/History';
import { ResultBanner } from './components/ResultBanner';
import { RevealCard } from './components/RevealCard';
import { Intro } from './components/Intro';
import { RulesModal } from './components/RulesModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { FieldBackdrop } from './components/FieldBackdrop';
import { SpeedVersus } from './versus/SpeedVersus';
import { DuelVersus } from './versus/DuelVersus';
import { OnlineDuel } from './versus/OnlineDuel';
import { OnlineSpeed } from './versus/OnlineSpeed';
import { peekRoom } from './net/peek';
import './App.css';

type Section = 'solo' | 'multi';
type GameType = 'speed' | 'duel';

// 앱 아이콘 버전. 올릴 때마다 설치된 사용자에게 '홈 화면 재설치' 안내를 한 번 띄운다.
// (PWA 홈 화면 아이콘은 OS가 설치 시점에 캐시 → 매니페스트만 바꿔선 안 바뀜.)
const ICON_VERSION = '2';
type Launch =
  | { conn: 'online'; gameType: GameType; action: 'create' | 'join'; code?: string }
  | { conn: 'local'; gameType: GameType };

// 자릿수(3/4)와 힌트(개인 기능)는 독립. 예전 'level' 저장값이 있으면 이관.
function getInitialDigits(): number {
  try {
    const d = localStorage.getItem('nb_digits');
    if (d === '3' || d === '4') return Number(d);
    if (localStorage.getItem('level') === 'advanced') return 4; // 이관
  } catch {
    /* 무시 */
  }
  return 3;
}
function getInitialHint(): boolean {
  try {
    const h = localStorage.getItem('nb_hint');
    if (h === '1') return true;
    if (h === '0') return false;
    if (localStorage.getItem('level') === 'beginner') return true; // 이관
  } catch {
    /* 무시 */
  }
  return false;
}

export default function App() {
  const [digits, setDigitsPref] = useState<number>(getInitialDigits);
  const [hint, setHintPref] = useState<boolean>(getInitialHint);
  const { state, judgeGuess, toggleMemo, clearMemo, setHint, reset } = useGame(digits, hint);
  // GuessPad 입력칸·후보 메모를 새 판/자릿수 변경 시 비우는 신호(값이 바뀌면 리셋).
  const [padReset, setPadReset] = useState(0);
  const [section, setSection] = useState<Section>('solo');
  const [online, setOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  // 멀티 메뉴: 닉네임·자릿수·종류를 정하고 [방 만들기]/[코드 입력]/[로컬 진행] 중 하나로 진입(launch).
  const [gameType, setGameType] = useState<GameType>('duel');
  const [mNick, setMNick] = useState(() => {
    try {
      return localStorage.getItem('nb_nick') ?? '';
    } catch {
      return '';
    }
  });
  const [mDigits, setMDigits] = useState(3);
  const [mCode, setMCode] = useState('');
  // 코드 입력: IME(한글/안드로이드 예측 입력) 조합 중엔 값을 건드리지 않아야 입력이 안 씹힌다.
  const codeComposingRef = useRef(false);
  const normalizeCode = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [peeking, setPeeking] = useState(false);
  const persistNick = () => {
    try {
      localStorage.setItem('nb_nick', mNick.trim());
    } catch {
      /* 무시 */
    }
  };
  // 코드로 입장 — 방장이 만든 모드(스피드/턴제)를 먼저 조회해 그 모드로 자동 진입.
  const joinByCode = async () => {
    if (!online) {
      showNet('온라인은 네트워크 연결이 필요해요');
      return;
    }
    const c = mCode.trim().toUpperCase();
    if (c.length < 4) {
      showNet('코드 4자리를 입력해 주세요');
      return;
    }
    persistNick();
    setPeeking(true);
    const r = await peekRoom(c);
    setPeeking(false);
    if (!r.ok || !r.mode) {
      showNet(r.error ?? '입장에 실패했어요');
      return;
    }
    if (r.digits === 3 || r.digits === 4) setMDigits(r.digits);
    setLaunch({ conn: 'online', gameType: r.mode, action: 'join', code: c });
  };
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
  // 첫 방문이면 인트로 뒤에 튜토리얼을 자동으로 띄운다. 한 번 보면(닫으면) localStorage에 기록.
  const [seenRules, setSeenRules] = useState(() => {
    try {
      return !!localStorage.getItem('nb_seen_rules');
    } catch {
      return true;
    }
  });
  const markRulesSeen = () => {
    if (seenRules) return;
    setSeenRules(true);
    try {
      localStorage.setItem('nb_seen_rules', '1');
    } catch {
      /* 저장 불가 환경 무시 */
    }
  };
  const openRules = () => {
    setShowRules(true);
    markRulesSeen();
  };
  const closeRules = () => {
    setShowRules(false);
    markRulesSeen();
  };
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return !sessionStorage.getItem('nb_intro');
    } catch {
      return false;
    }
  });

  // 앱 아이콘이 바뀌면(ICON_VERSION↑) 기존 사용자에게 안내를 한 번 띄운다.
  //  - 설치 가능(브라우저·미설치)이면 [설치하기] 한 번에 네이티브 설치(새 아이콘).
  //  - 이미 설치(standalone)했으면 아이콘이 OS 캐시라 재설치를 강제할 API가 없어 수동 안내.
  const [iconPending, setIconPending] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  type InstallPrompt = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };
  const deferredPromptRef = useRef<InstallPrompt | null>(null);
  const markIconSeen = () => {
    try {
      localStorage.setItem('nb_icon_seen', ICON_VERSION);
    } catch {
      /* 무시 */
    }
  };
  useEffect(() => {
    try {
      if (localStorage.getItem('nb_icon_seen') === ICON_VERSION) return;
      setStandalone(
        window.matchMedia?.('(display-mode: standalone)').matches ||
          (navigator as unknown as { standalone?: boolean }).standalone === true,
      );
      // 이전에 써 본 흔적(=예전 버전으로 설치/이용)이 있어야 안내(완전 새 사용자는 이미 새 아이콘).
      const usedBefore = !!(
        localStorage.getItem('nb_seen_rules') ||
        localStorage.getItem('nb_digits') ||
        localStorage.getItem('nb_nick')
      );
      if (usedBefore) setIconPending(true);
      else markIconSeen();
    } catch {
      /* 무시 */
    }
  }, []);
  // 설치 가능 이벤트 캡처(크롬/안드로이드/데스크톱). iOS·이미 설치 상태에선 안 뜸.
  useEffect(() => {
    const onBIP = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as InstallPrompt;
      setCanInstall(true);
    };
    const onInstalled = () => {
      deferredPromptRef.current = null;
      setCanInstall(false);
      setIconPending(false);
      markIconSeen();
    };
    window.addEventListener('beforeinstallprompt', onBIP);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const dismissIconNotice = () => {
    setIconPending(false);
    markIconSeen();
  };
  const doInstall = async () => {
    const p = deferredPromptRef.current;
    if (!p) {
      dismissIconNotice();
      return;
    }
    p.prompt();
    try {
      await p.userChoice;
    } catch {
      /* 무시 */
    }
    deferredPromptRef.current = null;
    setCanInstall(false);
    dismissIconNotice();
  };
  // 설치된 PWA 안에선 설치 다이얼로그를 못 띄우므로, 외부 브라우저로 열어 거기서 설치하게 한다.
  const openInBrowser = () => {
    try {
      window.open(window.location.origin, '_blank', 'noopener');
    } catch {
      /* 무시 */
    }
  };
  const dismissIntro = () => {
    try {
      sessionStorage.setItem('nb_intro', '1');
    } catch {
      /* 저장 불가 환경 무시 */
    }
    setShowIntro(false);
  };
  // 첫 방문: 인트로가 닫힌 뒤 튜토리얼을 자동으로 한 번 띄운다(우상단 건너뛰기로 넘길 수 있음).
  const autoRulesRef = useRef(false);
  useEffect(() => {
    if (showIntro || seenRules || autoRulesRef.current) return;
    autoRulesRef.current = true;
    setShowRules(true);
  }, [showIntro, seenRules]);

  // 이스터에그: 라이트('주간') 모드. 다크가 무조건 기본 — 세션 한정이라 새로고침하면 다시 다크.
  // 'history' 라벨을 길게 눌러 전환.
  const [dayMode, setDayMode] = useState(false);
  const [eggMsg, setEggMsg] = useState<string | null>(null);
  const holdRef = useRef<number | undefined>(undefined);
  // 사용자가 실제로 테마를 토글했을 때만 토스트(마운트·StrictMode 재실행 땐 안 뜨게).
  const userToggledThemeRef = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    if (dayMode) root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dayMode ? '#eef1f5' : '#000000');
    if (!userToggledThemeRef.current) return;
    userToggledThemeRef.current = false;
    setEggMsg(dayMode ? '☀️ 라이트 모드' : '🌙 다크 모드');
    const t = window.setTimeout(() => setEggMsg(null), 1500);
    return () => window.clearTimeout(t);
  }, [dayMode]);

  const startHold = () => {
    holdRef.current = window.setTimeout(() => {
      userToggledThemeRef.current = true;
      setDayMode((v) => !v);
    }, 800);
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
  const [pendingDigits, setPendingDigits] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [hintInfo, setHintInfo] = useState(false);
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

  // 빈 판(진행 중 난이도 변경 확인용). 입력칸은 GuessPad 소유 → 기록·메모로만 판단.
  const pristine =
    state.status === 'playing' &&
    state.guesses.length === 0 &&
    Object.keys(state.memo).length === 0;

  const clearReveal = () => {
    if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current);
    setSoloReveal(null);
  };

  const newGame = () => {
    clearReveal();
    setPadReset((n) => n + 1);
    reset(digits, hint);
  };

  const persist = (key: string, val: string) => {
    try {
      localStorage.setItem(key, val);
    } catch {
      /* 저장 불가 환경 무시 */
    }
  };

  const doChangeDigits = (d: number) => {
    setDigitsPref(d);
    persist('nb_digits', String(d));
    clearReveal();
    setPadReset((n) => n + 1);
    reset(d, hint);
  };

  // 진행 중인 판(입력·추측·메모가 있는 상태)이면 확인창을 띄우고, 아니면 바로 바꾼다.
  const gameInProgress = state.status === 'playing' && !pristine;
  const changeDigits = (d: number) => {
    if (d === digits) return;
    if (gameInProgress) {
      setPendingDigits(d);
      return;
    }
    doChangeDigits(d);
  };

  // 힌트는 라이브 토글(새 판 안 함) — 이후 제출부터 적용.
  const changeHint = (h: boolean) => {
    if (h === hint) return;
    setHintPref(h);
    persist('nb_hint', h ? '1' : '0');
    setHint(h);
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
      <FieldBackdrop />
      {showIntro && <Intro onDone={dismissIntro} />}
      <header className="controls">
        <div className="controls-row">
          <div className="help-wrap">
            <button
              type="button"
              className={`help-btn${seenRules ? '' : ' pulse-hint'}`}
              onClick={openRules}
              aria-label="게임 방법"
              title="게임 방법"
            >
              ?
            </button>
            {!seenRules && (
              <span className="help-callout" role="status">
                게임 방법 확인! 👆
              </span>
            )}
          </div>
          <div className="seg" role="group" aria-label="모드 선택">
            <button
              type="button"
              className={`seg-btn${section === 'solo' ? ' active' : ''}`}
              aria-pressed={section === 'solo'}
              onClick={() => guardedSwitch(() => setSection('solo'))}
            >
              솔로
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
          {section === 'solo' ? (
            <button
              type="button"
              className="gear-btn"
              onClick={() => setShowSettings(true)}
              aria-label="설정"
              title="설정"
            >
              ⚙
            </button>
          ) : (
            <span className="gear-spacer" aria-hidden="true" />
          )}
        </div>

      </header>

      {section === 'solo' ? (
        <>
      {/* 상단: 전광판 — 기록, 게임 종료 시 결과 발표 */}
      <section className="history-section scoreboard">
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
        {finished ? (
          <div className="score-result">
            <ResultBanner
              status={state.status}
              secret={state.secret}
              attempts={state.guesses.length}
              onRestart={newGame}
            />
          </div>
        ) : (
          <History guesses={state.guesses} />
        )}
      </section>

      {/* 하단: 타자석 — 입력(게임 중에만). 입력·키패드·메모·후보는 공용 GuessPad. */}
      {!finished && (
        <GuessPad
          digits={state.digits}
          disabled={finished}
          resetSignal={padReset}
          onSubmit={judgeGuess}
          memo={state.memo}
          onMemoToggle={toggleMemo}
          onMemoClear={clearMemo}
          boardClass="batter-box"
          overlay={
            soloReveal ? (
              <div className="solo-reveal" aria-live="polite">
                <RevealCard
                  guess={soloReveal.guess}
                  judgement={soloReveal.judgement}
                  digits={state.digits}
                />
              </div>
            ) : undefined
          }
        />
      )}
        </>
      ) : launch === null ? (
        <div className="versus versus-center">
          <div className="online-menu-card">
            <label className="versus-field">
              <span className="versus-label">닉네임</span>
              <input
                className="online-input"
                value={mNick}
                maxLength={12}
                placeholder="플레이어"
                onChange={(e) => setMNick(e.target.value)}
              />
            </label>
            <div className="versus-field">
              <span className="versus-label">자릿수</span>
              <div className="seg" role="group" aria-label="자릿수">
                {[3, 4].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`seg-btn${mDigits === d ? ' active' : ''}`}
                    aria-pressed={mDigits === d}
                    onClick={() => setMDigits(d)}
                  >
                    {d}자리
                  </button>
                ))}
              </div>
            </div>
            <div className="versus-field">
              <span className="versus-label">종류</span>
              <div className="seg" role="group" aria-label="게임 종류">
                <button
                  type="button"
                  className={`seg-btn${gameType === 'speed' ? ' active' : ''}`}
                  aria-pressed={gameType === 'speed'}
                  onClick={() => setGameType('speed')}
                >
                  ⚡ 스피드
                </button>
                <button
                  type="button"
                  className={`seg-btn${gameType === 'duel' ? ' active' : ''}`}
                  aria-pressed={gameType === 'duel'}
                  onClick={() => setGameType('duel')}
                >
                  🥎 주고받기
                </button>
              </div>
            </div>
            {/* 종류 간단 설명 — 처음 보는 사람도 이해하게 */}
            <p className="mode-desc">
              {gameType === 'speed'
                ? '여럿이 같은 숫자를 동시에 풀어요. 적은 횟수로 먼저 맞히면 승리! (2~6명)'
                : '서로 상대가 맞힐 숫자를 정하고, 번갈아 맞혀요. 먼저 맞히면 승리! (1:1)'}
            </p>

            <button
              type="button"
              className={`versus-primary${online ? '' : ' disabled'}`}
              aria-disabled={!online}
              onClick={() => {
                if (!online) {
                  showNet('온라인은 네트워크 연결이 필요해요');
                  return;
                }
                persistNick();
                setLaunch({ conn: 'online', gameType, action: 'create' });
              }}
            >
              🚪 방 만들기
            </button>

            <div className="online-join">
              <input
                className="online-input online-code"
                value={mCode}
                maxLength={12}
                placeholder="CODE"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                onFocus={() => setMCode('')}
                onChange={(e) =>
                  setMCode(
                    codeComposingRef.current
                      ? e.target.value
                      : normalizeCode(e.target.value),
                  )
                }
                onCompositionStart={() => {
                  codeComposingRef.current = true;
                }}
                onCompositionEnd={(e) => {
                  codeComposingRef.current = false;
                  setMCode(normalizeCode(e.currentTarget.value));
                }}
              />
              <button
                type="button"
                className={`versus-secondary${online && !peeking ? '' : ' disabled'}`}
                aria-disabled={!online || peeking}
                onClick={joinByCode}
              >
                {peeking ? '확인 중…' : '코드로 입장'}
              </button>
            </div>

            <div className="online-or" aria-hidden="true"><span>또는</span></div>

            <button
              type="button"
              className="versus-secondary"
              onClick={() => setLaunch({ conn: 'local', gameType })}
            >
              📱 한 기기로 하기
            </button>
          </div>
        </div>
      ) : launch.conn === 'online' && launch.gameType === 'speed' ? (
        <OnlineSpeed
          entry={{ action: launch.action, nick: mNick, digits: mDigits, code: launch.code }}
          onExit={() => setLaunch(null)}
          onActiveChange={setOnlineActive}
        />
      ) : launch.conn === 'online' ? (
        <OnlineDuel
          entry={{ action: launch.action, nick: mNick, digits: mDigits, code: launch.code }}
          onExit={() => setLaunch(null)}
          onActiveChange={setOnlineActive}
        />
      ) : launch.gameType === 'speed' ? (
        <SpeedVersus onExit={() => setLaunch(null)} />
      ) : (
        <DuelVersus onExit={() => setLaunch(null)} />
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

      {iconPending && (
        <div className="reinstall-banner" role="status">
          <span className="reinstall-emoji" aria-hidden="true">⚾</span>
          <div className="reinstall-text">
            <b>{canInstall ? '새 아이콘으로 앱 설치하기!' : '앱 아이콘이 새로 바뀌었어요!'}</b>
            <span>
              {canInstall
                ? '한 번에 설치돼요.'
                : standalone
                ? '홈 화면 아이콘을 삭제한 뒤, 브라우저에서 다시 설치하면 적용돼요.'
                : '공유 메뉴 → “홈 화면에 추가”로 설치해요.'}
            </span>
          </div>
          {canInstall ? (
            <>
              <button type="button" className="reinstall-close" onClick={doInstall}>
                설치하기
              </button>
              <button
                type="button"
                className="reinstall-x"
                aria-label="닫기"
                onClick={dismissIconNotice}
              >
                ✕
              </button>
            </>
          ) : standalone ? (
            <>
              <button type="button" className="reinstall-close" onClick={openInBrowser}>
                브라우저에서 열기
              </button>
              <button
                type="button"
                className="reinstall-x"
                aria-label="닫기"
                onClick={dismissIconNotice}
              >
                ✕
              </button>
            </>
          ) : (
            <button type="button" className="reinstall-close ghost" onClick={dismissIconNotice}>
              확인
            </button>
          )}
        </div>
      )}

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

      {showRules && <RulesModal onClose={closeRules} />}

      {showSettings && (
        <div className="modal-backdrop" onClick={() => setShowSettings(false)}>
          <div
            className="settings-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="설정"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="settings-title">설정</h3>

            <div className="settings-row">
              <span className="settings-label">자릿수</span>
              <div className="seg" role="group" aria-label="자릿수">
                {[3, 4].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`seg-btn${digits === d ? ' active' : ''}`}
                    aria-pressed={digits === d}
                    onClick={() => changeDigits(d)}
                  >
                    {d}자리
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <span className="settings-label">
                힌트
                <button
                  type="button"
                  className={`info-btn${hintInfo ? ' on' : ''}`}
                  aria-label="힌트 설명"
                  aria-expanded={hintInfo}
                  onClick={() => setHintInfo((v) => !v)}
                >
                  ?
                </button>
              </span>
              <div className="seg" role="group" aria-label="힌트">
                <button
                  type="button"
                  className={`seg-btn${!hint ? ' active' : ''}`}
                  aria-pressed={!hint}
                  onClick={() => changeHint(false)}
                >
                  끔
                </button>
                <button
                  type="button"
                  className={`seg-btn${hint ? ' active' : ''}`}
                  aria-pressed={hint}
                  onClick={() => changeHint(true)}
                >
                  켬
                </button>
              </div>
            </div>
            {hintInfo && (
              <p className="settings-desc">
                넣은 숫자가 전부 아웃이면 그 숫자들에 ✕(없음)를, 모두 정답에 들어있으면 △(자리는 틀림)를 자동으로 표시해줘요.
              </p>
            )}

            <button
              type="button"
              className="versus-primary settings-newgame"
              onClick={() => {
                newGame();
                setShowSettings(false);
              }}
            >
              ↻ 새 게임
            </button>
            <button
              type="button"
              className="settings-close"
              onClick={() => setShowSettings(false)}
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {pendingDigits !== null && (
        <ConfirmDialog
          message={`진행 중인 게임이 있어요. ${pendingDigits}자리로 바꾸면 지금 판은 사라져요. 바꿀까요?`}
          confirmLabel="바꾸기"
          cancelLabel="취소"
          onConfirm={() => {
            const d = pendingDigits;
            setPendingDigits(null);
            doChangeDigits(d);
          }}
          onCancel={() => setPendingDigits(null)}
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
