import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { getSocket } from '../net/socket';
import { gameReducer, initGame, type GuessRecord, type MemoMark } from '../game/useGame';
import type { Judgement } from '../game/logic';
import { Keypad } from '../components/Keypad';
import { History } from '../components/History';
import { Seg7 } from '../components/Seg7';
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

/** 특이 이벤트에만 강조 멘트(평범하면 null → 멘트 없음). */
function eventReaction(
  j: Judgement,
  digits: number,
  solved: boolean,
): { text: string; kind: string } | null {
  if (solved) return { text: '정답!', kind: 'win' };
  if (j.isOut) return { text: digits >= 4 ? '포 아웃' : '쓰리 아웃', kind: 'out' };
  if (j.balls === digits) return { text: '올 볼', kind: 'ball' };
  if (j.strikes === digits - 1) return { text: '한 끗 차이!', kind: 'near' };
  return null;
}

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

const SBO = [
  { key: 'strike', letter: 'S' },
  { key: 'ball', letter: 'B' },
  { key: 'out', letter: 'O' },
] as const;

/** 추측 발표 카드 — 큰 S/B/O + 특이 이벤트 강조. */
function RevealCard({
  reveal,
  digits,
  mine,
  opponentNick,
}: {
  reveal: Reveal;
  digits: number;
  mine: boolean;
  opponentNick: string;
}) {
  const s = reveal.judgement.strikes;
  const b = reveal.judgement.balls;
  const counts: Record<string, number> = { strike: s, ball: b, out: digits - s - b };
  const react = eventReaction(reveal.judgement, digits, reveal.solved);

  return (
    <div
      className={`reveal-card${reveal.solved ? ' solved' : ''}${mine ? ' mine' : ' theirs'}${
        react ? ` event-${react.kind}` : ''
      }`}
    >
      <p className="reveal-who">
        {mine ? '내 결과' : <><Nick>{opponentNick}</Nick>의 결과</>}
      </p>
      <NumCells value={reveal.guess} />
      <div className="sbo reveal-sbo">
        {SBO.map(({ key, letter }) => (
          <span key={key} className={`hsbo lamp-${key}${counts[key] === 0 ? ' zero' : ''}`}>
            <span className="hsbo-letter">{letter}</span>
            <span className="bulbs">
              {Array.from({ length: digits }, (_, k) => (
                <span key={k} className={`bulb${k < counts[key] ? ' on' : ''}`} />
              ))}
            </span>
          </span>
        ))}
      </div>
      {react && <p className={`reveal-reaction react-${react.kind}`}>{react.text}</p>}
    </div>
  );
}

/** 입력 칸 + 키패드. 다 채우면 onSubmit. 메모는 부모에서 관리(추측 시에만). */
function OnlineInput({
  digits,
  submitLabel,
  onSubmit,
  onChange,
  memo = {},
  memoMode = false,
  onMemo,
  onToggleMemo,
  showMemo = false,
}: {
  digits: number;
  submitLabel: string;
  onSubmit: (value: string) => void;
  onChange?: (value: string) => void;
  memo?: Record<string, MemoMark>;
  memoMode?: boolean;
  onMemo?: (d: string) => void;
  onToggleMemo?: () => void;
  showMemo?: boolean;
}) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    initGame('', Infinity, digits, false),
  );
  const full = !state.slots.includes('');
  // 입력 변화를 부모에 알림(실시간 미리보기 중계용). 콜백 identity와 무관하게 최신값 사용.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    onChangeRef.current?.(state.slots.join(''));
  }, [state.slots]);
  return (
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
            disabled={!d}
            aria-label={d ? `${i + 1}번째 칸 ${d} 지우기` : `${i + 1}번째 빈 칸`}
            onClick={() => dispatch({ type: 'clearSlot', index: i })}
          >
            <Seg7 char={d} />
          </button>
        ))}
      </div>
      <Keypad
        slots={state.slots}
        memo={memo}
        mode={memoMode ? 'memo' : 'input'}
        disabled={false}
        showMemo={showMemo}
        submitLabel={submitLabel}
        onDigit={(digit) => dispatch({ type: 'push', digit })}
        onMemo={(d) => onMemo?.(d)}
        onDelete={() => dispatch({ type: 'pop' })}
        onSubmit={() => full && onSubmit(state.slots.join(''))}
        onToggleMemo={onToggleMemo}
      />
    </section>
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

/** 온라인 턴제 대결(방 코드). 서버가 정답을 쥐고 판정한다. */
export function OnlineDuel({ onExit, onActiveChange }: Props) {
  const socketRef = useRef(getSocket());
  const myIndexRef = useRef<0 | 1>(0);
  const announceRef = useRef<number | undefined>(undefined);
  // 재접속용 세션(코드·자리·토큰). 소켓이 끊겼다 붙으면 이걸로 다시 합류한다.
  const sessionRef = useRef<{ code: string; index: 0 | 1; token: string } | null>(null);

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

  const [over, setOver] = useState<OverInfo | null>(null);
  const [oppLeft, setOppLeft] = useState(false);
  const [rematchWait, setRematchWait] = useState(false);
  const [oppWantsRematch, setOppWantsRematch] = useState(false);
  const [copied, setCopied] = useState(false);
  // 메모(내 추측용) — 게임 내내 유지, 새 판마다 초기화.
  const [memo, setMemo] = useState<Record<string, MemoMark>>({});
  const [memoMode, setMemoMode] = useState(false);

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
    setRematchWait(false);
    setOppWantsRematch(false);
    setStartAnnounce(false);
    setMemo({});
    setMemoMode(false);
    setOppDisconnected(false);
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

  const cycleMemo = (d: string) =>
    setMemo((m) => {
      const cur = m[d];
      const next: MemoMark | undefined =
        cur === undefined ? 'strike' : cur === 'strike' ? 'ball' : cur === 'ball' ? 'out' : undefined;
      const nm = { ...m };
      if (next === undefined) delete nm[d];
      else nm[d] = next;
      return nm;
    });

  useEffect(() => {
    const s = socketRef.current;
    const onConnect = () => {
      setConnected(true);
      // 세션이 있으면(게임 중 재연결) 저장한 코드·자리·토큰으로 다시 합류.
      const sess = sessionRef.current;
      if (!sess) return;
      s.emit('rejoin', { code: sess.code, index: sess.index, token: sess.token }, (r) => {
        if (r.ok && r.resume) {
          applyResume(r.resume);
        } else {
          // 방이 만료(유예 초과)·삭제됨 → 대기 상태에 갇히지 않게 메뉴로.
          sessionRef.current = null;
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
      setOppDisconnected(false);
      setOppLeft(true);
      setPhase('over');
    });
    s.on('errorMsg', ({ message }) => setError(message));

    s.connect();
    return () => {
      if (announceRef.current) window.clearTimeout(announceRef.current);
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
    socketRef.current.disconnect();
    onExit();
  };

  // 방/게임에서 나가되 온라인 메뉴로 복귀(멀티 유지). 서버 방은 정리되고 상대에겐 알림.
  const backToMenu = () => {
    sessionRef.current = null;
    socketRef.current.disconnect();
    resetRound();
    setCode('');
    setJoinCode('');
    setOpponentNick('상대');
    setMyIndex(0);
    myIndexRef.current = 0;
    setError(null);
    setPhase('menu');
    socketRef.current.connect();
  };

  // ---------- 렌더 ----------
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

  if (phase === 'secret') {
    const readyCount = secretReady.filter(Boolean).length;
    const oppReady = secretReady[1 - myIndex];
    return (
      <div className="versus">
        <NetStatus connected={connected} oppDisconnected={oppDisconnected} />
        <div className="turn-bar">
          <span className="turn-who">숫자 정하기</span>
          <span
            key={readyCount}
            className={`turn-hint ready-count${oppReady ? ' hot' : ''}`}
          >
            준비 {readyCount}/2
          </span>
        </div>
        {oppReady && <p className="ready-note">상대가 숫자를 정했어요!</p>}
        {mySecretSet ? (
          <>
            <div className="versus versus-center">
              <LoadingDots />
              <p className="wait-line">상대가 숫자를 정하는 중…</p>
            </div>
            <p className="memo-hint">미리 메모해둘 수 있어요 — 숫자를 눌러 ○△✕ 표시</p>
            <Keypad
              slots={Array(digits).fill('')}
              memo={memo}
              mode="memo"
              disabled={false}
              showMemo={false}
              submitLabel="확인"
              onDigit={() => {}}
              onMemo={cycleMemo}
              onDelete={() => {}}
              onSubmit={() => {}}
            />
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
      </div>
    );
  }

  if (phase === 'playing') {
    const firstNick = myIndex === 0 ? nick.trim() || '나' : opponentNick;
    return (
      <div className="versus">
        <NetStatus connected={connected} oppDisconnected={oppDisconnected} />
        <div
          className={`turn-bar${
            reveal || startAnnounce ? '' : myTurn ? ' my-turn' : ' opp-turn'
          }`}
        >
          <span className="turn-who">
            {reveal ? '결과 발표' : startAnnounce ? '플레이 볼!' : myTurn ? '내 차례' : '상대 차례'}
          </span>
          <span className="turn-hint">
            상대 {oppAttempts}회{oppSolved ? ' · 맞힘!' : ''}
          </span>
        </div>

        {mySecret && <SecretPeek secret={mySecret} />}

        {startAnnounce ? (
          <div className="versus versus-center announce">
            <p className="announce-line">모두 숫자를 골랐어요!</p>
            <p className="announce-first">
              {myIndex === 0 ? '내가' : <Nick>{firstNick}</Nick>} 먼저 시작!
            </p>
          </div>
        ) : reveal ? (
          <RevealCard
            reveal={reveal}
            digits={digits}
            mine={reveal.by === myIndex}
            opponentNick={opponentNick}
          />
        ) : myTurn ? (
          <>
            {oppSolved && <div className="tension reverse">역전 찬스! 맞히면 무승부</div>}
            <OnlineInput
              key={history.length}
              digits={digits}
              submitLabel="추측"
              onSubmit={submitGuess}
              onChange={emitInput}
              memo={memo}
              memoMode={memoMode}
              onMemo={cycleMemo}
              onToggleMemo={() => setMemoMode((v) => !v)}
              showMemo
            />
          </>
        ) : (
          <div className="versus versus-center">
            {mySolved && <div className="tension last">상대의 마지막 기회…</div>}
            {oppInput ? (
              <div className="live-input">
                <span className="live-label">상대 입력 중</span>
                <span className="num-cells">
                  {Array.from({ length: digits }, (_, i) => (
                    <span key={i} className="cell hcell">
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
            )}
          </div>
        )}

        <section className="history-section">
          <div className="history-head">
            <span>내 기록</span>
            <span className="attempts">{history.length}회</span>
          </div>
          <History guesses={history} />
        </section>
        {oppHistory.length > 0 && (
          <section className="history-section">
            <div className="history-head">
              <span>
                <Nick>{opponentNick}</Nick> 기록
              </span>
              <span className="attempts">{oppHistory.length}회</span>
            </div>
            <History guesses={oppHistory} />
          </section>
        )}
        {error && <p className="online-error">{error}</p>}
      </div>
    );
  }

  // over — 결과가 없는데 상대가 나갔으면(중도 이탈) 전용 화면.
  if (oppLeft && !over) {
    return (
      <div className="versus">
        <h2 className="versus-title">상대가 나갔어요</h2>
        <p className="versus-desc">대결이 종료됐어요.</p>
        <button type="button" className="versus-primary" onClick={backToMenu}>
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
