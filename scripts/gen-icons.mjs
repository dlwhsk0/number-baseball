// PWA 아이콘 생성기 — SVG를 sharp로 래스터화한다. 한 번 실행해 public/에 PNG를 굽는다.
//   node scripts/gen-icons.mjs
// 컨셉: 앱 다크 테마(순검정 전광판 + 네온 그린 액센트)에 어울리는 "야구 베이스".
//   어두운 타일 위에 흰 베이스(정사각형)를 45° 다이아몬드로 아주 크게 → 위쪽 한 구석만
//   확대해 보여준다. 베벨(경사 테두리) + 네온 그린 발광 외곽선.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const NEON = '#4dff5e'; // --accent
const RIM = '#bdf0c8'; // 베벨(경사진 테두리) — 밝은 연녹
const FACE = '#f4fdf6'; // 윗면(밝은 흰)
const BG = '#05060a';

/** 중심 (cx,cy), 중심→꼭짓점 R 인 45° 다이아몬드(정사각형)의 꼭짓점 문자열. */
function diamond(cx, cy, R) {
  return `${cx},${cy - R} ${cx + R},${cy} ${cx},${cy + R} ${cx - R},${cy}`;
}

/** 베이스 한 구석 아이콘. pad=여백 비율(마스커블 안전영역). */
function svg(pad = 0) {
  const R = 0.9 - pad * 0.5; // 중심→꼭짓점(타일보다 큼 → 옆·아래 꼭짓점은 화면 밖)
  const tipY = 0.24 + pad * 0.95; // 위 꼭짓점(초점이 되는 구석)의 y
  const cx = 0.5;
  const cy = tipY + R; // 중심은 아래쪽(대부분 화면 밖)
  const bevel = R * 0.14; // 베벨 폭
  const edgeW = R * 0.028;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">
  <defs>
    <radialGradient id="halo" cx="0.5" cy="${tipY + 0.06}" r="0.6">
      <stop offset="0" stop-color="${NEON}" stop-opacity="0.30"/>
      <stop offset="0.55" stop-color="${NEON}" stop-opacity="0.06"/>
      <stop offset="1" stop-color="${NEON}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="faceG" x1="0" y1="${tipY}" x2="0" y2="1" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="${FACE}"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="${R * 0.028}" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="1" height="1" rx="0.2" fill="${BG}"/>
  <circle cx="0.5" cy="${tipY + 0.05}" r="0.58" fill="url(#halo)"/>
  <g filter="url(#glow)">
    <!-- 베벨(테두리 경사) + 네온 발광 외곽선 -->
    <polygon points="${diamond(cx, cy, R)}" fill="${RIM}" stroke="${NEON}" stroke-width="${edgeW}" stroke-linejoin="round"/>
    <!-- 윗면 -->
    <polygon points="${diamond(cx, cy, R - bevel)}" fill="url(#faceG)"/>
  </g>
</svg>`;
}

async function render(name, size, pad) {
  const buf = Buffer.from(svg(pad));
  await sharp(buf, { density: 512 }).resize(size, size).png().toFile(join(publicDir, name));
  console.log('wrote', name, `${size}x${size}`);
}

await Promise.all([
  render('pwa-192x192.png', 192, 0),
  render('pwa-512x512.png', 512, 0),
  render('maskable-512x512.png', 512, 0.09),
  render('apple-touch-icon.png', 180, 0.06),
]);
await writeFile(join(publicDir, 'favicon.svg'), svg(0));
console.log('wrote favicon.svg');
