import type { GameStatus } from '../game/useGame';

interface Props {
  status: GameStatus;
  secret: string;
  attempts: number;
  onRestart: () => void;
}

export function ResultBanner({ status, secret, attempts, onRestart }: Props) {
  if (status === 'playing') return null;

  const won = status === 'won';

  return (
    <div className={`result${won ? ' won' : ' lost'}`} role="alert">
      <p className="result-title">{won ? '정답! 🎉' : '아쉬워요 😢'}</p>
      <p className="result-detail">
        {won ? (
          <>{attempts}번 만에 맞혔어요</>
        ) : (
          <>
            정답은 <strong>{secret}</strong> 였어요
          </>
        )}
      </p>
      <button type="button" className="key key-submit result-restart" onClick={onRestart}>
        다시하기
      </button>
    </div>
  );
}
