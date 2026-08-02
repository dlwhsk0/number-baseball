import { useEffect, useReducer, useRef, useState } from 'react';
import { getSocket } from '../net/socket';
import { gameReducer, initGame, type GuessRecord } from '../game/useGame';
import { Keypad } from '../components/Keypad';
import { History } from '../components/History';
import { Seg7 } from '../components/Seg7';
import type { SpeedStanding } from '../net/protocol';

export interface OnlineEntry {
  action: 'create' | 'join';
  nick: string;
  digits: number;
  code?: string;
}
interface Props {
  entry: OnlineEntry;
  onExit: () => void;
  onActiveChange?: (active: boolean) => void;
}

type Phase = 'menu' | 'lobby' | 'race' | 'over';
interface OverInfo {
  standings: SpeedStanding[];
  secret: string;
}

type Session = { code: string; index: number; token: string };
const SESSION_KEY = 'nb_speed_session';
function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s && typeof s.code === 'string' && typeof s.index === 'number' && typeof s.token === 'string')
      return s;
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

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function LoadingDots() {
  return (
    <span className="loading-dots" aria-label="대기 중">
      <i />
      <i />
      <i />
    </span>
  );
}

/** 스피드 레이스 입력(칸 + 키패드). 제출하면 부모가 서버로 guess 전송. */
function RaceInput({
  digits,
  onSubmit,
}: {
  digits: number;
  onSubmit: (value: string) => void;
}) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    initGame('', Infinity, digits, false),
  );
  const full = !state.slots.includes('');
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
            aria-label={d ? `${i + 1}칸 ${d} 지우기` : `${i + 1}칸`}
            onClick={() => dispatch({ type: 'clearSlot', index: i })}
          >
            <Seg7 char={d} />
          </button>
        ))}
      </div>
      <Keypad
        slots={state.slots}
        memo={{}}
        memoMark={null}
        disabled={false}
        showMemo={false}
        submitLabel="던지기"
        onDigit={(digit) => dispatch({ type: 'push', digit })}
        onMemo={() => {}}
        onDelete={() => dispatch({ type: 'pop' })}
        onSubmit={() => {
          if (!full) return;
          onSubmit(state.slots.join(''));
          dispatch({ type: 'reset', secret: '', maxAttempts: Infinity, digits, beginner: false });
        }}
        onCycleMemo={() => {}}
      />
    </section>
  );
}

/** 리더보드 한 줄. */
function Standing({ s, me, rank }: { s: SpeedStanding; me: boolean; rank: number }) {
  return (
    <li className={`sp-row${me ? ' me' : ''}${s.solved ? ' solved' : ''}`}>
      <span className="sp-rank">{s.solved ? rank : '-'}</span>
      <span className="sp-name">
        {s.nick}
        {me ? ' (나)' : ''}
        {!s.connected ? ' ⚡끊김' : ''}
      </span>
      <span className="sp-att">{s.attempts}회</span>
      <span className="sp-stat">{s.solved ? `✓ ${fmtTime(s.solveMs ?? 0)}` : '푸는 중'}</span>
    </li>
  );
}

/** 온라인 스피드 대전 — 공통 숫자를 2~4명이 동시에 풀어 순위를 겨룬다(서버 권위). */
export function OnlineSpeed({ entry, onExit, onActiveChange }: Props) {
  const socketRef = useRef(getSocket());
  const entryRef = useRef(entry);
  const autoRanRef = useRef(false);
  const myIndexRef = useRef(0);
  const sessionRef = useRef<Session | null>(loadSession());
  const [resuming, setResuming] = useState<boolean>(() => sessionRef.current !== null);

  const [phase, setPhase] = useState<Phase>('menu');
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [nick] = useState(entry.nick);
  const [digits, setDigits] = useState(entry.digits);
  const [joinCode] = useState(entry.code ?? '');
  const [code, setCode] = useState('');
  const [myIndex, setMyIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  const [roster, setRoster] = useState<{ index: number; nick: string; connected: boolean }[]>([]);
  const [standings, setStandings] = useState<SpeedStanding[]>([]);
  const [startAt, setStartAt] = useState(0);
  const [now, setNow] = useState(0);
  const [myHistory, setMyHistory] = useState<GuessRecord[]>([]);
  const [over, setOver] = useState<OverInfo | null>(null);
  const [left, setLeft] = useState(false);

  const raceDigitsRef = useRef(3);

  const active = phase === 'lobby' || phase === 'race';
  const onActiveRef = useRef(onActiveChange);
  onActiveRef.current = onActiveChange;
  useEffect(() => {
    onActiveRef.current?.(active);
  }, [active]);
  useEffect(() => () => onActiveRef.current?.(false), []);

  // 레이스 타이머.
  useEffect(() => {
    if (phase !== 'race' || !startAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    setNow(Date.now());
    return () => window.clearInterval(t);
  }, [phase, startAt]);

  useEffect(() => {
    const s = socketRef.current;
    const onConnect = () => {
      setConnected(true);
      const sess = sessionRef.current;
      if (!sess) return;
      myIndexRef.current = sess.index;
      setMyIndex(sess.index);
      s.emit('rejoin', { code: sess.code, index: sess.index, token: sess.token }, (r) => {
        setResuming(false);
        if (r.ok && r.resume && r.resume.mode === 'speed') {
          const rm = r.resume;
          setCode(sess.code);
          setDigits(rm.digits);
          raceDigitsRef.current = rm.digits;
          setStandings(rm.standings);
          setStartAt(rm.startAt);
          setMyHistory(rm.myHistory);
          if (rm.phase === 'over' && rm.over) {
            setOver(rm.over);
            setPhase('over');
          } else if (rm.phase === 'playing') {
            setPhase('race');
          } else {
            setPhase('lobby');
          }
        } else {
          sessionRef.current = null;
          saveSession(null);
          setError('방이 만료됐어요. 다시 시작해주세요.');
          setPhase('menu');
        }
      });
    };
    const onDisconnect = () => setConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('speedRoster', ({ players }) => setRoster(players));
    s.on('speedStart', ({ startAt: at, digits: d }) => {
      raceDigitsRef.current = d;
      setDigits(d);
      setStartAt(at);
      setMyHistory([]);
      setOver(null);
      setPhase('race');
    });
    s.on('speedProgress', ({ standings: st }) => setStandings(st));
    s.on('speedOver', (p) => {
      setOver(p);
      setPhase('over');
    });
    s.on('opponentLeft', () => {
      // 방이 사라짐(전원 이탈 등).
      sessionRef.current = null;
      saveSession(null);
      setLeft(true);
      setPhase('over');
    });
    s.on('errorMsg', ({ message }) => setError(message));

    s.connect();
    let resumeTimer: number | undefined;
    if (sessionRef.current) {
      resumeTimer = window.setTimeout(() => {
        setResuming((was) => {
          if (was) setError('방에 다시 연결하지 못했어요.');
          return false;
        });
      }, 9000);
    }
    return () => {
      if (resumeTimer) window.clearTimeout(resumeTimer);
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('speedRoster');
      s.off('speedStart');
      s.off('speedProgress');
      s.off('speedOver');
      s.off('opponentLeft');
      s.off('errorMsg');
      s.disconnect();
    };
  }, []);

  const saveNick = () => {
    try {
      localStorage.setItem('nb_nick', nick.trim());
    } catch {
      /* 무시 */
    }
  };

  const doCreate = () => {
    setError(null);
    saveNick();
    socketRef.current.emit('create', { nick, digits, mode: 'speed' }, (r) => {
      if (r.ok) {
        sessionRef.current = { code: r.code, index: 0, token: r.token };
        saveSession(sessionRef.current);
        setCode(r.code);
        myIndexRef.current = 0;
        setMyIndex(0);
        setRoster([{ index: 0, nick: nick.trim() || '플레이어', connected: true }]);
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
    setError(null);
    saveNick();
    socketRef.current.emit('join', { nick, code: c }, (r) => {
      if (!r.ok || r.index == null) {
        setError(r.error ?? '입장에 실패했어요.');
        return;
      }
      if (r.mode !== 'speed') {
        setError('스피드 방이 아니에요.');
        return;
      }
      sessionRef.current = { code: r.code ?? c, index: r.index, token: r.token ?? '' };
      saveSession(sessionRef.current);
      setCode(r.code ?? c);
      myIndexRef.current = r.index;
      setMyIndex(r.index);
      if (r.digits) setDigits(r.digits);
      if (r.players) setRoster(r.players.map((p) => ({ ...p, connected: true })));
      setPhase('lobby');
    });
  };

  const startRace = () => {
    setError(null);
    socketRef.current.emit('startSpeed', (r) => {
      if (!r.ok) setError(r.error ?? '시작할 수 없어요.');
    });
  };

  const submitGuess = (guess: string) => {
    setError(null);
    socketRef.current.emit('guess', { guess }, (r) => {
      if (r.ok && r.judgement) {
        setMyHistory((h) => [...h, { guess, judgement: r.judgement! }]);
      } else if (!r.ok) {
        setError(r.error ?? '오류가 발생했어요.');
      }
    });
  };

  const copyCode = () => {
    try {
      navigator.clipboard?.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 무시 */
    }
  };

  // 나가기 = 멀티 메뉴로 복귀(서버에 leave 알리고 언마운트).
  const backToMenu = () => {
    sessionRef.current = null;
    saveSession(null);
    socketRef.current.emit('leave', () => {});
    onExit();
  };

  // 세션 없이 진입하면(신규) 연결되는 대로 App이 준 액션(방 만들기/입장) 자동 실행.
  useEffect(() => {
    if (!connected || sessionRef.current || autoRanRef.current) return;
    autoRanRef.current = true;
    if (entryRef.current.action === 'create') doCreate();
    else doJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // ---------- 렌더 ----------
  // 메뉴(닉네임·옵션)는 App이 담당 — 여기선 방 만들기/입장 진행 중 로딩만.
  if (phase === 'menu') {
    const label = resuming
      ? '방에 다시 연결하는 중…'
      : entry.action === 'create'
      ? '방 만드는 중…'
      : '입장하는 중…';
    return (
      <div className="versus versus-center">
        <LoadingDots />
        <p className="wait-line">{connected ? label : '서버 연결 중…'}</p>
        {error && <p className="online-error">{error}</p>}
        <button type="button" className="versus-secondary" onClick={backToMenu}>
          {error ? '뒤로' : '취소'}
        </button>
      </div>
    );
  }

  if (phase === 'lobby') {
    const isHost = myIndex === 0;
    return (
      <div className="versus versus-center">
        <p className="handoff-sub">스피드 대결 — 인원을 모아요 ({roster.length}/4)</p>
        <div className="online-menu-card lobby-card">
          <div className="room-code" aria-label={`방 코드 ${code}`}>
            {code}
          </div>
          <button type="button" className="copy-btn" onClick={copyCode}>
            {copied ? '복사됐어요!' : '코드 복사'}
          </button>
          <ul className="sp-roster">
            {roster.map((p) => (
              <li key={p.index} className={p.index === myIndex ? 'me' : ''}>
                {p.nick}
                {p.index === myIndex ? ' (나)' : ''}
                {p.index === 0 ? ' 👑' : ''}
                {!p.connected ? ' ⚡' : ''}
              </li>
            ))}
          </ul>
        </div>
        {isHost ? (
          <button
            type="button"
            className="versus-primary"
            disabled={roster.length < 2}
            onClick={startRace}
          >
            {roster.length < 2 ? '2명 이상 필요' : '시작!'}
          </button>
        ) : (
          <p className="wait-line">방장이 시작하기를 기다리는 중…</p>
        )}
        <button type="button" className="versus-secondary" onClick={backToMenu}>
          나가기
        </button>
        {error && <p className="online-error">{error}</p>}
      </div>
    );
  }

  if (phase === 'race') {
    const me = standings.find((s) => s.index === myIndex);
    const solvedCount = standings.filter((s) => s.solved).length;
    const iSolved = me?.solved ?? false;
    const elapsed = startAt ? now - startAt : 0;
    let rank = 0;
    return (
      <div className="versus">
        <div className="turn-bar">
          <span className="turn-who">스피드 ⚡</span>
          <span className="turn-timer">{fmtTime(elapsed)}</span>
        </div>

        <ul className="sp-board">
          {standings.map((s) => {
            if (s.solved) rank += 1;
            return (
              <Standing key={s.index} s={s} me={s.index === myIndex} rank={s.solved ? rank : 0} />
            );
          })}
        </ul>
        <p className="sp-count">
          {solvedCount}/{standings.length}명 맞힘
        </p>

        {iSolved ? (
          <div className="versus versus-center">
            <p className="sp-done">맞혔어요! 🎉</p>
            <LoadingDots />
            <p className="wait-line">다른 사람들을 기다리는 중…</p>
          </div>
        ) : (
          <>
            <RaceInput digits={raceDigitsRef.current} onSubmit={submitGuess} />
            <section className="history-section">
              <div className="history-head">
                <span>내 기록</span>
                <span className="attempts">{myHistory.length}</span>
              </div>
              <History guesses={myHistory} />
            </section>
          </>
        )}
        {error && <p className="online-error">{error}</p>}
      </div>
    );
  }

  // over
  if (left && !over) {
    return (
      <div className="versus versus-center">
        <h2 className="versus-title">대결 종료</h2>
        <p className="versus-desc">방이 종료됐어요.</p>
        <button type="button" className="versus-primary" onClick={backToMenu}>
          나가기
        </button>
      </div>
    );
  }
  if (!over) return null;

  const iWon = over.standings.length > 0 && over.standings[0].index === myIndex;
  return (
    <div className={`online-result ${iWon ? 'win' : 'lose'}`}>
      <div className="result-emblem">{iWon ? '🏆' : '⚡'}</div>
      <h2 className="result-headline">{iWon ? '1등!' : '결과'}</h2>
      <p className="forfeit-desc">정답은 {over.secret} 였어요.</p>
      <ol className="score-list">
        {over.standings.map((s, i) => (
          <li key={s.index} className={`score-row${s.index === myIndex ? ' win' : ''}`}>
            <span className="score-rank">{i + 1}</span>
            <span className="score-name">
              {s.nick}
              {s.index === myIndex ? ' (나)' : ''}
            </span>
            <span className="score-stat">{s.attempts}회</span>
            <span className="score-stat">{s.solveMs != null ? fmtTime(s.solveMs) : '-'}</span>
          </li>
        ))}
      </ol>
      <button type="button" className="versus-primary" onClick={backToMenu}>
        나가기
      </button>
    </div>
  );
}
