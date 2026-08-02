/**
 * 배경 연출 — 타자석(홈플레이트)에서 그라운드를 바라본 원근 다이아몬드.
 * 앱 전체 뒤에 깔리는 장식(pointer-events 없음). 위로 갈수록 페이드 아웃.
 * 색은 CSS(App.css의 .fb-* 클래스)에서 제어 — 전광판 팔레트(그린/화이트/레드).
 */
export function FieldBackdrop() {
  return (
    <div className="field-bg" aria-hidden="true">
      <svg viewBox="0 0 400 720" preserveAspectRatio="xMidYMax slice">
        {/* 파울/원근선 — 홈에서 외야로 뻗음 */}
        <g className="fb-lines">
          <line x1="200" y1="652" x2="8" y2="24" />
          <line x1="200" y1="652" x2="392" y2="24" />
        </g>
        {/* 내야 다이아몬드(원근) */}
        <polygon className="fb-diamond" points="200,632 344,410 200,246 56,410" />
        {/* 베이스 — 1·2·3루 */}
        <g className="fb-base">
          <polygon points="344,400 354,410 344,420 334,410" />
          <polygon points="200,236 210,246 200,256 190,246" />
          <polygon points="56,400 66,410 56,420 46,410" />
        </g>
        {/* 마운드 */}
        <circle className="fb-mound" cx="200" cy="422" r="16" />
        {/* 홈플레이트(하단 꼭짓점) */}
        <polygon className="fb-plate" points="182,636 218,636 218,652 200,666 182,652" />
      </svg>
    </div>
  );
}
