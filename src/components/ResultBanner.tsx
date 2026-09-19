import type { GameStatus } from '../game/useGame';
import { Seg7 } from './Seg7';
import { TeamChip } from './TeamChip';
import type { RankedResult } from '../net/protocol';

interface Props {
  status: GameStatus;
  secret: string;
  attempts: number;
  onRestart: () => void;
  /** 랭킹전 결과(점수·누적·구단 순위). 연습 판이면 없음. */
  ranked?: RankedResult | null;
  /** 랭킹전 결과에서 순위표 열기. */
  onShowBoard?: () => void;
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
export function ResultBanner({ status, secret, attempts, onRestart, ranked, onShowBoard }: Props) {
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

      {ranked && (
        <div className="ranked-result">
          <span className="ranked-points">
            {ranked.points > 0 ? `+${ranked.points}점` : '0점'}
          </span>
          {ranked.recorded ? (
            <>
              <span className="ranked-line">
                <TeamChip team={ranked.team} /> 누적 {ranked.teamPoints.toLocaleString('ko-KR')}점 ·{' '}
                {ranked.teamRank}위
              </span>
              {ranked.total != null && (
                <span className="ranked-line ranked-mine">
                  내 누적 {ranked.total.toLocaleString('ko-KR')}점 · {ranked.rank}위
                </span>
              )}
            </>
          ) : (
            <span className="ranked-line ranked-mine">기록을 저장하지 못했어요</span>
          )}
          {onShowBoard && (
            <button type="button" className="versus-secondary ranked-board-btn" onClick={onShowBoard}>
              🏆 순위 보기
            </button>
          )}
        </div>
      )}

      <button type="button" className="versus-primary result-restart" onClick={onRestart}>
        ↻ 다시하기
      </button>
    </div>
  );
}
