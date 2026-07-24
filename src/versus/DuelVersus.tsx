import { useReducer, useState } from 'react';
import { gameReducer, initGame, type GuessRecord } from '../game/useGame';
import { Keypad } from '../components/Keypad';
import { History } from '../components/History';
import { Seg7 } from '../components/Seg7';

interface Props {
  onExit: () => void;
}

type Phase =
  | { kind: 'setup' }
  | { kind: 'secret-intro'; player: number }
  | { kind: 'secret-entry'; player: number }
  | { kind: 'turn-intro'; player: number }
  | { kind: 'turn'; player: number }
  | { kind: 'result'; outcome: 'draw' | 0 | 1 };

/**
 * 모드2 — 턴제 일대일 대결(패스앤플레이).
 * 서로 상대가 맞힐 숫자를 몰래 정하고, 번갈아 한 번씩 상대 숫자를 추측한다.
 * 공정성: P1이 먼저 두므로 P1이 맞히면 P2에게 같은 라운드의 마지막 기회를 준다.
 * 둘 다 맞히면 무승부.
 */
export function DuelVersus({ onExit }: Props) {
  const [digits, setDigits] = useState(3);
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' });
  // secrets[i] = 플레이어 i가 정한 숫자(상대가 맞힌다). 플레이어 p는 secrets[1-p]를 맞힌다.
  const [secrets, setSecrets] = useState<[string, string]>(['', '']);
  const [histories, setHistories] = useState<[GuessRecord[], GuessRecord[]]>([[], []]);
  const [solved, setSolved] = useState<[boolean, boolean]>([false, false]);

  const startMatch = () => {
    setSecrets(['', '']);
    setHistories([[], []]);
    setSolved([false, false]);
    setPhase({ kind: 'secret-intro', player: 0 });
  };

  const confirmSecret = (player: number, secret: string) => {
    setSecrets((s) => {
      const next: [string, string] = [...s];
      next[player] = secret;
      return next;
    });
    if (player === 0) setPhase({ kind: 'secret-intro', player: 1 });
    else setPhase({ kind: 'turn-intro', player: 0 });
  };

  const finishTurn = (player: number, record: GuessRecord) => {
    const solvedNow = record.judgement.strikes === digits;
    const nextSolved: [boolean, boolean] = [...solved];
    if (solvedNow) nextSolved[player] = true;
    const nextHist: [GuessRecord[], GuessRecord[]] = [
      player === 0 ? [...histories[0], record] : histories[0],
      player === 1 ? [...histories[1], record] : histories[1],
    ];
    setHistories(nextHist);
    setSolved(nextSolved);

    if (player === 0) {
      // 선공(P1) 뒤에는 항상 P2에게 넘긴다(마지막 기회 포함).
      setPhase({ kind: 'turn-intro', player: 1 });
    } else {
      // 라운드 끝(P2까지 둠) → 판정.
      if (nextSolved[0] && nextSolved[1]) setPhase({ kind: 'result', outcome: 'draw' });
      else if (nextSolved[0]) setPhase({ kind: 'result', outcome: 0 });
      else if (nextSolved[1]) setPhase({ kind: 'result', outcome: 1 });
      else setPhase({ kind: 'turn-intro', player: 0 });
    }
  };

  if (phase.kind === 'setup') {
    return (
      <div className="versus">
        <h2 className="versus-title">턴제 대결 🔁</h2>
        <p className="versus-desc">
          서로 <strong>상대가 맞힐 숫자</strong>를 몰래 정하고, 번갈아 한 번씩 추측해요. 먼저 맞히면 승리!
          (선공이 맞히면 후공에게 마지막 기회 → 둘 다 맞히면 무승부)
        </p>
        <div className="versus-field">
          <span className="versus-label">자릿수</span>
          <div className="seg">
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
        <button type="button" className="versus-primary" onClick={startMatch}>
          시작
        </button>
      </div>
    );
  }

  if (phase.kind === 'secret-intro') {
    const p = phase.player;
    return (
      <div className="versus versus-center">
        <p className="handoff-sub">🙈 상대가 화면을 보지 않게 하세요</p>
        <h2 className="handoff-title">플레이어 {p + 1}</h2>
        <p className="versus-desc">상대가 맞힐 나의 숫자를 정할 차례예요.</p>
        <button
          type="button"
          className="versus-primary"
          onClick={() => setPhase({ kind: 'secret-entry', player: p })}
        >
          숫자 정하기
        </button>
      </div>
    );
  }

  if (phase.kind === 'secret-entry') {
    const p = phase.player;
    return (
      <SecretEntry
        key={`secret-${p}`}
        player={p}
        digits={digits}
        onConfirm={(secret) => confirmSecret(p, secret)}
      />
    );
  }

  if (phase.kind === 'turn-intro') {
    const p = phase.player;
    return (
      <div className="versus versus-center">
        <p className="handoff-sub">폰을 넘겨주세요</p>
        <h2 className="handoff-title">플레이어 {p + 1} 차례</h2>
        <p className="versus-desc">상대의 숫자를 한 번 추측할 수 있어요.</p>
        <button
          type="button"
          className="versus-primary"
          onClick={() => setPhase({ kind: 'turn', player: p })}
        >
          추측하기
        </button>
      </div>
    );
  }

  if (phase.kind === 'turn') {
    const p = phase.player;
    return (
      <DuelTurn
        key={`turn-${p}-${histories[p].length}`}
        player={p}
        digits={digits}
        opponentSecret={secrets[1 - p]}
        history={histories[p]}
        onDone={(record) => finishTurn(p, record)}
      />
    );
  }

  // result
  const outcome = phase.outcome;
  return (
    <div className="versus">
      <h2 className="versus-title">
        {outcome === 'draw' ? '무승부!' : `플레이어 ${outcome + 1} 승리 🏆`}
      </h2>
      <p className="versus-desc">
        플레이어 1의 숫자 <strong>{secrets[0]}</strong> · 플레이어 2의 숫자{' '}
        <strong>{secrets[1]}</strong>
      </p>
      <ol className="score-list">
        {[0, 1].map((p) => (
          <li key={p} className={`score-row${outcome === p ? ' win' : ''}`}>
            <span className="score-rank">{p + 1}</span>
            <span className="score-name">플레이어 {p + 1}</span>
            <span className="score-stat">{histories[p].length}회</span>
            <span className="score-stat">{solved[p] ? '성공' : '실패'}</span>
          </li>
        ))}
      </ol>
      <div className="versus-actions">
        <button type="button" className="versus-secondary" onClick={onExit}>
          나가기
        </button>
        <button type="button" className="versus-primary" onClick={startMatch}>
          새 대결
        </button>
      </div>
    </div>
  );
}

/** 비밀 숫자 입력(판정 없음). 다 채우면 확인. */
function SecretEntry({
  player,
  digits,
  onConfirm,
}: {
  player: number;
  digits: number;
  onConfirm: (secret: string) => void;
}) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    initGame('', Infinity, digits, false),
  );
  const full = !state.slots.includes('');

  return (
    <div className="versus">
      <div className="turn-bar">
        <span className="turn-who">플레이어 {player + 1}</span>
        <span className="turn-hint">나의 숫자 정하기</span>
      </div>
      <p className="versus-desc">
        서로 다른 {digits === 4 ? '네' : '세'} 자리(맨 앞 0 제외). 확인하면 상대가 맞히게 돼요.
      </p>
      <section className="board">
        <div
          className="input-display"
          style={{ gridTemplateColumns: `repeat(${state.slots.length}, 1fr)` }}
        >
          {state.slots.map((d, i) => (
            <button
              key={i}
              type="button"
              className={`slot cell${d ? ' filled' : ''}`}
              disabled={!d}
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
          submitLabel="확인"
          onDigit={(digit) => dispatch({ type: 'push', digit })}
          onMemo={() => {}}
          onDelete={() => dispatch({ type: 'pop' })}
          onSubmit={() => full && onConfirm(state.slots.join(''))}
        />
      </section>
    </div>
  );
}

/** 한 번만 추측하는 턴. 추측 후 결과를 보고 넘긴다. */
function DuelTurn({
  player,
  digits,
  opponentSecret,
  history,
  onDone,
}: {
  player: number;
  digits: number;
  opponentSecret: string;
  history: GuessRecord[];
  onDone: (record: GuessRecord) => void;
}) {
  const [state, dispatch] = useReducer(gameReducer, undefined, () =>
    initGame(opponentSecret, Infinity, digits, false),
  );
  const record = state.guesses[0] ?? null;
  const solved = record ? record.judgement.strikes === digits : false;
  const outCount = record ? digits - record.judgement.strikes - record.judgement.balls : 0;

  return (
    <div className="versus">
      <div className="turn-bar">
        <span className="turn-who">플레이어 {player + 1} 차례</span>
        <span className="turn-hint">상대 숫자 맞히기</span>
      </div>

      <section className="board">
        {record ? (
          <div className="duel-after">
            <p className={`duel-result${solved ? ' win' : ''}`}>
              {solved ? (
                '맞혔어요! ⚾'
              ) : (
                <>
                  <b className="mark-s">S {record.judgement.strikes}</b> ·{' '}
                  <b className="mark-b">B {record.judgement.balls}</b> ·{' '}
                  <b className="mark-o">O {outCount}</b>
                </>
              )}
            </p>
            <button type="button" className="versus-primary" onClick={() => onDone(record)}>
              {solved ? '결과 보기' : '상대에게 넘기기'}
            </button>
          </div>
        ) : (
          <>
            <div
              className="input-display"
              style={{ gridTemplateColumns: `repeat(${state.slots.length}, 1fr)` }}
            >
              {state.slots.map((d, i) => (
                <button
                  key={i}
                  type="button"
                  className={`slot${d ? ' filled' : ''}`}
                  disabled={!d}
                  onClick={() => dispatch({ type: 'clearSlot', index: i })}
                >
                  {d || '·'}
                </button>
              ))}
            </div>
            <Keypad
              slots={state.slots}
              memo={{}}
              mode="input"
              disabled={false}
              showMemo={false}
              submitLabel="추측"
              onDigit={(digit) => dispatch({ type: 'push', digit })}
              onMemo={() => {}}
              onDelete={() => dispatch({ type: 'pop' })}
              onSubmit={() => dispatch({ type: 'submit' })}
            />
          </>
        )}
      </section>

      <section className="history-section">
        <div className="history-head">
          <span>내 추측</span>
          <span className="attempts">{history.length + state.guesses.length}회</span>
        </div>
        <History guesses={[...history, ...state.guesses]} />
      </section>
    </div>
  );
}
