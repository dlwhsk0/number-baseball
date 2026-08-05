import type { GuessRecord } from '../game/useGame';
import { Seg7 } from './Seg7';

interface Props {
  guesses: GuessRecord[];
  /** 좁은 칸(상대 기록)용 — S·B·O를 전구 대신 '1S 2B 0O' 텍스트로. */
  sboText?: boolean;
}

/** S+B+O = 자릿수. O(아웃)은 정답에 없는 자리 수(자릿수 - S - B). */
const CELLS = [
  { key: 'strike', letter: 'S' },
  { key: 'ball', letter: 'B' },
  { key: 'out', letter: 'O' },
] as const;

function counts({ strikes, balls }: GuessRecord['judgement'], digits: number) {
  return { strike: strikes, ball: balls, out: digits - strikes - balls };
}

export function History({ guesses, sboText = false }: Props) {
  if (guesses.length === 0) return null;

  return (
    <ol className="history">
      {guesses.map((g, i) => {
        const c = counts(g.judgement, g.guess.length);
        return (
          <li key={i} className="history-row">
            <span className="history-index">{i + 1}</span>
            <span className="history-guess">
              {g.guess.split('').map((ch, j) => (
                <span key={j} className="cell hcell">
                  <Seg7 char={ch} />
                </span>
              ))}
            </span>
            {sboText ? (
              // 0인 유형은 숨기되(헷갈림 방지) S·B·O 각 자리는 고정폭으로 안 밀리게.
              <span className="sbo sbo-text">
                <b className="mark-s">{c.strike > 0 ? `${c.strike}S` : ''}</b>
                <b className="mark-b">{c.ball > 0 ? `${c.ball}B` : ''}</b>
                <b className="mark-o">{c.out > 0 ? `${c.out}O` : ''}</b>
              </span>
            ) : (
              <span className="sbo">
                {CELLS.map(({ key, letter }) => (
                  <span
                    key={key}
                    className={`hsbo lamp-${key}${c[key] === 0 ? ' zero' : ''}`}
                  >
                    <span className="hsbo-letter">{letter}</span>
                    <span className="bulbs">
                      {Array.from({ length: g.guess.length }, (_, k) => (
                        <span key={k} className={`bulb${k < c[key] ? ' on' : ''}`} />
                      ))}
                    </span>
                  </span>
                ))}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
