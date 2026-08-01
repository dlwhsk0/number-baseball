import type { ReactNode } from 'react';
import type { Judgement } from '../game/logic';
import { Seg7 } from './Seg7';

const SBO = [
  { key: 'strike', letter: 'S' },
  { key: 'ball', letter: 'B' },
  { key: 'out', letter: 'O' },
] as const;

/** 특이 이벤트에만 강조 멘트(평범하면 null → 멘트 없음). */
function eventReaction(
  j: Judgement,
  digits: number,
  solved: boolean,
): { text: string; kind: string } | null {
  if (solved) return { text: '정답!', kind: 'win' };
  if (j.isOut) return { text: digits >= 4 ? '포 아웃' : '쓰리 아웃', kind: 'out' };
  if (j.balls === digits) return { text: '올 볼', kind: 'ball' };
  if (j.strikes === digits - 1) return { text: '한 끗 차이!', kind: 'near' };
  return null;
}

/** 추측 결과 발표 카드 — 큰 숫자 + S/B/O 전구 + 특이 이벤트 강조. 온라인·혼자 공용. */
export function RevealCard({
  guess,
  judgement,
  digits,
  solved = false,
  who,
  tone,
}: {
  guess: string;
  judgement: Judgement;
  digits: number;
  solved?: boolean;
  /** 카드 상단 라벨(누구의 결과인지). 없으면 라벨 생략. */
  who?: ReactNode;
  /** 색조: 내 결과(그린 테두리) / 상대 결과. */
  tone?: 'mine' | 'theirs';
}) {
  const s = judgement.strikes;
  const b = judgement.balls;
  const counts: Record<string, number> = { strike: s, ball: b, out: digits - s - b };
  const react = eventReaction(judgement, digits, solved);
  const toneClass = tone === 'mine' ? ' mine' : tone === 'theirs' ? ' theirs' : '';

  return (
    <div
      className={`reveal-card${solved ? ' solved' : ''}${toneClass}${
        react ? ` event-${react.kind}` : ''
      }`}
    >
      {who && <p className="reveal-who">{who}</p>}
      <span className="num-cells">
        {guess.split('').map((c, i) => (
          <span key={i} className="cell hcell">
            <Seg7 char={c} />
          </span>
        ))}
      </span>
      <div className="sbo reveal-sbo">
        {SBO.map(({ key, letter }) => (
          <span key={key} className={`hsbo lamp-${key}${counts[key] === 0 ? ' zero' : ''}`}>
            <span className="hsbo-letter">{letter}</span>
            <span className="bulbs">
              {Array.from({ length: digits }, (_, k) => (
                <span key={k} className={`bulb${k < counts[key] ? ' on' : ''}`} />
              ))}
            </span>
          </span>
        ))}
      </div>
      {react && <p className={`reveal-reaction react-${react.kind}`}>{react.text}</p>}
    </div>
  );
}
