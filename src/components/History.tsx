import type { GuessRecord } from '../game/useGame';

interface Props {
  guesses: GuessRecord[];
}

/** 판정을 사람이 읽는 라벨로. */
function label({ strikes, balls, isOut }: GuessRecord['judgement']): string {
  if (isOut) return '아웃';
  const parts: string[] = [];
  if (strikes) parts.push(`${strikes}S`);
  if (balls) parts.push(`${balls}B`);
  return parts.join(' ');
}

export function History({ guesses }: Props) {
  if (guesses.length === 0) {
    return <p className="history-empty">첫 추측을 입력해보세요.</p>;
  }

  return (
    <ol className="history">
      {guesses.map((g, i) => (
        <li key={i} className="history-row">
          <span className="history-index">{i + 1}</span>
          <span className="history-guess">{g.guess}</span>
          <span className={`history-result${g.judgement.isOut ? ' is-out' : ''}`}>
            {label(g.judgement)}
          </span>
        </li>
      ))}
    </ol>
  );
}
