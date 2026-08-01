import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { getSocket } from '../net/socket';
import {
  gameReducer,
  initGame,
  cycleMemoMark,
  toggleMemoMark,
  type GuessRecord,
  type MemoMark,
} from '../game/useGame';
import type { Judgement } from '../game/logic';
import { Keypad } from '../components/Keypad';
import { History } from '../components/History';
import { Seg7 } from '../components/Seg7';
import { RevealCard } from '../components/RevealCard';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { Outcome } from '../net/protocol';

interface Props {
  onExit: () => void;
  /** 대결이 진행 중(비밀 설정~플레이)인지 App에 알림 — 이탈 확인창용. */
  onActiveChange?: (active: boolean) => void;
}

type Phase = 'menu' | 'lobby' | 'secret' | 'playing' | 'over';
interface OverInfo {
  outcome: Outcome;
  secrets: (string | null)[];
  attempts: number[];
}
interface Reveal {
  by: 0 | 1;
  guess: string;
  judgement: Judgement;
  solved: boolean;
}

// 상대 대기 중 랜덤 멘트(이모지 없음, 야구 느낌).
const WAIT_PHRASES = [
  '상대 차례예요',
  '상대가 공을 고르는 중...',
  '상대가 고민하는 중...',
  '상대가 사인을 보는 중...',
  '상대가 신중하게 노리는 중...',
  '상대가 타석을 살피는 중...',
  '상대의 한 수를 기다리는 중...',
];

function Nick({ children }: { children: ReactNode }) {
  return <span className="nick">{children}</span>;
}

/** 숫자 문자열을 세그먼트 셀로. */
function NumCells({ value }: { value: string }) {
  return (
    <span className="num-cells">
      {value.split('').map((c, i) => (
        <span key={i} className="cell hcell">
          <Seg7 char={c} />
        </span>
      ))}
    </span>
  );
}

function LoadingDots() {
  return (
    <span className="loading-dots" aria-label="기다리는 중">
      <i />
      <i />
      <i />
    </span>
  );
}

/** 연결 상태 배너(내 재접속 중 / 상대 끊김). 정상이면 안 보임. */
function NetStatus({ connected, oppDisconnected }: { connected: boolean; oppDisconnected: boolean }) {
  if (!connected) return <div className="net-banner">재접속 중…</div>;
  if (oppDisconnected) return <div className="net-banner opp">상대 연결 끊김 — 대기 중…</div>;
  return null;
}

/** 상대 대기 멘트 — 몇 초마다 랜덤 교체. */
function WaitingLine() {
  const [i, setI] = useState(() => Math.floor(Math.random() * WAIT_PHRASES.length));
  useEffect(() => {
    const t = window.setInterval(() => {
      setI((v) => (v + 1 + Math.floor(Math.random() * (WAIT_PHRASES.length - 1))) % WAIT_PHRASES.length);
    }, 2600);
    return () => window.clearInterval(t);
  }, []);
  return <p className="wait-line">{WAIT_PHRASES[i]}</p>;
}

/**
 * 입력 칸 + 키패드. 위치를 고정하려고 항상 렌더한다.
 * - active(내 차례): 숫자 입력·제출 가능, ✎로 메모 토글.
 * - !active(상대 차례·발표 중): 입력·제출은 막고 숫자 탭은 메모만 순환(미리 메모용).
 */
function OnlineInput({
  digits,
  active = true,
  submitLabel,
  onSubmit,
  onChange,
  memo = {},
  onMemo,
  onClearMemo,
  showMemo = false,
  stage,
}: {
  digits: number;
  active?: boolean;
  submitLabel: string;
  onSubmit: (value: string) => void;
  onChange?: (value: string) => void;
  memo?: Record<string, MemoMark>;
  onMemo?: (d: string, mark: MemoMark) => void;
  onClearMemo?: () => void;
  showMemo?: boolean;
  /** 있으면 상단 '스테이지' 박스를 쓴다: 내 차례=입력 세그먼트, 아니면 이 노드(결과/대기 등). */
  stage?: ReactNode;
}) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    initGame('', Infinity, digits, false),
  );
  // 활성 메모 표시. 시작은 항상 '없음'(메모 버튼 안 눌린 상태) — 눌러서 표시 종류를 고른다.
  const [memoMark, setMemoMark] = useState<MemoMark | null>(null);
  const full = !state.slots.includes('');
  // 입력 변화를 부모에 알림(실시간 미리보기 중계용). 콜백 identity와 무관하게 최신값 사용.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    if (active) onChangeRef.current?.(state.slots.join(''));
  }, [state.slots, active]);

  const inputDisplay = (
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
          onClick={() => dispatch({ type: 'clearSlot', index: i })}
        >
          <Seg7 char={d} />
        </button>
      ))}
    </div>
  );

  return (
    <section className={`board${active ? '' : ' memo-only'}`}>
      {/* 스테이지 모드: 하나의 박스에서 내 차례=입력칸 / 아니면 결과·대기 노드가 전환. */}
      {stage !== undefined ? (
        <div className="play-stage">{active ? inputDisplay : stage}</div>
      ) : (
        active && inputDisplay
      )}
      <Keypad
        slots={active ? state.slots : Array(digits).fill('')}
        memo={memo}
        memoMark={memoMark}
        disabled={false}
        showMemo={showMemo}
        submitLabel={submitLabel}
        onDigit={(digit) => active && dispatch({ type: 'push', digit })}
        onMemo={(d) => memoMark && onMemo?.(d, memoMark)}
        onDelete={() => active && dispatch({ type: 'pop' })}
        onSubmit={() => active && full && onSubmit(state.slots.join(''))}
        onCycleMemo={() => setMemoMark((m) => cycleMemoMark(m, active))}
        markButtons={!active}
        onPickMark={(m) => setMemoMark((cur) => (cur === m ? null : m))}
        onClearMemo={onClearMemo}
      />
    </section>
  );
}

/** 메모 전용 키패드(입력칸 없음) — 비밀 정하는 동안 미리 메모용. */
function MemoPad({
  digits,
  memo,
  onMemo,
  onClearMemo,
}: {
  digits: number;
  memo: Record<string, MemoMark>;
  onMemo: (d: string, mark: MemoMark) => void;
  onClearMemo: () => void;
}) {
  const [memoMark, setMemoMark] = useState<MemoMark | null>(null);
  return (
    <Keypad
      slots={Array(digits).fill('')}
      memo={memo}
      memoMark={memoMark}
      disabled={false}
      showMemo
      submitLabel="확인"
      onDigit={() => {}}
      onMemo={(d) => memoMark && onMemo(d, memoMark)}
      onDelete={() => {}}
      onSubmit={() => {}}
      onCycleMemo={() => setMemoMark((m) => cycleMemoMark(m, false))}
      markButtons
      onPickMark={(m) => setMemoMark((cur) => (cur === m ? null : m))}
      onClearMemo={onClearMemo}
    />
  );
}

/** 내 숫자 훔쳐보기 방지 — 기본은 블러, 꾹 누르는 동안에만 보인다. */
function SecretPeek({ secret }: { secret: string }) {
  const [peeking, setPeeking] = useState(false);
  return (
    <div className="secret-peek">
      <span className="peek-label">내 숫자</span>
      <span
        className={`peek-value${peeking ? ' on' : ''}`}
        onClick={() => setPeeking((v) => !v)}
        onContextMenu={(e) => e.preventDefault()}
      >
        <NumCells value={secret} />
        {!peeking && <span className="peek-hint">눌러서 확인</span>}
      </span>
    </div>
  );
}

type Session = { code: string; index: 0 | 1; token: string };
// 세션을 sessionStorage에 저장 → 모바일 백그라운드로 탭이 리로드돼도 방으로 자동 복귀.
const SESSION_KEY = 'nb_online_session';
function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s && typeof s.code === 'string' && (s.index === 0 || s.index === 1) && typeof s.token === 'string') {
      return s;
    }
  } catch {
    /* 무시 */
  }
  return null;
}
function saveSession(s: Session | null) {
  try {
    if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* 무시 */
  }
}

/** 온라인 턴제 대결(방 코드). 서버가 정답을 쥐고 판정한다. */
export function OnlineDuel({ onExit, onActiveChange }: Props) {
  const socketRef = useRef(getSocket());
  const myIndexRef = useRef<0 | 1>(0);
  const announceRef = useRef<number | undefined>(undefined);
  const vsTimerRef = useRef<number | undefined>(undefined);
  // 재접속용 세션(코드·자리·토큰). 소켓이 끊겼다 붙으면 이걸로 다시 합류한다.
  // 저장돼 있으면(리로드 직후) 마운트 시 복원해 자동 rejoin.
  const sessionRef = useRef<Session | null>(loadSession());
  // 저장된 세션으로 복귀 시도 중 — 메뉴 대신 "재접속 중" 화면을 잠깐 보여준다.
  const [resuming, setResuming] = useState<boolean>(() => sessionRef.current !== null);

  const [phase, setPhase] = useState<Phase>('menu');
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nick, setNick] = useState(() => {
    try {
      return localStorage.getItem('nb_nick') ?? '';
    } catch {
      return '';
    }
  });
  const [digits, setDigits] = useState(3);
  const [joinCode, setJoinCode] = useState('');
  const [code, setCode] = useState('');
  const [myIndex, setMyIndex] = useState<0 | 1>(0);
  const [opponentNick, setOpponentNick] = useState('상대');

  const [mySecret, setMySecret] = useState('');
  const [mySecretSet, setMySecretSet] = useState(false);
  const [secretReady, setSecretReady] = useState<boolean[]>([false, false]);

  // 상대가 다 입장하면 잠깐 VS 대결 화면(매치업) 연출 후 비밀 정하기로.
  const [vsIntro, setVsIntro] = useState(false);
  const [startAnnounce, setStartAnnounce] = useState(false);
  const [myTurn, setMyTurn] = useState(false);
  const [history, setHistory] = useState<GuessRecord[]>([]);
  const [oppAttempts, setOppAttempts] = useState(0);
  const [oppSolved, setOppSolved] = useState(false);
  const [mySolved, setMySolved] = useState(false);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [oppInput, setOppInput] = useState('');
  const [oppHistory, setOppHistory] = useState<GuessRecord[]>([]);
  const [oppDisconnected, setOppDisconnected] = useState(false);
  const [histTab, setHistTab] = useState<'me' | 'opp'>('me');

  const [over, setOver] = useState<OverInfo | null>(null);
  const [oppLeft, setOppLeft] = useState(false);
  // 상대 이탈 종류: 자발적 나가기 vs 연결 끊김(유예 초과). 결과 문구용.
  const [leftKind, setLeftKind] = useState<'left' | 'disconnected'>('left');
  // oppDisconnected 최신값(콜백에서 stale 없이 읽으려고 ref로 동기화).
  const oppDisconnectedRef = useRef(false);
  const [rematchWait, setRematchWait] = useState(false);
  const [oppWantsRematch, setOppWantsRematch] = useState(false);
  const [copied, setCopied] = useState(false);
  // 대결(비밀·플레이) 중 나가기 확인창.
  const [confirmLeave, setConfirmLeave] = useState(false);
  // 메모(내 추측용) — 게임 내내 유지, 새 판마다 초기화.
  const [memo, setMemo] = useState<Record<string, MemoMark>>({});

  const resetRound = () => {
    setHistory([]);
    setOppAttempts(0);
    setOppSolved(false);
    setMySolved(false);
    setReveal(null);
    setOppInput('');
    setOppHistory([]);
    setMySecret('');
    setMySecretSet(false);
    setSecretReady([false, false]);
    setOver(null);
    setOppLeft(false);
    setLeftKind('left');
    setRematchWait(false);
    setOppWantsRematch(false);
    setStartAnnounce(false);
    setVsIntro(false);
    setMemo({});
    setOppDisconnected(false);
    setHistTab('me');
    setConfirmLeave(false);
  };

  // 재접속 후 서버가 준 현재 상태로 화면을 되돌린다(놓친 진행 동기화).
  const applyResume = (r: import('../net/protocol').ResumeInfo) => {
    setDigits(r.digits);
    setOpponentNick(r.opponentNick);
    // 로비(상대 아직 없음)에선 상대 끊김 배너 띄우지 않음.
    setOppDisconnected(r.phase !== 'lobby' && !r.opponentConnected);
    setSecretReady(r.secretReady);
    setOppAttempts(r.oppAttempts);
    setOppSolved(r.oppSolved);
    setOppHistory(r.oppHistory);
    if (r.phase === 'over' && r.over) {
      setReveal(null);
      setStartAnnounce(false);
      setOver(r.over);
      setPhase('over');
    } else if (r.phase === 'playing') {
      setReveal(null);
      setStartAnnounce(false);
      setMyTurn(r.turn === myIndexRef.current);
      setPhase('playing');
    } else if (r.phase === 'secret') {
      setMySecretSet(r.mySecretSet);
      setPhase('secret');
    } else {
      setPhase('lobby');
    }
  };

  const toggleMemo = (d: string, mark: MemoMark) =>
    setMemo((m) => toggleMemoMark(m, d, mark));
  const clearMemo = () => setMemo({});

  useEffect(() => {
    const s = socketRef.current;
    const onConnect = () => {
      setConnected(true);
      // 세션이 있으면(게임 중 재연결·리로드 복귀) 저장한 코드·자리·토큰으로 다시 합류.
      const sess = sessionRef.current;
      if (!sess) return;
      myIndexRef.current = sess.index;
      setMyIndex(sess.index);
      s.emit('rejoin', { code: sess.code, index: sess.index, token: sess.token }, (r) => {
        setResuming(false);
        if (r.ok && r.resume) {
          applyResume(r.resume);
        } else {
          // 방이 만료(유예 초과)·삭제됨 → 대기 상태에 갇히지 않게 메뉴로.
          sessionRef.current = null;
          saveSession(null);
          setOppDisconnected(false);
          setError('방이 만료됐어요. 다시 만들거나 코드로 입장해주세요.');
          setPhase('menu');
        }
      });
    };
    const onDisconnect = () => setConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('opponentDisconnected', () => setOppDisconnected(true));
    s.on('opponentReconnected', () => setOppDisconnected(false));
    s.on('opponentJoined', ({ nick: n }) => setOpponentNick(n));
    s.on('phase', ({ digits: d }) => {
      setDigits(d);
      resetRound();
      // 매치업(VS) 연출 → '시작하기' 버튼으로 넘어감(안 누르면 안전장치로 오래 뒤 자동).
      setVsIntro(true);
      if (vsTimerRef.current) window.clearTimeout(vsTimerRef.current);
      vsTimerRef.current = window.setTimeout(() => setVsIntro(false), 12000);
      setPhase('secret');
    });
    s.on('secretProgress', ({ ready }) => setSecretReady(ready));
    s.on('start', ({ turn, digits: d }) => {
      setDigits(d);
      setHistory([]);
      setOppAttempts(0);
      setOppSolved(false);
      setMySolved(false);
      setReveal(null);
      setMyTurn(turn === myIndexRef.current);
      setOppInput('');
      setPhase('playing');
      // "모두 골랐어요! 누구 먼저" 잠깐 발표
      setStartAnnounce(true);
      if (announceRef.current) window.clearTimeout(announceRef.current);
      announceRef.current = window.setTimeout(() => setStartAnnounce(false), 2200);
    });
    s.on('reveal', ({ by, guess, judgement, solved, attempts }) => {
      if (by === myIndexRef.current) {
        setHistory((h) => [...h, { guess, judgement }]);
        if (solved) setMySolved(true);
      } else {
        setOppAttempts(attempts);
        setOppHistory((h) => [...h, { guess, judgement }]);
        if (solved) setOppSolved(true);
      }
      setReveal({ by, guess, judgement, solved });
      setOppInput('');
    });
    s.on('opponentInput', ({ value }) => setOppInput(value));
    s.on('turn', ({ turn }) => {
      setReveal(null);
      setOppInput('');
      setMyTurn(turn === myIndexRef.current);
    });
    s.on('over', (p) => {
      setReveal(null);
      setOver(p);
      setPhase('over');
    });
    s.on('rematchRequested', () => setOppWantsRematch(true));
    s.on('opponentLeft', () => {
      sessionRef.current = null;
      saveSession(null);
      // 끊김(유예 중)에서 넘어온 이탈이면 '연결 끊김', 아니면 '나감'.
      setLeftKind(oppDisconnectedRef.current ? 'disconnected' : 'left');
      setOppDisconnected(false);
      setOppLeft(true);
      setPhase('over');
    });
    s.on('errorMsg', ({ message }) => setError(message));

    s.connect();
    // 저장된 세션으로 복귀 시도가 너무 오래 걸리면(연결 실패 등) 메뉴로 풀어준다.
    let resumeTimer: number | undefined;
    if (sessionRef.current) {
      resumeTimer = window.setTimeout(() => {
        setResuming((was) => {
          if (was) setError('방에 다시 연결하지 못했어요. 코드로 다시 입장해주세요.');
          return false;
        });
      }, 9000);
    }
    return () => {
      if (resumeTimer) window.clearTimeout(resumeTimer);
      if (announceRef.current) window.clearTimeout(announceRef.current);
      if (vsTimerRef.current) window.clearTimeout(vsTimerRef.current);
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('opponentDisconnected');
      s.off('opponentReconnected');
      s.off('opponentJoined');
      s.off('phase');
      s.off('secretProgress');
      s.off('start');
      s.off('reveal');
      s.off('opponentInput');
      s.off('turn');
      s.off('over');
      s.off('rematchRequested');
      s.off('opponentLeft');
      s.off('errorMsg');
      s.disconnect();
    };
  }, []);

  // oppDisconnected 최신값을 ref에 동기화(opponentLeft 콜백에서 끊김 여부 판별용).
  useEffect(() => {
    oppDisconnectedRef.current = oppDisconnected;
  }, [oppDisconnected]);

  // 대결 진행 중(비밀 설정~플레이) 알림 + 브라우저 이탈(뒤로가기·새로고침·닫기) 경고.
  const active = phase === 'secret' || phase === 'playing';
  const onActiveRef = useRef(onActiveChange);
  onActiveRef.current = onActiveChange;
  useEffect(() => {
    onActiveRef.current?.(active);
    if (!active) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [active]);
  useEffect(() => () => onActiveRef.current?.(false), []);

  // 브라우저 뒤로가기를 잡아 확인창을 띄운다(진짜로 페이지를 벗어나지 않게 다시 상태를 쌓음).
  // 대결(비밀·플레이) 중에만. 확인창에서 '나가기'를 눌러야 backToMenu로 실제 이탈.
  const inMatch = phase === 'secret' || phase === 'playing';
  useEffect(() => {
    if (!inMatch) return;
    window.history.pushState({ nbGuard: true }, '');
    const onPop = () => {
      setConfirmLeave(true);
      window.history.pushState({ nbGuard: true }, '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [inMatch]);

  const saveNick = () => {
    try {
      localStorage.setItem('nb_nick', nick.trim());
    } catch {
      /* 무시 */
    }
  };

  const doCreate = () => {
    setBusy(true);
    setError(null);
    saveNick();
    socketRef.current.emit('create', { nick, digits }, (r) => {
      setBusy(false);
      if (r.ok) {
        sessionRef.current = { code: r.code, index: 0, token: r.token };
        saveSession(sessionRef.current);
        setCode(r.code);
        myIndexRef.current = 0;
        setMyIndex(0);
        setPhase('lobby');
      }
    });
  };

  const doJoin = () => {
    const c = joinCode.toUpperCase().trim();
    if (c.length < 4) {
      setError('코드 4자리를 입력해주세요.');
      return;
    }
    setBusy(true);
    setError(null);
    saveNick();
    socketRef.current.emit('join', { nick, code: c }, (r) => {
      setBusy(false);
      if (!r.ok) {
        setError(r.error ?? '입장에 실패했어요.');
        return;
      }
      sessionRef.current = { code: r.code ?? c, index: 1, token: r.token ?? '' };
      saveSession(sessionRef.current);
      setCode(r.code ?? c);
      myIndexRef.current = 1;
      setMyIndex(1);
      if (r.digits) setDigits(r.digits);
      if (r.opponentNick) setOpponentNick(r.opponentNick);
    });
  };

  const submitSecret = (secret: string) => {
    setError(null);
    socketRef.current.emit('setSecret', { secret }, (r) => {
      if (r.ok) {
        setMySecret(secret);
        setMySecretSet(true);
      } else setError(r.error ?? '오류가 발생했어요.');
    });
  };

  const submitGuess = (guess: string) => {
    setError(null);
    socketRef.current.emit('guess', { guess }, (r) => {
      if (!r.ok) setError(r.error ?? '오류가 발생했어요.');
    });
  };

  // 추측 입력 중간 상태를 상대에게 중계(실시간 미리보기).
  const emitInput = (value: string) => {
    socketRef.current.emit('input', { value });
  };

  const rematch = () => {
    setRematchWait(true);
    setOppLeft(false);
    socketRef.current.emit('rematch');
  };

  const copyCode = () => {
    try {
      navigator.clipboard?.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 클립보드 불가 환경 무시 */
    }
  };

  const exit = () => {
    sessionRef.current = null;
    saveSession(null);
    // 의도적 나가기를 서버에 알린 뒤(상대에게 즉시 '나감') 종료. ack 못 받아도 폴백으로 진행.
    const s = socketRef.current;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onExit(); // 언마운트 정리에서 소켓 disconnect
    };
    s.emit('leave', finish);
    window.setTimeout(finish, 400);
  };

  // 방/게임에서 나가되 온라인 메뉴로 복귀(멀티 유지). 서버 방은 정리되고 상대에겐 즉시 알림.
  // 소켓은 끊지 않고 유지(메뉴에서 바로 방 만들기/입장 가능) — leave로 서버 자리만 비운다.
  const backToMenu = () => {
    sessionRef.current = null;
    saveSession(null);
    setResuming(false);
    socketRef.current.emit('leave', () => {});
    resetRound();
    setCode('');
    setJoinCode('');
    setOpponentNick('상대');
    setMyIndex(0);
    myIndexRef.current = 0;
    setError(null);
    setPhase('menu');
  };

  // 대결 중 나가기(비밀·플레이). 상대 끊김으로 대기에 갇혔을 때도 빠져나갈 길.
  const matchExitBtn = (
    <button type="button" className="turn-exit" onClick={() => setConfirmLeave(true)}>
      나가기
    </button>
  );
  const leaveConfirm = confirmLeave && (
    <ConfirmDialog
      message="대결에서 나갈까요? 상대에게 알리고 온라인 메뉴로 돌아가요."
      confirmLabel="나가기"
      cancelLabel="계속하기"
      onConfirm={() => {
        setConfirmLeave(false);
        backToMenu();
      }}
      onCancel={() => setConfirmLeave(false)}
    />
  );

  // ---------- 렌더 ----------
  // 저장된 세션으로 복귀 시도 중(리로드 직후) — 메뉴 대신 재접속 화면.
  if (resuming && phase === 'menu') {
    return (
      <div className="versus versus-center">
        <NetStatus connected={connected} oppDisconnected={false} />
        <LoadingDots />
        <p className="wait-line">방에 다시 연결하는 중…</p>
        <button type="button" className="versus-secondary" onClick={backToMenu}>
          취소
        </button>
      </div>
    );
  }
  if (phase === 'menu') {
    return (
      <div className="versus">
        <h2 className="versus-title">온라인 대결 🌐</h2>
        <p className="versus-desc">
          방을 만들어 코드를 공유하거나, 친구 코드로 입장하세요. 서버가 정답을 지켜 공정하게 판정해요.
        </p>
        <p className={`online-status${connected ? ' on' : ''}`}>
          {connected ? '● 서버 연결됨' : '○ 서버 연결 중…'}
        </p>

        <div className="versus-field">
          <span className="versus-label">닉네임</span>
          <input
            className="online-input"
            value={nick}
            maxLength={12}
            placeholder="플레이어"
            onChange={(e) => setNick(e.target.value)}
          />
        </div>
        <div className="versus-field">
          <span className="versus-label">자릿수</span>
          <div className="seg" role="group" aria-label="자릿수">
            {[3, 4].map((d) => (
              <button
                key={d}
                type="button"
                className={`seg-btn${digits === d ? ' active' : ''}`}
                onClick={() => setDigits(d)}
              >
                {d}자리
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="versus-primary"
          disabled={!connected || busy}
          onClick={doCreate}
        >
          방 만들기
        </button>

        <div className="online-join">
          <input
            className="online-input online-code"
            value={joinCode}
            maxLength={4}
            placeholder="코드"
            autoCapitalize="characters"
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          <button
            type="button"
            className="versus-secondary"
            disabled={!connected || busy}
            onClick={doJoin}
          >
            코드로 입장
          </button>
        </div>

        {error && <p className="online-error">{error}</p>}
        <button type="button" className="versus-secondary" onClick={exit}>
          나가기
        </button>
      </div>
    );
  }

  if (phase === 'lobby') {
    return (
      <div className="versus versus-center">
        <NetStatus connected={connected} oppDisconnected={oppDisconnected} />
        <p className="handoff-sub">상대를 기다리는 중…</p>
        <div className="room-code" aria-label={`방 코드 ${code}`}>
          {code}
        </div>
        <button type="button" className="copy-btn" onClick={copyCode}>
          {copied ? '복사됐어요!' : '코드 복사'}
        </button>
        <LoadingDots />
        <p className="versus-desc">이 코드를 상대에게 알려주세요. 상대가 입장하면 시작돼요.</p>
        <button type="button" className="versus-secondary" onClick={backToMenu}>
          나가기
        </button>
      </div>
    );
  }

  if (phase === 'secret' && vsIntro) {
    const myNick = nick.trim() || '나';
    const dismissVs = () => {
      if (vsTimerRef.current) window.clearTimeout(vsTimerRef.current);
      setVsIntro(false);
    };
    return (
      <div className="versus versus-center vs-intro">
        <NetStatus connected={connected} oppDisconnected={oppDisconnected} />
        <p className="vs-ready">대결 상대를 만났어요!</p>
        <div className="vs-stage">
          <div className="vs-name top">
            <span className="vs-name-tag">나</span>
            <span className="vs-name-text">{myNick}</span>
          </div>
          <div className="vs-core" aria-label="VS">
            <span>V</span>
            <span>S</span>
          </div>
          <div className="vs-name bottom">
            <span className="vs-name-tag">상대</span>
            <span className="vs-name-text">{opponentNick}</span>
          </div>
        </div>
        <p className="vs-sub">{digits}자리 · 서로의 숫자를 맞혀라</p>
        <button type="button" className="versus-primary vs-go" onClick={dismissVs}>
          시작하기 ▶
        </button>
      </div>
    );
  }

  if (phase === 'secret') {
    const readyCount = secretReady.filter(Boolean).length;
    const oppReady = secretReady[1 - myIndex];
    return (
      <div className="versus">
        <NetStatus connected={connected} oppDisconnected={oppDisconnected} />
        <div className="turn-bar">
          <span className="turn-who">숫자 정하기</span>
          <div className="turn-right">
            <span
              key={readyCount}
              className={`turn-hint ready-count${oppReady ? ' hot' : ''}`}
            >
              준비 {readyCount}/2
            </span>
            {matchExitBtn}
          </div>
        </div>
        {oppReady && <p className="ready-note">상대가 숫자를 정했어요!</p>}
        {mySecretSet ? (
          <>
            <div className="versus versus-center">
              <LoadingDots />
              <p className="wait-line">상대가 숫자를 정하는 중…</p>
            </div>
            <p className="memo-hint">미리 메모해두세요</p>
            <MemoPad digits={digits} memo={memo} onMemo={toggleMemo} onClearMemo={clearMemo} />
          </>
        ) : (
          <>
            <p className="versus-desc">
              상대가 맞힐 나의 숫자를 정하세요(서로 다른 {digits === 4 ? '네' : '세'} 자리, 맨 앞 0
              제외).
            </p>
            <OnlineInput digits={digits} submitLabel="확인" onSubmit={submitSecret} />
          </>
        )}
        {error && <p className="online-error">{error}</p>}
        {leaveConfirm}
      </div>
    );
  }

  if (phase === 'playing') {
    const firstNick = myIndex === 0 ? nick.trim() || '나' : opponentNick;
    // 내 차례이고 발표/개시 중이 아니면 입력 활성. 그 외엔 키패드를 메모 전용으로 항상 띄운다.
    const inputActive = myTurn && !reveal && !startAnnounce;
    // 스테이지 박스에 내 차례가 아닐 때 보여줄 내용(발표/개시/상대입력·대기).
    const stageContent = startAnnounce ? (
      <div className="announce">
        <p className="announce-line">모두 숫자를 골랐어요!</p>
        <p className="announce-first">
          {myIndex === 0 ? '내가' : <Nick>{firstNick}</Nick>} 먼저 시작!
        </p>
      </div>
    ) : reveal ? (
      <RevealCard
        guess={reveal.guess}
        judgement={reveal.judgement}
        digits={digits}
        solved={reveal.solved}
        who={
          reveal.by === myIndex ? (
            '내 결과'
          ) : (
            <>
              <Nick>{opponentNick}</Nick>의 결과
            </>
          )
        }
      />
    ) : oppInput ? (
      <div className="live-input">
        <span className="live-label">
          상대 입력 중
          <span className="live-dots" aria-hidden="true">
            <i>.</i>
            <i>.</i>
            <i>.</i>
          </span>
        </span>
        <span className="num-cells">
          {Array.from({ length: digits }, (_, i) => (
            // key에 글자 포함 → 그 칸 글자가 바뀔 때만 remount. 애니메이션은 글자 든 칸('lit')만.
            <span
              key={`${i}-${oppInput[i] ?? ''}`}
              className={`cell hcell${oppInput[i] ? ' lit' : ''}`}
            >
              <Seg7 char={oppInput[i] ?? ''} />
            </span>
          ))}
        </span>
      </div>
    ) : (
      <>
        <LoadingDots />
        <WaitingLine />
      </>
    );
    // 긴장 배너(역전 찬스 / 마지막 기회) — 스테이지 위에 별도로.
    const tension =
      !reveal && !startAnnounce
        ? myTurn && oppSolved
          ? '⚡ 역전 찬스! 맞히면 무승부'
          : !myTurn && mySolved
          ? '⏳ 상대의 마지막 기회…'
          : null
        : null;
    return (
      <div className="versus">
        <NetStatus connected={connected} oppDisconnected={oppDisconnected} />
        <div
          className={`turn-bar${
            reveal || startAnnounce ? '' : myTurn ? ' my-turn' : ' opp-turn'
          }`}
        >
          <span className="turn-who">
            {reveal
              ? '결과 발표'
              : startAnnounce
              ? '플레이 볼!'
              : myTurn
              ? '내 차례'
              : `${opponentNick} 차례`}
          </span>
          <div className="turn-right">
            {(oppSolved || oppAttempts > 0) && (
              <span className="turn-hint">
                {oppSolved ? `${opponentNick} 맞힘!` : `${opponentNick} ${oppAttempts}회`}
              </span>
            )}
            {matchExitBtn}
          </div>
        </div>

        {mySecret && <SecretPeek secret={mySecret} />}

        {tension && (
          <div className={`tension ${myTurn ? 'reverse' : 'last'}`}>{tension}</div>
        )}

        {/* 스테이지 박스 + 고정 키패드 — 하나의 박스에서 내 차례=입력칸 / 결과·대기가 전환. */}
        <OnlineInput
          key={`${history.length}-${inputActive ? 'in' : 'memo'}`}
          digits={digits}
          active={inputActive}
          submitLabel={inputActive ? '추측' : '대기'}
          onSubmit={submitGuess}
          onChange={emitInput}
          memo={memo}
          onMemo={toggleMemo}
          onClearMemo={clearMemo}
          showMemo
          stage={stageContent}
        />
        {!inputActive && !startAnnounce && (
          <p className="memo-hint under-keypad">미리 메모해두세요</p>
        )}

        {/* 기록 — 내/상대 탭으로 분리(헷갈림 방지), 자리 고정. */}
        <section className="history-section">
          <div className="hist-tabs" role="tablist" aria-label="기록">
            <button
              type="button"
              role="tab"
              aria-selected={histTab === 'me'}
              className={`hist-tab${histTab === 'me' ? ' active' : ''}`}
              onClick={() => setHistTab('me')}
            >
              내 기록 <span className="ht-count">{history.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={histTab === 'opp'}
              className={`hist-tab${histTab === 'opp' ? ' active' : ''}`}
              onClick={() => setHistTab('opp')}
            >
              <Nick>{opponentNick}</Nick> <span className="ht-count">{oppHistory.length}</span>
            </button>
          </div>
          <History guesses={histTab === 'me' ? history : oppHistory} />
        </section>
        {error && <p className="online-error">{error}</p>}
        {leaveConfirm}
      </div>
    );
  }

  // over — 결과가 없는데 상대가 나갔으면(중도 이탈) 전용 결과 발표 화면.
  if (oppLeft && !over) {
    const disc = leftKind === 'disconnected';
    return (
      <div className="online-result forfeit">
        <div className="forfeit-emblem">{disc ? '🔌' : '🚪'}</div>
        <h2 className="result-headline">{disc ? '상대 연결 끊김' : '상대가 나갔어요'}</h2>
        <p className="forfeit-desc">
          {disc
            ? '상대방의 연결이 끊겨 대결이 종료됐어요.'
            : '상대가 대결에서 나가 종료됐어요.'}
        </p>
        <button
          type="button"
          className="versus-primary result-restart"
          onClick={backToMenu}
        >
          나가기
        </button>
      </div>
    );
  }
  if (!over) return null;

  const draw = over.outcome === 'draw';
  const iWon = over.outcome === myIndex;
  const entries = [
    {
      key: 'me',
      name: nick.trim() || '나',
      secret: over.secrets[myIndex] ?? '',
      attempts: over.attempts[myIndex],
      winner: !draw && iWon,
    },
    {
      key: 'opp',
      name: opponentNick,
      secret: over.secrets[1 - myIndex] ?? '',
      attempts: over.attempts[1 - myIndex],
      winner: !draw && !iWon,
    },
  ];
  if (!draw) entries.sort((a, b) => (b.winner ? 1 : 0) - (a.winner ? 1 : 0));

  return (
    <div className={`online-result ${draw ? 'draw' : iWon ? 'win' : 'lose'}`}>
      <div className="result-emblem">{draw ? '🤝' : iWon ? '🏆' : '😢'}</div>
      <h2 className="result-headline">{draw ? '무승부' : iWon ? '승리!' : '패배'}</h2>

      <div className="result-players">
        {entries.map((e) => (
          <div key={e.key} className={`rp-card${e.winner ? ' winner' : ''}${draw ? ' draw' : ''}`}>
            {e.winner && <span className="rp-badge">WIN</span>}
            <span className="rp-name">{e.name}</span>
            <NumCells value={e.secret} />
            <span className="rp-attempts">{e.attempts}회</span>
          </div>
        ))}
      </div>

      {oppLeft ? (
        <p className="rematch-notice">상대가 나갔어요. 재대결할 수 없어요.</p>
      ) : (
        oppWantsRematch &&
        !rematchWait && (
          <p className="rematch-notice">
            <Nick>{opponentNick}</Nick>가 재대결을 신청했어요!
          </p>
        )
      )}
      <div className="versus-actions">
        <button type="button" className="versus-secondary" onClick={backToMenu}>
          나가기
        </button>
        <button
          type="button"
          className={`versus-primary${
            oppWantsRematch && !rematchWait && !oppLeft ? ' pulse' : ''
          }`}
          disabled={rematchWait || oppLeft}
          onClick={rematch}
        >
          {rematchWait ? '상대 대기…' : oppWantsRematch ? '재대결 수락' : '재대결'}
        </button>
      </div>
    </div>
  );
}
