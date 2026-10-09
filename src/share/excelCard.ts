// 엑셀 위장 테마의 공유 이미지 — 전광판 카드 대신 '엑셀 창 스크린샷'처럼 그린다.
// 앱의 ExcelSolo 시트와 같은 배치(1행 제목 · 3행 머리글 No/코드/S/B/O · 그 아래 추측 기록 · 결과/기준값 행).
// S·B·O는 앱처럼 열 위치로 구분하고 글자색만 준다.
import { CARD_FORMATS, SHARE_URL, type CardFormat, type RecordSummary } from './recordCard';

const W = 1080;
const FONT = `Calibri, 'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Segoe UI', sans-serif`;
const UI = `'Segoe UI', 'Malgun Gothic', 'Apple SD Gothic Neo', system-ui, sans-serif`;

const C = {
  green: '#107c41',
  chrome: '#f3f3f3',
  head: '#f5f5f5',
  line: '#e1e1e1',
  lineDark: '#c8c8c8',
  text: '#1f1f1f',
  muted: '#7a7a7a',
  zero: '#a6a6a6',
  headCell: '#e8f2ec',
  headLine: '#9fc9b0',
  win: '#c6efce',
  link: '#0563c1',
  s: '#c55a11',
  b: '#0b8a3e',
  o: '#c00000',
};

const TITLE_H = 76;
const TABS_H = 64;
const FX_H = 60;
const COLHEAD_H = 44;
const TOP = TITLE_H + TABS_H + FX_H + COLHEAD_H;
const SHEETS_H = 60;
const STATUS_H = 44;
const BOTTOM = SHEETS_H + STATUS_H;
const ROWHEAD_W = 72;
/** 열 너비(A~G) — 남는 폭은 마지막 열이 먹는다. */
const COL_W = [110, 280, 150, 150, 150, 120];
const COLS = 'ABCDEFG'.split('');

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Align = 'left' | 'right' | 'center';
interface Cell {
  v: string;
  align?: Align;
  color?: string;
  bold?: boolean;
  fill?: string;
  size?: number;
  underline?: boolean;
  /** 옆 칸으로 넘쳐도 됨(제목·링크). */
  overflow?: boolean;
  headLine?: boolean;
}

export function drawExcelCard(r: RecordSummary, format: CardFormat = 'post'): HTMLCanvasElement {
  const fmt = CARD_FORMATS[format];
  const n = r.guesses.length;
  const won = r.status === 'won';

  // 내용 행: 제목·빈칸·머리글 + 기록 n + 빈칸·결과·빈칸·링크. 스토리는 아래 UI에 가리는 곳을 피해 맞춘다.
  const contentRows = n + 7;
  const bottomSafe = Math.max(BOTTOM, fmt.safeBottom);
  const fitRow = (fmt.h - TOP - bottomSafe) / contentRows;
  const rowH = Math.round(Math.max(40, Math.min(format === 'story' ? 84 : 76, fitRow)));
  const H = Math.max(fmt.h, TOP + contentRows * rowH + bottomSafe);
  const fs = Math.round(Math.min(34, rowH * 0.48));

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W, H);

  // 열 x 좌표
  const colX: number[] = [];
  let x = ROWHEAD_W;
  COL_W.forEach((w) => {
    colX.push(x);
    x += w;
  });
  colX.push(x);
  const lastW = W - x;
  const colWidth = (i: number) => (i < COL_W.length ? COL_W[i] : lastW);

  // ---------- 셀 내용 ----------
  const cells = new Map<string, Cell>();
  const set = (key: string, c: Cell) => cells.set(key, c);
  const head = (key: string, v: string) => set(key, { v, align: 'center', bold: true, fill: C.headCell, headLine: true });

  set('A1', { v: '3분기 실적 집계', bold: true, size: Math.round(fs * 1.15), overflow: true });
  set('E1', { v: `${n}/${r.maxAttempts}`, align: 'right', color: C.muted });
  set('A2', { v: `${r.digits}자리 · ${today()}`, color: C.muted, size: Math.round(fs * 0.8), overflow: true });
  ['No', '코드', 'S', 'B', 'O'].forEach((h, i) => head(`${COLS[i]}3`, h));
  r.guesses.forEach((g, i) => {
    const row = 4 + i;
    const s = g.judgement.strikes;
    const b = g.judgement.balls;
    const o = r.digits - s - b;
    const fill = won && i === n - 1 ? C.win : undefined;
    const bold = !!fill;
    set(`A${row}`, { v: String(i + 1), align: 'center', color: C.muted, fill });
    set(`B${row}`, { v: g.guess, align: 'right', fill, bold });
    set(`C${row}`, { v: String(s), align: 'right', color: s ? C.s : C.zero, bold: !!s, fill });
    set(`D${row}`, { v: String(b), align: 'right', color: b ? C.b : C.zero, bold: !!b, fill });
    set(`E${row}`, { v: String(o), align: 'right', color: o ? C.o : C.zero, bold: !!o, fill });
  });
  const resRow = 4 + n + 1;
  head(`A${resRow}`, '결과');
  set(`B${resRow}`, { v: won ? '달성' : '미달', align: 'center', bold: true, color: won ? C.b : C.o });
  head(`C${resRow}`, '기준값');
  set(`D${resRow}`, { v: r.secret || '-', align: 'right', overflow: false });
  const linkRow = resRow + 2;
  set(`A${linkRow}`, { v: SHARE_URL.replace('https://', ''), color: C.link, underline: true, overflow: true });

  // ---------- 격자 ----------
  const gridBottom = H - BOTTOM;
  const rows = Math.ceil((gridBottom - TOP) / rowH);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, TOP, W, gridBottom - TOP);
  ctx.clip();

  // 채우기 먼저(선 아래)
  for (const [key, c] of cells) {
    if (!c.fill) continue;
    const ci = COLS.indexOf(key[0]);
    const ri = Number(key.slice(1));
    ctx.fillStyle = c.fill;
    ctx.fillRect(colX[ci], TOP + (ri - 1) * rowH, colWidth(ci), rowH);
  }

  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  for (let i = 1; i <= rows; i++) {
    const y = TOP + i * rowH - 1;
    ctx.beginPath();
    ctx.moveTo(ROWHEAD_W, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let i = 1; i <= COLS.length; i++) {
    const cx = colX[i] - 1;
    ctx.beginPath();
    ctx.moveTo(cx, TOP);
    ctx.lineTo(cx, gridBottom);
    ctx.stroke();
  }
  // 머리글 칸 아래 진한 선
  for (const [key, c] of cells) {
    if (!c.headLine) continue;
    const ci = COLS.indexOf(key[0]);
    const ri = Number(key.slice(1));
    ctx.fillStyle = C.headLine;
    ctx.fillRect(colX[ci], TOP + ri * rowH - 2, colWidth(ci), 2);
  }

  // 글자
  ctx.textBaseline = 'middle';
  for (const [key, c] of cells) {
    const ci = COLS.indexOf(key[0]);
    const ri = Number(key.slice(1));
    const cx = colX[ci];
    const cw = colWidth(ci);
    const cy = TOP + (ri - 1) * rowH + rowH / 2;
    const size = c.size ?? fs;
    ctx.font = `${c.bold ? 700 : 400} ${size}px ${FONT}`;
    ctx.fillStyle = c.color ?? C.text;
    const pad = 12;
    const align = c.align ?? 'left';
    ctx.textAlign = align;
    const tx = align === 'left' ? cx + pad : align === 'right' ? cx + cw - pad : cx + cw / 2;
    ctx.save();
    if (!c.overflow) {
      ctx.beginPath();
      ctx.rect(cx, cy - rowH / 2, cw, rowH);
      ctx.clip();
    }
    ctx.fillText(c.v, tx, cy);
    if (c.underline) {
      const tw = ctx.measureText(c.v).width;
      ctx.fillRect(tx, cy + size * 0.5, tw, 2);
    }
    ctx.restore();
  }

  // 선택 셀(마지막 기록의 코드 칸) — 초록 테두리 + 채우기 핸들
  const selRow = Math.max(4, 3 + n);
  const sx = colX[1];
  const sy = TOP + (selRow - 1) * rowH;
  ctx.strokeStyle = C.green;
  ctx.lineWidth = 4;
  ctx.strokeRect(sx + 1, sy + 1, colWidth(1) - 3, rowH - 3);
  ctx.fillStyle = C.green;
  ctx.fillRect(sx + colWidth(1) - 7, sy + rowH - 7, 10, 10);
  ctx.restore();

  // 행 머리글
  ctx.fillStyle = C.head;
  ctx.fillRect(0, TOP, ROWHEAD_W, gridBottom - TOP);
  ctx.font = `400 ${Math.round(Math.min(24, rowH * 0.38))}px ${UI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < rows; i++) {
    const y = TOP + i * rowH;
    if (y >= gridBottom) break;
    const on = i + 1 === selRow;
    if (on) {
      ctx.fillStyle = '#d3f0e0';
      ctx.fillRect(0, y, ROWHEAD_W, rowH);
      ctx.fillStyle = C.green;
      ctx.fillRect(ROWHEAD_W - 4, y, 4, rowH);
    }
    ctx.fillStyle = on ? C.green : '#555';
    ctx.fillText(String(i + 1), ROWHEAD_W / 2, y + rowH / 2);
    ctx.fillStyle = C.line;
    ctx.fillRect(0, y + rowH - 2, ROWHEAD_W, 2);
  }
  ctx.fillStyle = C.lineDark;
  ctx.fillRect(ROWHEAD_W - 2, TOP, 2, gridBottom - TOP);

  // ---------- 위쪽 창 틀 ----------
  // 제목줄
  ctx.fillStyle = C.green;
  ctx.fillRect(0, 0, W, TITLE_H);
  ctx.fillStyle = '#fff';
  ctx.font = `400 28px ${UI}`;
  ctx.textAlign = 'center';
  ctx.fillText('업무보고_2026Q3.xlsx - Excel', W / 2, TITLE_H / 2);
  // 창 버튼(— □ ✕)
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.5;
  const by = TITLE_H / 2;
  ctx.beginPath();
  ctx.moveTo(W - 176, by);
  ctx.lineTo(W - 156, by);
  ctx.stroke();
  ctx.strokeRect(W - 118, by - 10, 20, 20);
  ctx.beginPath();
  ctx.moveTo(W - 58, by - 10);
  ctx.lineTo(W - 38, by + 10);
  ctx.moveTo(W - 38, by - 10);
  ctx.lineTo(W - 58, by + 10);
  ctx.stroke();
  // 저장 아이콘 자리(왼쪽) — 작은 시트 아이콘
  ctx.fillStyle = '#fff';
  ctx.fillRect(28, by - 16, 32, 32);
  ctx.fillStyle = C.green;
  ctx.font = `700 22px ${UI}`;
  ctx.fillText('X', 44, by + 1);

  // 메뉴 탭
  ctx.fillStyle = C.chrome;
  ctx.fillRect(0, TITLE_H, W, TABS_H);
  ctx.textAlign = 'left';
  ctx.font = `400 26px ${UI}`;
  let tx = 30;
  ['파일', '홈', '삽입', '페이지 레이아웃', '수식', '데이터', '검토', '보기'].forEach((t) => {
    const w = ctx.measureText(t).width;
    const home = t === '홈';
    ctx.fillStyle = home ? C.green : t === '파일' ? C.green : '#444';
    ctx.font = `${home ? 700 : 400} 26px ${UI}`;
    ctx.fillText(t, tx, TITLE_H + TABS_H / 2);
    if (home) ctx.fillRect(tx - 4, TITLE_H + TABS_H - 5, w + 8, 5);
    tx += w + 40;
  });
  ctx.fillStyle = C.line;
  ctx.fillRect(0, TITLE_H + TABS_H - 1, W, 1);

  // 수식 입력줄 — 이름 상자 + fx + 선택 셀 값
  const fy = TITLE_H + TABS_H;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, fy, W, FX_H);
  ctx.strokeStyle = C.lineDark;
  ctx.lineWidth = 2;
  ctx.strokeRect(14, fy + 10, 150, FX_H - 20);
  ctx.fillStyle = C.text;
  ctx.font = `400 24px ${UI}`;
  ctx.fillText(`B${selRow}`, 28, fy + FX_H / 2);
  ctx.fillStyle = C.muted;
  ctx.font = `italic 400 26px Georgia, serif`;
  ctx.fillText('fx', 190, fy + FX_H / 2);
  ctx.fillStyle = C.lineDark;
  ctx.fillRect(232, fy + 10, 2, FX_H - 20);
  ctx.fillStyle = C.text;
  ctx.font = `400 26px ${FONT}`;
  ctx.fillText(r.guesses[n - 1]?.guess ?? '', 252, fy + FX_H / 2);
  ctx.fillStyle = C.line;
  ctx.fillRect(0, fy + FX_H - 1, W, 1);

  // 열 머리글
  const hy = fy + FX_H;
  ctx.fillStyle = C.head;
  ctx.fillRect(0, hy, W, COLHEAD_H);
  ctx.font = `400 22px ${UI}`;
  ctx.textAlign = 'center';
  COLS.forEach((c, i) => {
    const on = i === 1;
    if (on) {
      ctx.fillStyle = '#d3f0e0';
      ctx.fillRect(colX[i], hy, colWidth(i), COLHEAD_H);
      ctx.fillStyle = C.green;
      ctx.fillRect(colX[i], hy + COLHEAD_H - 4, colWidth(i), 4);
    }
    ctx.fillStyle = on ? C.green : '#555';
    ctx.fillText(c, colX[i] + colWidth(i) / 2, hy + COLHEAD_H / 2);
    ctx.fillStyle = C.line;
    ctx.fillRect(colX[i + 1] - 2, hy, 2, COLHEAD_H);
  });
  ctx.fillStyle = C.lineDark;
  ctx.fillRect(0, hy + COLHEAD_H - 2, W, 2);

  // ---------- 아래 창 틀 ----------
  // 시트 탭
  const sy0 = gridBottom;
  ctx.fillStyle = C.chrome;
  ctx.fillRect(0, sy0, W, SHEETS_H + STATUS_H);
  ctx.fillStyle = C.lineDark;
  ctx.fillRect(0, sy0, W, 2);
  ctx.textAlign = 'center';
  let sx0 = 110;
  ctx.fillStyle = '#888';
  ctx.font = `400 24px ${UI}`;
  ctx.fillText('◀  ▶', 55, sy0 + SHEETS_H / 2);
  ['매출현황', '협업일정', '거래처'].forEach((t, i) => {
    ctx.font = `${i === 0 ? 700 : 400} 24px ${UI}`;
    const w = ctx.measureText(t).width + 48;
    if (i === 0) {
      ctx.fillStyle = '#fff';
      ctx.fillRect(sx0, sy0 + 2, w, SHEETS_H - 2);
      ctx.fillStyle = C.green;
      ctx.fillRect(sx0 + 12, sy0 + SHEETS_H - 6, w - 24, 4);
    }
    ctx.fillStyle = i === 0 ? C.green : '#444';
    ctx.fillText(t, sx0 + w / 2, sy0 + SHEETS_H / 2);
    ctx.fillStyle = C.line;
    ctx.fillRect(sx0 + w, sy0 + 12, 2, SHEETS_H - 24);
    sx0 += w + 2;
  });
  ctx.fillStyle = '#666';
  ctx.font = `400 30px ${UI}`;
  ctx.fillText('+', sx0 + 30, sy0 + SHEETS_H / 2);

  // 상태 표시줄 — 준비 · 선택 영역 통계(엑셀처럼) · 확대 비율
  const st = sy0 + SHEETS_H;
  ctx.fillStyle = C.line;
  ctx.fillRect(0, st, W, 1);
  ctx.font = `400 22px ${UI}`;
  ctx.fillStyle = '#444';
  ctx.textAlign = 'left';
  ctx.fillText('준비', 24, st + STATUS_H / 2);
  ctx.textAlign = 'right';
  const strikes = r.guesses.reduce((sum, g) => sum + g.judgement.strikes, 0);
  ctx.fillText(`개수: ${n}    합계: ${strikes}        100%`, W - 24, st + STATUS_H / 2);

  return canvas;
}
