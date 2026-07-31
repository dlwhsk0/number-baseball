import { useEffect, useReducer, useRef, useState } from 'react';
import { getSocket } from '../net/socket';
import { gameReducer, initGame, type GuessRecord } from '../game/useGame';
import { Keypad } from '../components/Keypad';
import { History } from '../components/History';
import { Seg7 } from '../components/Seg7';
import type { Outcome } from '../net/protocol';

interface Props {
  onExit: () => void;
}

type Phase = 'menu' | 'lobby' | 'secret' | 'playing' | 'over';
interface OverInfo {
  outcome: Outcome;
  secrets: (string | null)[];
  attempts: number[];
}

/** 입력 칸 + 키패드(메모 없음). 다 채우면 onSubmit. gameReducer로 규칙 검증 재사용. */
function OnlineInput({
  digits,
  submitLabel,
  onSubmit,
}: {
  digits: number;
  submitLabel: string;
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
            aria-label={d ? `${i + 1}번째 칸 ${d} 지우기` : `${i + 1}번째 빈 칸`}
            onClick={() => dispatch({ type: 'clearSlot', index: i })}
          >
            <Seg7 char={d} />
          </button>
        ))}
      </div>
      <Keypad
        slots={state.slots}
        memo={{}}
        mode="input"
        disabled={false}
        showMemo={false}
        submitLabel={submitLabel}
        onDigit={(digit) => dispatch({ type: 'push', digit })}
        onMemo={() => {}}
        onDelete={() => dispatch({ type: 'pop' })}
        onSubmit={() => full && onSubmit(state.slots.join(''))}
      />
    </section>
  );
}

/**
 * 온라인 턴제 대결(방 코드). 서버가 정답을 쥐고 판정한다.
 * 로컬 상태는 서버 이벤트로만 전이한다(단일 진실은 서버).
 */
export function OnlineDuel({ onExit }: Props) {
  const socketRef = useRef(getSocket());
  const myIndexRef = useRef<0 | 1>(0);

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

  const [mySecretSet, setMySecretSet] = useState(false);
  const [secretReady, setSecretReady] = useState<boolean[]>([false, false]);

  const [myTurn, setMyTurn] = useState(false);
  const [history, setHistory] = useState<GuessRecord[]>([]);
  const [oppAttempts, setOppAttempts] = useState(0);
  const [oppSolved, setOppSolved] = useState(false);

  const [over, setOver] = useState<OverInfo | null>(null);
  const [oppLeft, setOppLeft] = useState(false);
  const [rematchWait, setRematchWait] = useState(false);

  const resetRound = () => {
    setHistory([]);
    setOppAttempts(0);
    setOppSolved(false);
    setMySecretSet(false);
    setSecretReady([false, false]);
    setOver(null);
    setRematchWait(false);
  };

  useEffect(() => {
    const s = socketRef.current;
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
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
      setMyTurn(turn === myIndexRef.current);
      setPhase('playing');
    });
    s.on('turn', ({ turn }) => setMyTurn(turn === myIndexRef.current));
    s.on('opponentGuessed', ({ attempts, solved }) => {
      setOppAttempts(attempts);
      setOppSolved(solved);
    });
    s.on('over', (p) => {
      setOver(p);
      setPhase('over');
    });
    s.on('opponentLeft', () => {
      setOppLeft(true);
      setPhase('over');
    });
    s.on('errorMsg', ({ message }) => setError(message));

    s.connect();
    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('opponentJoined');
      s.off('phase');
      s.off('secretProgress');
      s.off('start');
      s.off('turn');
      s.off('opponentGuessed');
      s.off('over');
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
    setBusy(true);
    setError(null);
    saveNick();
    socketRef.current.emit('create', { nick, digits }, (r) => {
      setBusy(false);
      if (r.ok) {
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
      setCode(r.code ?? c);
      myIndexRef.current = 1;
      setMyIndex(1);
      if (r.digits) setDigits(r.digits);
      if (r.opponentNick) setOpponentNick(r.opponentNick);
      // 'phase' 이벤트가 secret 단계로 옮긴다.
    });
  };

  const submitSecret = (secret: string) => {
    setError(null);
    socketRef.current.emit('setSecret', { secret }, (r) => {
      if (r.ok) setMySecretSet(true);
      else setError(r.error ?? '오류가 발생했어요.');
    });
  };

  const submitGuess = (guess: string) => {
    setError(null);
    socketRef.current.emit('guess', { guess }, (r) => {
      if (r.ok && r.judgement) {
        setHistory((h) => [...h, { guess, judgement: r.judgement! }]);
      } else {
        setError(r.error ?? '오류가 발생했어요.');
      }
    });
  };

  const rematch = () => {
    setRematchWait(true);
    setOppLeft(false);
    socketRef.current.emit('rematch');
  };

  const exit = () => {
    socketRef.current.disconnect();
    onExit();
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
        <p className="handoff-sub">상대를 기다리는 중…</p>
        <div className="room-code" aria-label={`방 코드 ${code}`}>
          {code}
        </div>
        <p className="versus-desc">이 코드를 상대에게 알려주세요. 상대가 입장하면 시작돼요.</p>
        <button type="button" className="versus-secondary" onClick={exit}>
          나가기
        </button>
      </div>
    );
  }

  if (phase === 'secret') {
    return (
      <div className="versus">
        <div className="turn-bar">
          <span className="turn-who">비밀 숫자 정하기</span>
          <span className="turn-hint">나 vs {opponentNick}</span>
        </div>
        {mySecretSet ? (
          <div className="versus versus-center">
            <p className="handoff-sub">상대가 정하는 중…</p>
            <p className="versus-desc">
              {secretReady.filter(Boolean).length} / 2 준비 완료
            </p>
          </div>
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
    return (
      <div className="versus">
        <div className="turn-bar">
          <span className="turn-who">{myTurn ? '내 차례' : `${opponentNick} 차례`}</span>
          <span className="turn-hint">
            상대 {oppAttempts}회{oppSolved ? ' · 맞힘!' : ''}
          </span>
        </div>

        {myTurn ? (
          <OnlineInput
            key={history.length}
            digits={digits}
            submitLabel="추측"
            onSubmit={submitGuess}
          />
        ) : (
          <div className="versus versus-center">
            <p className="handoff-sub">{opponentNick} 차례예요</p>
            <p className="versus-desc">잠시만 기다려주세요…</p>
          </div>
        )}

        <section className="history-section">
          <div className="history-head">
            <span>history</span>
            <span className="attempts">{history.length}회</span>
          </div>
          <History guesses={history} />
        </section>
        {error && <p className="online-error">{error}</p>}
      </div>
    );
  }

  // over
  return (
    <div className="versus">
      {oppLeft ? (
        <>
          <h2 className="versus-title">상대가 나갔어요</h2>
          <p className="versus-desc">대결이 종료됐어요.</p>
          <button type="button" className="versus-primary" onClick={exit}>
            나가기
          </button>
        </>
      ) : (
        over && (
          <>
            <h2 className="versus-title">
              {over.outcome === 'draw'
                ? '무승부!'
                : over.outcome === myIndex
                  ? '승리 🏆'
                  : '패배 😢'}
            </h2>
            <p className="versus-desc">
              내 숫자 <strong>{over.secrets[myIndex]}</strong> · {opponentNick} 숫자{' '}
              <strong>{over.secrets[1 - myIndex]}</strong>
            </p>
            <ol className="score-list">
              <li className={`score-row${over.outcome === myIndex ? ' win' : ''}`}>
                <span className="score-rank">나</span>
                <span className="score-name">{nick.trim() || '나'}</span>
                <span className="score-stat">{over.attempts[myIndex]}회</span>
              </li>
              <li
                className={`score-row${
                  over.outcome !== 'draw' && over.outcome === 1 - myIndex ? ' win' : ''
                }`}
              >
                <span className="score-rank">상</span>
                <span className="score-name">{opponentNick}</span>
                <span className="score-stat">{over.attempts[1 - myIndex]}회</span>
              </li>
            </ol>
            <div className="versus-actions">
              <button type="button" className="versus-secondary" onClick={exit}>
                나가기
              </button>
              <button
                type="button"
                className="versus-primary"
                disabled={rematchWait}
                onClick={rematch}
              >
                {rematchWait ? '상대 대기…' : '재대결'}
              </button>
            </div>
          </>
        )
      )}
    </div>
  );
}
