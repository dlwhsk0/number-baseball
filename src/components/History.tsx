import { DIGITS } from '../game/logic';
import type { GuessRecord } from '../game/useGame';

interface Props {
  guesses: GuessRecord[];
}

/** 각 추측은 세 자리라 S+B+O = DIGITS. O(아웃)은 정답에 없는 자리 수. */
const CELLS = [
  { key: 'strike', letter: 'S' },
  { key: 'ball', letter: 'B' },
  { key: 'out', letter: 'O' },
] as const;

function counts({ strikes, balls }: GuessRecord['judgement']) {
  return { strike: strikes, ball: balls, out: DIGITS - strikes - balls };
}

export function History({ guesses }: Props) {
  if (guesses.length === 0) {
    return <p className="history-empty">첫 추측을 입력해보세요.</p>;
  }

  return (
    <ol className="history">
      {guesses.map((g, i) => {
        const c = counts(g.judgement);
        return (
          <li key={i} className="history-row">
            <span className="history-index">{i + 1}</span>
            <span className="history-guess">{g.guess}</span>
            <span className="sbo">
              {CELLS.map(({ key, letter }) => (
                <span
                  key={key}
                  className={`sbo-cell sbo-${key}${c[key] === 0 ? ' zero' : ''}`}
                >
                  <span className="sbo-letter">{letter}</span>
                  <span className="sbo-count">{c[key]}</span>
                </span>
              ))}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
