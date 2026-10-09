import { XL_COLS, type XlCell, type XlCells, type XlSection } from './excel';

/**
 * 엑셀 위장 시트의 오른쪽 '더미 업무 표' — 게임 칸 말고는 빈 시트라 허전해서, 진짜 보고서처럼 이어 붙인다.
 * 값은 고정(매번 같은 숫자), 합계·비율 칸엔 실제 수식이 있어 셀을 누르면 수식 입력줄에 뜬다. 클릭 동작은 없음.
 * 게임 칸을 덮지 않게 이미 있는 셀은 건드리지 않는다.
 */

const won = (n: number) => n.toLocaleString('ko-KR');
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

type Cell = string | number | XlCell;

/** startCol·row부터 행 단위로 채운다. 숫자는 오른쪽 정렬·천 단위 구분. */
function put(m: XlCells, col: number, row: number, cells: Cell[]) {
  cells.forEach((c, i) => {
    const key = `${XL_COLS[col + i]}${row}`;
    if (m.has(key)) return;
    const cell: XlCell =
      typeof c === 'number'
        ? { v: won(c), f: String(c), cls: 'xl-r' }
        : typeof c === 'string'
          ? { v: c }
          : c;
    m.set(key, cell);
  });
}
const head = (m: XlCells, col: number, row: number, labels: string[]) =>
  put(m, col, row, labels.map((v) => ({ v, cls: 'xl-head-cell xl-c' })));
const title = (m: XlCells, col: number, row: number, v: string) => put(m, col, row, [{ v, cls: 'xl-title-cell' }]);
const note = (m: XlCells, col: number, row: number, v: string) => put(m, col, row, [{ v, cls: 'xl-muted xl-small' }]);

// ---------- 매출현황(솔로) ----------
const MONTHS: [string, number, number][] = [
  ['1월', 41200, 39850],
  ['2월', 38500, 40120],
  ['3월', 45000, 47310],
  ['4월', 44000, 42780],
  ['5월', 46500, 48920],
  ['6월', 47000, 45160],
  ['7월', 49500, 51870],
  ['8월', 48000, 46240],
  ['9월', 52000, 55630],
];
const PRODUCTS: [string, number][] = [
  ['본체', 72480],
  ['부품', 41260],
  ['소모품', 23910],
  ['유지보수', 11870],
  ['기타', 4220],
];

function sales(m: XlCells, c: number) {
  const L = (i: number) => XL_COLS[c + i];
  title(m, c, 1, '월별 매출 현황');
  note(m, c + 3, 1, '(단위: 천원)');
  head(m, c, 3, ['월', '목표', '실적', '달성률', '전월비']);
  MONTHS.forEach(([mon, goal, act], i) => {
    const r = 4 + i;
    const prev = i > 0 ? MONTHS[i - 1][2] : null;
    put(m, c, r, [
      { v: mon, cls: 'xl-c' },
      goal,
      act,
      { v: pct(act / goal), f: `=${L(2)}${r}/${L(1)}${r}`, cls: `xl-r${act < goal ? ' xl-neg' : ''}` },
      prev == null
        ? { v: '-', cls: 'xl-r xl-muted' }
        : {
            v: `${act >= prev ? '▲' : '▼'} ${pct(Math.abs(act / prev - 1))}`,
            f: `=${L(2)}${r}/${L(2)}${r - 1}-1`,
            cls: `xl-r${act < prev ? ' xl-neg' : ''}`,
          },
    ]);
  });
  const end = 3 + MONTHS.length;
  const tr = end + 1;
  const goal = MONTHS.reduce((s, x) => s + x[1], 0);
  const act = MONTHS.reduce((s, x) => s + x[2], 0);
  put(m, c, tr, [
    { v: '합계', cls: 'xl-c xl-total' },
    { v: won(goal), f: `=SUM(${L(1)}4:${L(1)}${end})`, cls: 'xl-r xl-total' },
    { v: won(act), f: `=SUM(${L(2)}4:${L(2)}${end})`, cls: 'xl-r xl-total' },
    { v: pct(act / goal), f: `=${L(2)}${tr}/${L(1)}${tr}`, cls: 'xl-r xl-total' },
    { v: '', cls: 'xl-total' },
  ]);

  const p0 = tr + 3;
  title(m, c, p0, '제품군별 3분기 실적');
  head(m, c, p0 + 2, ['제품군', '매출', '비중', '담당']);
  const sum = PRODUCTS.reduce((s, x) => s + x[1], 0);
  const owners = ['영업1팀', '영업2팀', '영업1팀', 'CS팀', '영업2팀'];
  PRODUCTS.forEach(([name, v], i) => {
    const r = p0 + 3 + i;
    put(m, c, r, [
      name,
      v,
      { v: pct(v / sum), f: `=${L(1)}${r}/${L(1)}$${p0 + 3 + PRODUCTS.length}`, cls: 'xl-r' },
      { v: owners[i], cls: 'xl-c' },
    ]);
  });
  const sr = p0 + 3 + PRODUCTS.length;
  put(m, c, sr, [
    { v: '합계', cls: 'xl-c xl-total' },
    { v: won(sum), f: `=SUM(${L(1)}${p0 + 3}:${L(1)}${sr - 1})`, cls: 'xl-r xl-total' },
    { v: '100.0%', f: `=SUM(${L(2)}${p0 + 3}:${L(2)}${sr - 1})`, cls: 'xl-r xl-total' },
    { v: '', cls: 'xl-total' },
  ]);
  note(m, c, sr + 2, '※ 부가세 별도, 반품 차감 후 금액');
}

// ---------- 협업일정(멀티) ----------
const TASKS: [string, string, string, number][] = [
  ['09-01', '김대리', '주간회의', 1],
  ['09-03', '이과장', '견적검토', 1],
  ['09-08', '박주임', '납품확인', 1],
  ['09-11', '최차장', '계약갱신', 1],
  ['09-15', '김대리', '월간보고', 1],
  ['09-18', '정사원', '재고실사', 0.8],
  ['09-22', '이과장', '예산조정', 0.6],
  ['09-25', '박주임', '교육이수', 0.5],
  ['09-29', '최차장', '감사대응', 0.3],
  ['10-02', '김대리', '분기결산', 0.1],
  ['10-06', '정사원', '자료정리', 0],
  ['10-13', '이과장', '거래처방문', 0],
];
const statusOf = (p: number) => (p >= 1 ? '완료' : p > 0 ? '진행' : '예정');

function schedule(m: XlCells, c: number) {
  const L = (i: number) => XL_COLS[c + i];
  title(m, c, 1, '3분기 협업 일정');
  note(m, c + 3, 1, '기준일: 10-09');
  head(m, c, 3, ['일자', '담당', '업무', '진행률', '상태']);
  TASKS.forEach(([d, who, task, p], i) => {
    const r = 4 + i;
    const st = statusOf(p);
    put(m, c, r, [
      { v: d, cls: 'xl-c' },
      { v: who, cls: 'xl-c' },
      task,
      { v: `${Math.round(p * 100)}%`, f: String(p), cls: 'xl-r' },
      {
        v: st,
        f: `=IF(${L(3)}${r}>=1,"완료",IF(${L(3)}${r}>0,"진행","예정"))`,
        cls: `xl-c${st === '진행' ? ' xl-warn' : st === '예정' ? ' xl-muted' : ''}`,
      },
    ]);
  });
  const end = 3 + TASKS.length;
  const s0 = end + 3;
  title(m, c, s0, '상태별 집계');
  head(m, c, s0 + 2, ['상태', '건수', '비율']);
  (['완료', '진행', '예정'] as const).forEach((st, i) => {
    const r = s0 + 3 + i;
    const n = TASKS.filter((t) => statusOf(t[3]) === st).length;
    put(m, c, r, [
      { v: st, cls: 'xl-c' },
      { v: n, f: `=COUNTIF(${L(4)}$4:${L(4)}$${end},"${st}")`, cls: 'xl-r' },
      { v: pct(n / TASKS.length), f: `=${L(1)}${r}/COUNTA(${L(4)}$4:${L(4)}$${end})`, cls: 'xl-r' },
    ]);
  });
  note(m, c, s0 + 7, '※ 일정 변경 시 팀 채널에 공유 바랍니다');
}

// ---------- 거래처(KBO) ----------
const CLIENTS: [string, string, string, number, string][] = [
  ['C-1021', '한빛상사', 'A', 128400, '09-27'],
  ['C-1034', '동양물산', 'A', 97650, '09-30'],
  ['C-1047', '대성유통', 'B', 64210, '09-19'],
  ['C-1052', '세진테크', 'A', 112980, '10-02'],
  ['C-1068', '미래산업', 'C', 21340, '08-14'],
  ['C-1073', '우리식품', 'B', 48770, '09-24'],
  ['C-1089', '태평양', 'B', 55120, '09-11'],
  ['C-1095', '신화전자', 'A', 103400, '10-04'],
  ['C-1102', '금강건설', 'C', 18900, '07-29'],
  ['C-1116', '한결물류', 'B', 42660, '09-08'],
  ['C-1123', '서울기계', 'C', 26080, '08-21'],
  ['C-1137', '성우화학', 'B', 51930, '09-26'],
];

function clients(m: XlCells, c: number) {
  const L = (i: number) => XL_COLS[c + i];
  title(m, c, 1, '거래처별 거래 현황');
  note(m, c + 3, 1, '(단위: 천원)');
  head(m, c, 3, ['코드', '거래처', '등급', '거래액', '최근거래']);
  CLIENTS.forEach(([code, name, g, amt, last], i) => {
    put(m, c, 4 + i, [
      { v: code, cls: 'xl-muted' },
      name,
      { v: g, cls: 'xl-c' },
      amt,
      { v: last, cls: 'xl-c' },
    ]);
  });
  const end = 3 + CLIENTS.length;
  const s0 = end + 3;
  title(m, c, s0, '등급별 요약');
  head(m, c, s0 + 2, ['등급', '거래처', '거래액', '비중']);
  const total = CLIENTS.reduce((s, x) => s + x[3], 0);
  ['A', 'B', 'C'].forEach((g, i) => {
    const r = s0 + 3 + i;
    const rows = CLIENTS.filter((x) => x[2] === g);
    const amt = rows.reduce((s, x) => s + x[3], 0);
    put(m, c, r, [
      { v: g, cls: 'xl-c' },
      { v: rows.length, f: `=COUNTIF(${L(2)}$4:${L(2)}$${end},"${g}")`, cls: 'xl-r' },
      { v: won(amt), f: `=SUMIF(${L(2)}$4:${L(2)}$${end},"${g}",${L(3)}$4:${L(3)}$${end})`, cls: 'xl-r' },
      { v: pct(amt / total), f: `=${L(2)}${r}/SUM(${L(3)}$4:${L(3)}$${end})`, cls: 'xl-r' },
    ]);
  });
  note(m, c, s0 + 7, '※ C등급은 분기 내 재평가 예정');
}

/** 시트별 더미 표를 col(열 이름)부터 채운다. */
export function fillDummy(m: XlCells, sheet: XlSection, col: string) {
  const c = XL_COLS.indexOf(col);
  if (sheet === 'solo') sales(m, c);
  else if (sheet === 'multi') schedule(m, c);
  else clients(m, c);
}
