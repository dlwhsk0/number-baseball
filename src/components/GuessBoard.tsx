import { useRef, useState } from 'react';
import { judge, isWin, type Judgement } from '../game/logic';
import type { GuessRecord } from '../game/useGame';
import { GuessPad } from './GuessPad';
import { History } from './History';

interface Props {
  /** 맞혀야 할 정답. */
  secret: string;
  digits: number;
  /** 시도 제한. 대결에선 무제한(Infinity)으로 끝까지 푼다. */
  maxAttempts?: number;
  /** 정답을 맞혔을 때(승리) 시도 횟수를 넘겨 호출. */
  onWin: (attempts: number) => void;
}

/**
 * 재사용 가능한 추측 보드(공용 GuessPad + 히스토리). 판정·기록은 여기서, 입력·메모는 GuessPad가.
 * 대결 모드의 한 플레이어 턴에 사용.
 */
export function GuessBoard({ secret, digits, maxAttempts = Infinity, onWin }: Props) {
  const [guesses, setGuesses] = useState<GuessRecord[]>([]);
  const [status, setStatus] = useState<'playing' | 'won' | 'lost'>('playing');
  const firedRef = useRef(false);

  const submit = (value: string) => {
    if (status !== 'playing') return;
    const judgement: Judgement = judge(secret, value);
    const next = [...guesses, { guess: value, judgement }];
    setGuesses(next);
    if (isWin(judgement, digits)) {
      setStatus('won');
      if (!firedRef.current) {
        firedRef.current = true;
        onWin(next.length);
      }
    } else if (next.length >= maxAttempts) {
      setStatus('lost');
    }
  };

  return (
    <>
      <GuessPad digits={digits} disabled={status !== 'playing'} onSubmit={submit} />
      <section className="history-section">
        <div className="history-head">
          <span>history</span>
          <span className="attempts">{guesses.length}회</span>
        </div>
        <History guesses={guesses} />
      </section>
    </>
  );
}
