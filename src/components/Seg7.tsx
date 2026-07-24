/**
 * 세븐세그먼트 숫자 한 자리. 전광판 판독값 느낌 — 켜진 세그먼트는 발광,
 * 꺼진 세그먼트는 흐릿하게 남는다(고스트). 색·크기는 CSS 변수/부모에서 제어.
 * 세그먼트 도형은 CSS로 그리므로 외부 폰트가 필요 없다(오프라인 PWA 안전).
 */
const SEGMENTS = ['sa', 'sb', 'sc', 'sd', 'se', 'sf', 'sg'] as const;

interface Props {
  /** '0'~'9' 한 글자. 그 외(빈 문자열 등)는 모든 세그먼트가 꺼진 상태. */
  char?: string;
}

export function Seg7({ char }: Props) {
  const lit = char != null && char >= '0' && char <= '9';
  return (
    <span className={`seg7${lit ? ` d${char}` : ''}`}>
      {SEGMENTS.map((s) => (
        <i key={s} className={s} aria-hidden="true" />
      ))}
      {lit && <span className="sr-only">{char}</span>}
    </span>
  );
}
