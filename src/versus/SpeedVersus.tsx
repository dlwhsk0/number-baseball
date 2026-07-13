import { useEffect, useRef, useState } from 'react';
import { generateSecret } from '../game/logic';
import { GuessBoard } from '../components/GuessBoard';

interface Props {
  /** 대결에서 빠져나가 혼자 모드로. */
  onExit: () => void;
}

interface Result {
  player: number;
  attempts: number;
  timeMs: number;
}

type Phase =
  | { kind: 'setup' }
  | { kind: 'intro'; player: number }
  | { kind: 'play'; player: number }
  | { kind: 'result' };

const PLAYER_COUNTS = [2, 3, 4];

function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 순위: 적은 횟수 우선, 동점이면 빠른 시간. */
function ranked(results: Result[]): Result[] {
  return [...results].sort((a, b) =>
    a.attempts !== b.attempts ? a.attempts - b.attempts : a.timeMs - b.timeMs,
  );
}

/**
 * 모드1 — 스피드 대결. 하나의 공통 숫자를 여러 명이 번갈아(패스앤플레이) 풀고,
 * 적은 횟수(동점이면 빠른 시간)로 승자를 가린다.
 */
export function SpeedVersus({ onExit }: Props) {
  const [digits, setDigits] = useState(3);
  const [players, setPlayers] = useState(2);
  const [phase, setPhase] = useState<Phase>({ kind: 'setup' });
  const [results, setResults] = useState<Result[]>([]);
  const secretRef = useRef('');
  const turnStartRef = useRef(0);

  const startMatch = () => {
    secretRef.current = generateSecret(digits);
    setResults([]);
    setPhase({ kind: 'intro', player: 0 });
  };

  const beginTurn = (player: number) => {
    turnStartRef.current = Date.now();
    setPhase({ kind: 'play', player });
  };

  const finishTurn = (player: number, attempts: number) => {
    const timeMs = Date.now() - turnStartRef.current;
    setResults((r) => [...r, { player, attempts, timeMs }]);
    if (player + 1 < players) setPhase({ kind: 'intro', player: player + 1 });
    else setPhase({ kind: 'result' });
  };

  if (phase.kind === 'setup') {
    return (
      <div className="versus">
        <h2 className="versus-title">스피드 대결 ⚡</h2>
        <p className="versus-desc">
          하나의 공통 숫자를 번갈아 풀어요. <strong>적은 횟수</strong>로 맞힌 사람이 승리!
          (동점이면 빠른 시간)
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

        <div className="versus-field">
          <span className="versus-label">인원</span>
          <div className="seg">
            {PLAYER_COUNTS.map((n) => (
              <button
                key={n}
                type="button"
                className={`seg-btn${players === n ? ' active' : ''}`}
                onClick={() => setPlayers(n)}
              >
                {n}명
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

  if (phase.kind === 'intro') {
    const p = phase.player;
    return (
      <div className="versus versus-center">
        <p className="handoff-sub">
          {p === 0 ? '첫 순서예요' : '다음 사람에게 폰을 넘겨주세요'}
        </p>
        <h2 className="handoff-title">플레이어 {p + 1} 차례</h2>
        <p className="versus-desc">준비되면 시작을 누르세요. 시간이 함께 측정돼요.</p>
        <button type="button" className="versus-primary" onClick={() => beginTurn(p)}>
          시작
        </button>
      </div>
    );
  }

  if (phase.kind === 'play') {
    return (
      <PlayTurn
        player={phase.player}
        digits={digits}
        secret={secretRef.current}
        startedAt={turnStartRef.current}
        onWin={(attempts) => finishTurn(phase.player, attempts)}
      />
    );
  }

  // result
  const order = ranked(results);
  const winner = order[0];
  const draw =
    order.length > 1 &&
    order[0].attempts === order[1].attempts &&
    order[0].timeMs === order[1].timeMs;

  return (
    <div className="versus">
      <h2 className="versus-title">{draw ? '무승부!' : `플레이어 ${winner.player + 1} 승리 🏆`}</h2>
      <p className="versus-desc">정답은 {secretRef.current} 였어요.</p>

      <ol className="score-list">
        {order.map((r, i) => (
          <li key={r.player} className={`score-row${i === 0 && !draw ? ' win' : ''}`}>
            <span className="score-rank">{i + 1}</span>
            <span className="score-name">플레이어 {r.player + 1}</span>
            <span className="score-stat">{r.attempts}회</span>
            <span className="score-stat">{fmtTime(r.timeMs)}</span>
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

/** 한 플레이어의 플레이 화면 — 라이브 타이머 + 보드. */
function PlayTurn({
  player,
  digits,
  secret,
  startedAt,
  onWin,
}: {
  player: number;
  digits: number;
  secret: string;
  startedAt: number;
  onWin: (attempts: number) => void;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="versus">
      <div className="turn-bar">
        <span className="turn-who">플레이어 {player + 1}</span>
        <span className="turn-timer">{fmtTime(now - startedAt)}</span>
      </div>
      {/* key로 매 턴 새 보드 보장(이전 기록 숨김) */}
      <GuessBoard key={`${player}-${secret}`} secret={secret} digits={digits} onWin={onWin} />
    </div>
  );
}
