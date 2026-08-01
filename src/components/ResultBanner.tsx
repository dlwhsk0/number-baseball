import type { GameStatus } from '../game/useGame';
import { Seg7 } from './Seg7';

interface Props {
  status: GameStatus;
  secret: string;
  attempts: number;
  onRestart: () => void;
}

/** 숫자 문자열을 세그먼트 셀로(멀티 결과 카드와 동일한 표현). */
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

/** 혼자 모드 결과 — 멀티(온라인) 결과 카드와 같은 스타일로. */
export function ResultBanner({ status, secret, attempts, onRestart }: Props) {
  if (status === 'playing') return null;

  const won = status === 'won';

  return (
    <div className={`online-result solo-result ${won ? 'win' : 'lose'}`} role="alert">
      <div className="result-emblem">{won ? '🏆' : '😢'}</div>
      <h2 className="result-headline">{won ? '정답!' : '아쉬워요'}</h2>

      <div className="result-players">
        <div className={`rp-card${won ? ' winner' : ''}`}>
          {won && <span className="rp-badge">CLEAR</span>}
          <span className="rp-name">{won ? '내 기록' : '정답'}</span>
          <NumCells value={secret} />
          <span className="rp-attempts">
            {won ? `${attempts}번 만에 맞혔어요` : `${attempts}번 시도 · 못 맞혔어요`}
          </span>
        </div>
      </div>

      <button type="button" className="versus-primary result-restart" onClick={onRestart}>
        ↻ 다시하기
      </button>
    </div>
  );
}
