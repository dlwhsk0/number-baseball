/**
 * 배경 연출 — 타자석(홈플레이트)에서 그라운드를 바라본 원근 야구장.
 * 잔디 부채꼴 + 내야 다이아몬드 + 베이스 + 마운드 + 홈플레이트.
 * 앱 전체 뒤에 깔리는 장식(pointer-events 없음). 위로 갈수록 페이드(App.css의 mask).
 * 색은 App.css의 .fb-* 클래스에서 제어 — 전광판 팔레트(그린/화이트/흙).
 */
export function FieldBackdrop() {
  return (
    <div className="field-bg" aria-hidden="true">
      <svg viewBox="0 0 400 700" preserveAspectRatio="xMidYMax slice">
        {/* 잔디 부채꼴(외야까지) */}
        <path className="fb-grass" d="M200 606 L36 128 Q200 44 364 128 Z" />
        {/* 파울선 */}
        <g className="fb-foul">
          <line x1="200" y1="600" x2="42" y2="132" />
          <line x1="200" y1="600" x2="358" y2="132" />
        </g>
        {/* 내야 다이아몬드(베이스 패스) */}
        <polygon className="fb-infield" points="200,592 318,458 200,330 82,458" />
        {/* 베이스 — 1루(우)·2루(원경)·3루(좌) */}
        <g className="fb-base">
          <rect x="311" y="451" width="14" height="14" transform="rotate(45 318 458)" />
          <rect x="193" y="323" width="14" height="14" transform="rotate(45 200 330)" />
          <rect x="75" y="451" width="14" height="14" transform="rotate(45 82 458)" />
        </g>
        {/* 마운드 */}
        <circle className="fb-mound" cx="200" cy="470" r="15" />
        {/* 홈플레이트(하단 꼭짓점) */}
        <polygon className="fb-plate" points="188,596 212,596 212,606 200,616 188,606" />
      </svg>
    </div>
  );
}
