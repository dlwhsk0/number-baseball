/**
 * 엑셀 위장 테마의 창 틀 — 제목줄·리본·수식 입력줄·열/행 머리글·시트 탭·상태 표시줄.
 * 전부 화면에 고정(position:fixed)된 장식이고, 실제로 동작하는 건 셋뿐이다:
 *   [파일] 탭 = 설정, [도움말] 탭 = 게임 방법, 하단 시트 탭 = 솔로/멀티/KBO 전환.
 * 스타일은 src/excel-theme.css(:root[data-theme='excel'] 스코프).
 */
type Section = 'solo' | 'multi' | 'kbo';

interface Props {
  section: Section;
  onSection: (s: Section) => void;
  onHelp: () => void;
  onSettings: () => void;
  /** 지금까지 추측 수 — 이름 상자·수식·상태 표시줄 숫자를 바꿔 '작업 중'처럼 보이게. */
  attempt: number;
}

const COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const ROWS = Array.from({ length: 80 }, (_, i) => i + 1);
const RIBBON_TABS = ['홈', '삽입', '그리기', '페이지 레이아웃', '수식', '데이터', '검토', '보기'];
const SHEETS: { id: Section; label: string }[] = [
  { id: 'solo', label: '매출현황' },
  { id: 'multi', label: '협업일정' },
  { id: 'kbo', label: '거래처' },
];
const FORMULAS = [
  '=SUMIFS(매출!C:C,매출!A:A,"3분기")',
  '=VLOOKUP(B3,거래처!$A:$D,2,FALSE)',
  '=IFERROR(C7/D7,0)',
  '=ROUND(AVERAGE(E2:E48),1)',
  '=XLOOKUP(A12,코드!A:A,코드!B:B)',
  '=COUNTIF(F:F,">=1000000")',
  '=SUMPRODUCT((G2:G99="완료")*H2:H99)',
  '=TEXT(TODAY(),"yyyy-mm-dd")',
];

export function ExcelChrome({ section, onSection, onHelp, onSettings, attempt }: Props) {
  const row = attempt + 2;
  return (
    <>
      <div className="xl-top">
        <div className="xl-title">
          <span className="xl-autosave">
            자동 저장 <span className="xl-toggle" aria-hidden="true" />
          </span>
          <span className="xl-filename">업무보고_2026Q3.xlsx · 저장됨</span>
          <span className="xl-win" aria-hidden="true">
            <i>─</i>
            <i>☐</i>
            <i>✕</i>
          </span>
        </div>
        <nav className="xl-tabs">
          <button type="button" className="xl-tab xl-file" onClick={onSettings} aria-label="설정">
            파일
          </button>
          {RIBBON_TABS.map((t) => (
            <span key={t} className={`xl-tab${t === '홈' ? ' on' : ''}`} aria-hidden="true">
              {t}
            </span>
          ))}
          <button type="button" className="xl-tab" onClick={onHelp} aria-label="게임 방법">
            도움말
          </button>
        </nav>
        <div className="xl-ribbon" aria-hidden="true">
          <div className="xl-group">
            <span className="xl-big">📋</span>
            <span className="xl-glabel">붙여넣기</span>
          </div>
          <div className="xl-group xl-font">
            <span className="xl-box wide">맑은 고딕</span>
            <span className="xl-box">11</span>
            <span className="xl-fmt">
              <b>가</b>
              <i>가</i>
              <u>가</u>
            </span>
            <span className="xl-glabel">글꼴</span>
          </div>
          <div className="xl-group">
            <span className="xl-lines">≡ ≡ ≡</span>
            <span className="xl-glabel">맞춤</span>
          </div>
          <div className="xl-group">
            <span className="xl-box wide">일반</span>
            <span className="xl-glabel">표시 형식</span>
          </div>
          <div className="xl-group">
            <span className="xl-lines">▦ 조건부 서식</span>
            <span className="xl-glabel">스타일</span>
          </div>
          <div className="xl-group">
            <span className="xl-lines">Σ 자동 합계</span>
            <span className="xl-glabel">편집</span>
          </div>
        </div>
        <div className="xl-formula" aria-hidden="true">
          <span className="xl-namebox">B{row}</span>
          <span className="xl-fx">
            <i>✕</i>
            <i>✓</i>
            <em>fx</em>
          </span>
          <span className="xl-ftext">{FORMULAS[attempt % FORMULAS.length]}</span>
        </div>
        <div className="xl-colhead" aria-hidden="true">
          <span className="xl-corner" />
          {COLS.map((c) => (
            <span key={c} className={c === 'B' ? 'on' : undefined}>
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="xl-rowhead" aria-hidden="true">
        {ROWS.map((r) => (
          <span key={r} className={r === row ? 'on' : undefined}>
            {r}
          </span>
        ))}
      </div>
      <div className="xl-grid" aria-hidden="true" />

      <div className="xl-bottom">
        <div className="xl-sheets" role="tablist" aria-label="모드 선택">
          <span className="xl-nav" aria-hidden="true">
            ◀ ▶
          </span>
          {SHEETS.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={section === s.id}
              className={`xl-sheet${section === s.id ? ' on' : ''}`}
              onClick={() => onSection(s.id)}
            >
              {s.label}
            </button>
          ))}
          <span className="xl-add" aria-hidden="true">
            ⊕
          </span>
        </div>
        <div className="xl-status" aria-hidden="true">
          <span>준비</span>
          <span className="xl-stat">
            평균: {(1_284_500 / (attempt + 3)).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
            <span>개수: {attempt + 3}</span>
            <span>합계: 1,284,500</span>
          </span>
          <span className="xl-zoom">▭ ▦ ─●─ 100%</span>
        </div>
      </div>
    </>
  );
}
