// 솔로 한 판 기록 → 공유용 이미지(PNG)·문구.
// 외부 라이브러리 없이 Canvas 2D로 직접 그린다(세븐세그먼트 숫자·S/B/O 전구까지 앱과 같은 표현).
import type { GameStatus, GuessRecord } from '../game/useGame';

export const SHARE_URL = 'https://homerun-bb.vercel.app';

export interface RecordSummary {
  status: GameStatus;
  secret: string;
  digits: number;
  maxAttempts: number;
  guesses: GuessRecord[];
}

/** 스포일러 없는 공유 문구(워들 스타일) — 숫자 대신 S·B·O 색 이모지만. */
export function buildShareText(r: RecordSummary): string {
  const n = r.guesses.length;
  const head =
    r.status === 'won'
      ? `⚾ 숫자 야구 ${r.digits}자리 — ${n}번 만에 정답! 🏆`
      : `⚾ 숫자 야구 ${r.digits}자리 — ${r.maxAttempts}번 안에 못 맞혔어요 😢`;
  const rows = r.guesses.map(({ judgement: j }) => {
    const out = r.digits - j.strikes - j.balls;
    return '🟠'.repeat(j.strikes) + '🟢'.repeat(j.balls) + '🔴'.repeat(out);
  });
  return `${head}\n${rows.join('\n')}\n\n나도 해보기 👉 ${SHARE_URL}`;
}

// ---------- 캔버스 ----------

const W = 1080;
const FONT = `system-ui, -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Segoe UI', sans-serif`;
const MONO = `ui-monospace, 'SF Mono', 'Roboto Mono', Menlo, monospace`;

type Seg = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g';
const DIGIT_SEGS: Record<string, Seg[]> = {
  '0': ['a', 'b', 'c', 'd', 'e', 'f'],
  '1': ['b', 'c'],
  '2': ['a', 'b', 'g', 'e', 'd'],
  '3': ['a', 'b', 'g', 'c', 'd'],
  '4': ['f', 'g', 'b', 'c'],
  '5': ['a', 'f', 'g', 'c', 'd'],
  '6': ['a', 'f', 'g', 'e', 'd', 'c'],
  '7': ['a', 'b', 'c'],
  '8': ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
  '9': ['a', 'b', 'c', 'd', 'f', 'g'],
};

interface Palette {
  bg: string;
  text: string;
  muted: string;
  led: string;
  accent: string;
  strike: string;
  ball: string;
  out: string;
  panel: string;
  cell: string;
  ghost: string;
  border: string;
}

/** 현재 테마 토큰을 읽어 이미지도 같은 색으로(두산·LG 테마 포함). */
function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const v = (name: string, fb: string) => cs.getPropertyValue(name).trim() || fb;
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  return {
    bg: v('--bg', '#0a0d15'),
    text: v('--text', '#eef1f7'),
    muted: v('--muted', '#9aa3b4'),
    led: v('--led', '#eef2f8'),
    accent: v('--accent', '#4dff5e'),
    strike: v('--strike', '#ff9e3d'),
    ball: v('--ball', '#35d07f'),
    out: v('--out', '#ff5a52'),
    panel: light ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.045)',
    cell: light ? '#dfe4ec' : 'rgba(0,0,0,0.55)',
    ghost: light ? 'rgba(38,49,63,0.08)' : 'rgba(255,255,255,0.06)',
    border: light ? 'rgba(26,34,48,0.14)' : 'rgba(150,170,205,0.28)',
  };
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 가로 세그먼트(육각형) — 양 끝이 뾰족. */
function hseg(ctx: CanvasRenderingContext2D, x1: number, x2: number, cy: number, t: number) {
  const h = t / 2;
  ctx.beginPath();
  ctx.moveTo(x1, cy);
  ctx.lineTo(x1 + h, cy - h);
  ctx.lineTo(x2 - h, cy - h);
  ctx.lineTo(x2, cy);
  ctx.lineTo(x2 - h, cy + h);
  ctx.lineTo(x1 + h, cy + h);
  ctx.closePath();
}
function vseg(ctx: CanvasRenderingContext2D, cx: number, y1: number, y2: number, t: number) {
  const h = t / 2;
  ctx.beginPath();
  ctx.moveTo(cx, y1);
  ctx.lineTo(cx + h, y1 + h);
  ctx.lineTo(cx + h, y2 - h);
  ctx.lineTo(cx, y2);
  ctx.lineTo(cx - h, y2 - h);
  ctx.lineTo(cx - h, y1 + h);
  ctx.closePath();
}

/** 세븐세그먼트 한 자리를 셀(x,y,w,h) 가운데에. 꺼진 세그먼트는 고스트로. */
function drawSeg7(
  ctx: CanvasRenderingContext2D,
  ch: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  pal: Palette,
) {
  const gh = h * 0.7;
  const gw = gh * 0.52;
  const L = x + (w - gw) / 2;
  const T = y + (h - gh) / 2;
  const t = gw * 0.2;
  const g = t * 0.18;
  const xl = L + t / 2;
  const xr = L + gw - t / 2;
  const yt = T + t / 2;
  const yb = T + gh - t / 2;
  const ym = (yt + yb) / 2;
  const paths: Record<Seg, () => void> = {
    a: () => hseg(ctx, xl + g, xr - g, yt, t),
    g: () => hseg(ctx, xl + g, xr - g, ym, t),
    d: () => hseg(ctx, xl + g, xr - g, yb, t),
    f: () => vseg(ctx, xl, yt + g, ym - g, t),
    b: () => vseg(ctx, xr, yt + g, ym - g, t),
    e: () => vseg(ctx, xl, ym + g, yb - g, t),
    c: () => vseg(ctx, xr, ym + g, yb - g, t),
  };
  const on = new Set(DIGIT_SEGS[ch] ?? []);
  for (const s of Object.keys(paths) as Seg[]) {
    paths[s]();
    ctx.save();
    if (on.has(s)) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = t * 0.9;
    } else {
      ctx.fillStyle = pal.ghost;
    }
    ctx.fill();
    ctx.restore();
  }
}

function drawCells(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  cw: number,
  chh: number,
  gap: number,
  color: string,
  pal: Palette,
) {
  value.split('').forEach((ch, i) => {
    const cx = x + i * (cw + gap);
    roundRect(ctx, cx, y, cw, chh, Math.max(6, cw * 0.12));
    ctx.fillStyle = pal.cell;
    ctx.fill();
    drawSeg7(ctx, ch, cx, y, cw, chh, color, pal);
  });
}

function bulb(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, on: boolean, pal: Palette) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  if (on) {
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = r * 1.4;
  } else {
    ctx.fillStyle = pal.ghost;
  }
  ctx.fill();
  ctx.restore();
}

function today(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

/** 공유 이미지 형식. 스토리=9:16(위·아래 UI에 가리는 곳은 비움), 게시물=4:5(피드·카톡·X). */
export type CardFormat = 'story' | 'post';
export const CARD_FORMATS: Record<
  CardFormat,
  { h: number; safeTop: number; safeBottom: number; label: string; file: string }
> = {
  story: { h: 1920, safeTop: 200, safeBottom: 250, label: '스토리 9:16', file: 'homerun-story.png' },
  post: { h: 1350, safeTop: 0, safeBottom: 0, label: '게시물 4:5', file: 'homerun-post.png' },
};

const HEADER_H = 560; // 마퀴 + 타이틀 + 헤드라인 + 정답
const FOOTER_H = 150;
const BOARD_PAD = 34;
const BOARD_HEAD = 56;

/** 기록 카드를 그린 캔버스. 형식의 비율(1080×h)에 맞춰 행 높이를 조절하고, 가운데 정렬.
 *  기록이 아주 많아 최소 행 높이로도 안 들어가면 그때만 세로로 늘어난다. */
/** 구단 엠블럼(응원 구단 테마일 때) — 타이틀 옆 + 기록 보드 워터마크. */
export interface CardOptions {
  logo?: HTMLImageElement | null;
}

/** 이미지 비율 유지하며 (cx, cy) 중심의 maxW×maxH 상자에 맞춰 그린다. */
function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
) {
  const s = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  return w;
}

export function drawRecordCard(
  r: RecordSummary,
  format: CardFormat = 'post',
  opts: CardOptions = {},
): HTMLCanvasElement {
  const logo = opts.logo && opts.logo.naturalWidth > 0 ? opts.logo : null;
  const pal = readPalette();
  const n = r.guesses.length;
  const won = r.status === 'won';
  const fmt = CARD_FORMATS[format];
  const usable = fmt.h - fmt.safeTop - fmt.safeBottom;

  // 행 높이 = 남는 공간 / 행 수. 너무 작아지면 헤더를 줄여(hs) 기록에 자리를 더 준다.
  //  반대로 공간이 넉넉하면(세로로 긴 스토리·기록 적음) 헤더와 행을 키워 여백을 채운다.
  const maxRow = format === 'story' ? 124 : 104;
  const fitRow = (hs: number) => {
    const avail = usable - HEADER_H * hs - FOOTER_H - BOARD_PAD * 2 - BOARD_HEAD;
    return Math.min(maxRow, avail / Math.max(n, 1) / 1.15);
  };
  let hs = 1;
  if (format === 'story' && fitRow(1.25) >= 96) hs = 1.25;
  else if (fitRow(1) < 72) hs = 0.72;
  const rowH = Math.max(40, fitRow(hs));
  const rowGap = Math.round(rowH * 0.15);
  const HEADER = HEADER_H * hs;
  const FOOTER = FOOTER_H;
  const boardPad = BOARD_PAD;
  const boardH = boardPad * 2 + BOARD_HEAD + n * rowH + Math.max(0, n - 1) * rowGap;
  const contentH = HEADER + boardH + FOOTER;
  const H = Math.max(fmt.h, contentH + fmt.safeTop + fmt.safeBottom);
  const oy = fmt.safeTop + (H - fmt.safeTop - fmt.safeBottom - contentH) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 배경 + 아래쪽 그라운드 발광
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, H + 200, 60, W / 2, H + 200, H * 0.8);
  glow.addColorStop(0, `color-mix(in srgb, ${pal.accent} 22%, transparent)`);
  glow.addColorStop(1, 'transparent');
  // color-mix를 모르는 캔버스(구형 사파리) 대비: 실패하면 그냥 건너뜀.
  try {
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  } catch {
    /* 무시 */
  }

  // 이하 콘텐츠는 세로 가운데(oy) 기준.
  ctx.save();
  ctx.translate(0, oy);

  // 상단 전구 마퀴
  ctx.save();
  ctx.globalAlpha = 0.65;
  for (let x = 70; x <= W - 70; x += 26) bulb(ctx, x, 54 * hs, 5, pal.accent, true, pal);
  ctx.restore();

  // 헤더(타이틀·헤드라인·정답)는 hs 배율로 가운데 기준 축소.
  ctx.save();
  ctx.translate(W / 2, 0);
  ctx.scale(hs, hs);
  ctx.translate(-W / 2, 0);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // 타이틀
  ctx.fillStyle = pal.muted;
  ctx.font = `800 34px ${FONT}`;
  const title = `숫자 야구 · ${r.digits}자리`;
  if (logo) {
    // 구단 엠블럼 + 타이틀을 한 줄 가운데로.
    const lh = 64;
    const lw = Math.min(110, (logo.naturalWidth / logo.naturalHeight) * lh);
    const tw = ctx.measureText(title).width;
    const x0 = W / 2 - (lw + 14 + tw) / 2;
    drawContain(ctx, logo, x0 + lw / 2, 120, lw, lh);
    ctx.textAlign = 'left';
    ctx.fillText(title, x0 + lw + 14, 132);
    ctx.textAlign = 'center';
  } else {
    ctx.fillText(title, W / 2, 132);
  }

  // 헤드라인
  ctx.font = `900 92px ${FONT}`;
  ctx.fillStyle = won ? pal.accent : pal.out;
  ctx.save();
  ctx.shadowColor = won ? pal.accent : pal.out;
  ctx.shadowBlur = 28;
  ctx.fillText(won ? `${n}번 만에 정답!` : '아쉬워요', W / 2, 238);
  ctx.restore();

  ctx.fillStyle = pal.text;
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText(
    won ? `${won ? '🏆' : ''} 시도 ${n} / ${r.maxAttempts}` : `😢 ${r.maxAttempts}번 안에 못 맞혔어요`,
    W / 2,
    298,
  );

  // 정답
  ctx.fillStyle = pal.muted;
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText('정답', W / 2, 360);
  const aw = 108;
  const ah = 142;
  const agap = 16;
  const aTotal = r.digits * aw + (r.digits - 1) * agap;
  drawCells(ctx, r.secret, (W - aTotal) / 2, 382, aw, ah, agap, won ? pal.accent : pal.led, pal);
  ctx.restore();

  // 기록 보드
  const bx = 56;
  const by = HEADER;
  const bw = W - bx * 2;
  roundRect(ctx, bx, by, bw, boardH, 30);
  ctx.fillStyle = pal.panel;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = pal.border;
  ctx.stroke();
  if (logo) {
    // 앱 전광판처럼 구단 로고 워터마크.
    ctx.save();
    ctx.globalAlpha = 0.06;
    drawContain(ctx, logo, W / 2, by + boardH / 2, bw * 0.6, boardH * 0.7);
    ctx.restore();
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = pal.muted;
  ctx.font = `800 26px ${FONT}`;
  ctx.fillText('HISTORY', bx + boardPad, by + boardPad + 28);
  ctx.textAlign = 'right';
  ctx.fillStyle = pal.accent;
  ctx.font = `700 28px ${MONO}`;
  ctx.fillText(`${n} / ${r.maxAttempts}`, bx + bw - boardPad, by + boardPad + 28);

  // 기록 행
  const cw = rowH * 0.6;
  const chh = rowH * 0.8;
  const cgap = 8;
  const r0 = by + boardPad + 56;
  const bulbR = Math.max(6, Math.min(11, rowH * 0.105));
  const bulbStep = bulbR * 2 + 8;
  const groupW = r.digits * bulbStep - 8;
  const groupGap = 26;
  const sboW = groupW * 3 + groupGap * 2;
  const sboX = bx + bw - boardPad - 20 - sboW;
  r.guesses.forEach((gr, i) => {
    const ry = r0 + i * (rowH + rowGap);
    const isWinRow = won && i === n - 1;
    roundRect(ctx, bx + 18, ry, bw - 36, rowH, 18);
    ctx.fillStyle = pal.panel;
    ctx.fill();
    if (isWinRow) {
      ctx.save();
      ctx.globalAlpha = 0.12;
      ctx.fillStyle = pal.accent;
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 2;
      ctx.strokeStyle = pal.accent;
      ctx.stroke();
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = pal.muted;
    ctx.font = `700 ${Math.round(rowH * 0.3)}px ${MONO}`;
    ctx.fillText(String(i + 1), bx + 60, ry + rowH / 2);
    ctx.textBaseline = 'alphabetic';

    drawCells(ctx, gr.guess, bx + 100, ry + (rowH - chh) / 2, cw, chh, cgap, pal.led, pal);

    const j = gr.judgement;
    const counts = [
      { l: 'S', c: j.strikes, color: pal.strike },
      { l: 'B', c: j.balls, color: pal.ball },
      { l: 'O', c: r.digits - j.strikes - j.balls, color: pal.out },
    ];
    counts.forEach(({ l, c, color }, gi) => {
      const gx = sboX + gi * (groupW + groupGap);
      ctx.save();
      if (c === 0) ctx.globalAlpha = 0.4;
      ctx.fillStyle = color;
      ctx.font = `900 ${Math.round(rowH * 0.22)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(l, gx + groupW / 2, ry + rowH * 0.4);
      for (let k = 0; k < r.digits; k++) {
        bulb(ctx, gx + bulbR + k * bulbStep, ry + rowH * 0.66, bulbR, color, k < c, pal);
      }
      ctx.restore();
    });
  });

  // 푸터
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.text;
  ctx.font = `800 34px ${FONT}`;
  ctx.fillText(`⚾ ${SHARE_URL.replace('https://', '')}`, W / 2, contentH - 78);
  ctx.fillStyle = pal.muted;
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText(today(), W / 2, contentH - 38);
  ctx.restore();

  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob 실패'))), 'image/png'),
  );
}
