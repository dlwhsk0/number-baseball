import { useEffect, useReducer, useRef, useState } from 'react';
import { getSocket } from '../net/socket';
import { gameReducer, initGame, toggleMemoMark, type GuessRecord, type MemoMark } from '../game/useGame';
import { Keypad } from '../components/Keypad';
import { History } from '../components/History';
import { Seg7 } from '../components/Seg7';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { SpeedStanding, SpeedHistoryEntry } from '../net/protocol';

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
  histories: SpeedHistoryEntry[];
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
  // 메모는 추측을 거듭해도 유지돼야 해서 리듀서 밖 상태로 둔다(제출 시 입력칸만 리셋).
  const [memo, setMemo] = useState<Record<string, MemoMark>>({});
  const [memoMark, setMemoMark] = useState<MemoMark | null>(null);
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
        memo={memo}
        memoMark={memoMark}
        disabled={false}
        markButtons
        showSubmit
        submitLabel="던지기"
        onDigit={(digit) => dispatch({ type: 'push', digit })}
        onMemo={(d) => memoMark && setMemo((m) => toggleMemoMark(m, d, memoMark))}
        onDelete={() => dispatch({ type: 'pop' })}
        onSubmit={() => {
          if (!full) return;
          onSubmit(state.slots.join(''));
          dispatch({ type: 'reset', secret: '', maxAttempts: Infinity, digits, beginner: false });
        }}
        onPickMark={(m) => setMemoMark((cur) => (cur === m ? null : m))}
        onClearMemo={() => setMemo({})}
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

/** 리더보드 칩(가로 배치·컴팩트) — 경기 중 많은 인원을 좁게 보여주려고. */
function StandingChip({ s, me, rank }: { s: SpeedStanding; me: boolean; rank: number }) {
  return (
    <div className={`sp-chip${me ? ' me' : ''}${s.solved ? ' solved' : ''}`}>
      <span className="sp-chip-top">
        <span className="sp-chip-rank">{s.solved ? rank : '·'}</span>
        <span className="sp-chip-name">
          {s.nick}
          {me ? '(나)' : ''}
          {!s.connected ? ' ⚡' : ''}
        </span>
      </span>
      <span className="sp-chip-stat">
        {s.solved ? `✓ ${fmtTime(s.solveMs ?? 0)}` : `${s.attempts}회`}
      </span>
    </div>
  );
}

/** 온라인 스피드 대전 — 공통 숫자를 2~6명이 동시에 풀어 순위를 겨룬다(서버 권위). */
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
  const [confirmLeave, setConfirmLeave] = useState(false);

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

    // 이미 연결돼 있으면(코드 입장 전 peek 등) connect 이벤트가 안 오므로 직접 처리.
    if (s.connected) onConnect();
    else s.connect();
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
  // 의도적 나가기가 서버에 확실히 도달하도록 ack(또는 짧은 폴백)까지 기다렸다 언마운트한다.
  // (바로 끊으면 leave가 유실돼 서버가 '연결 끊김'으로 처리 → 상대·순위 갱신이 늦어짐.)
  const backToMenu = () => {
    sessionRef.current = null;
    saveSession(null);
    let exited = false;
    const finish = () => {
      if (exited) return;
      exited = true;
      onExit();
    };
    socketRef.current.emit('leave', finish);
    window.setTimeout(finish, 700);
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
      <div className="versus play">
        <div className="turn-bar">
          <span className="turn-who">스피드 ⚡</span>
          <div className="turn-right">
            <span className="turn-timer">{fmtTime(elapsed)}</span>
            <button type="button" className="turn-exit" onClick={() => setConfirmLeave(true)}>
              나가기
            </button>
          </div>
        </div>

        {/* 전광판(상단) — 리더보드 + 내 기록. 기록만 안쪽 스크롤. */}
        <section className="history-section scoreboard sp-scoreboard" aria-label="순위·기록">
          <div className="sp-strip">
            {standings.map((s) => {
              if (s.solved) rank += 1;
              return (
                <StandingChip
                  key={s.index}
                  s={s}
                  me={s.index === myIndex}
                  rank={s.solved ? rank : 0}
                />
              );
            })}
          </div>
          <div className="sp-hist-head">
            <span>내 기록</span>
            <span className="sp-count-inline">{solvedCount}/{standings.length}명 맞힘</span>
            <span className="attempts">{myHistory.length}</span>
          </div>
          <History guesses={myHistory} />
        </section>

        {/* 하단 고정 — 입력/키패드(다 풀면 대기 메시지). 위치 안 흔들림. */}
        <div className="duel-lower">
          {iSolved ? (
            <div className="versus versus-center sp-waiting">
              <p className="sp-done">맞혔어요! 🎉</p>
              <LoadingDots />
              <p className="wait-line">다른 사람들을 기다리는 중…</p>
            </div>
          ) : (
            <RaceInput digits={raceDigitsRef.current} onSubmit={submitGuess} />
          )}
        </div>
        {error && <p className="online-error">{error}</p>}
        {confirmLeave && (
          <ConfirmDialog
            message="대결에서 나갈까요? 순위에서 빠지고 온라인 메뉴로 돌아가요."
            confirmLabel="나가기"
            cancelLabel="계속하기"
            onConfirm={() => {
              setConfirmLeave(false);
              backToMenu();
            }}
            onCancel={() => setConfirmLeave(false)}
          />
        )}
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
  // 종료 화면도 경기 중과 같은 전광판 레이아웃(상단 바 + 스코어보드 프레임 + 하단 고정 버튼).
  return (
    <div className="versus play sp-over">
      <div className={`turn-bar${iWon ? ' my-turn' : ''}`}>
        <span className="turn-who">{iWon ? '🏆 1등!' : '⚡ 결과'}</span>
        <span className="turn-timer">정답 {over.secret}</span>
      </div>

      <section className="history-section scoreboard sp-scoreboard" aria-label="최종 순위·기록">
        <ol className="sp-board">
          {over.standings.map((s, i) => (
            <Standing key={s.index} s={s} me={s.index === myIndex} rank={i + 1} />
          ))}
        </ol>

        {over.histories.length > 0 && (
          <>
            <div className="sp-hist-head">
              <span>추측 기록</span>
            </div>
            <div className="sp-over-hists">
              {over.histories.map((h) => (
                <div key={h.index} className="sp-result-hist">
                  <div className="sp-hist-head">
                    <span>
                      {h.nick}
                      {h.index === myIndex ? ' (나)' : ''}
                    </span>
                    <span className="attempts">{h.history.length}</span>
                  </div>
                  <History guesses={h.history} sboText />
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="duel-lower sp-over-foot">
        <button type="button" className="versus-primary" onClick={backToMenu}>
          나가기
        </button>
      </div>
    </div>
  );
}
