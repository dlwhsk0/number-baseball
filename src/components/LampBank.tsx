/**
 * B·S·O 카운트 전구 뱅크 — 실제 야구장 전광판의 스트라이크·볼·아웃 램프.
 * 우리 게임 판정이 곧 S·B·O라 직전 추측의 결과를 전구로 점등해 보여준다.
 * 값은 History가 텍스트로도 알려주므로 여기선 장식(aria-hidden).
 */
const ROWS = [
  { key: 'strike', label: 'STRIKE' },
  { key: 'ball', label: 'BALL' },
  { key: 'out', label: 'OUT' },
] as const;

interface Props {
  strikes: number;
  balls: number;
  outs: number;
  /** 한 줄에 놓을 전구 수(= 자릿수, 각 카운트의 최댓값). */
  digits: number;
}

export function LampBank({ strikes, balls, outs, digits }: Props) {
  const value = { strike: strikes, ball: balls, out: outs };
  return (
    <div className="lampbank" aria-hidden="true">
      {ROWS.map(({ key, label }) => (
        <div key={key} className={`lamp lamp-${key}`}>
          <span className="lamp-label">{label}</span>
          <span className="bulbs">
            {Array.from({ length: digits }, (_, i) => (
              <span key={i} className={`bulb${i < value[key] ? ' on' : ''}`} />
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}
