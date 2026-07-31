// PWA 아이콘 생성기 — SVG를 sharp로 래스터화한다. 한 번 실행해 public/에 PNG를 굽는다.
//   node scripts/gen-icons.mjs
// 컨셉: 앱 다크 테마(순검정 전광판 + 네온 그린 액센트)에 어울리는 "네온 야구공".
//   어두운 타일 위에 은은한 그린 헤일로 → 발광하는 네온 그린 외곽선·실밥 → 밝은 코어.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

const NEON = '#4dff5e'; // --accent
const CORE = '#daffe0'; // 실밥 밝은 코어(네온 핫코어)
const BG = '#05060a';

/** 실밥 잔가지(V자 스티치). x=세로 실밥 위치, dir=바깥 방향(±1). */
function stitches(x, cy, r, dir, width) {
  const out = [];
  for (let i = -3; i <= 3; i++) {
    const y = cy + (i / 3) * r * 0.52;
    const len = r * 0.16;
    out.push(
      `<path d="M ${x} ${y} l ${dir * len} ${-len * 0.62}" stroke-width="${width}"/>` +
        `<path d="M ${x} ${y} l ${dir * len} ${len * 0.62}" stroke-width="${width}"/>`,
    );
  }
  return out.join('');
}

/** 야구공 선(외곽 원 + 두 솔기 + 잔가지)을 한 가지 stroke 굵기로 그린 그룹 문자열. */
function ballLines(cx, cy, r, stroke, width, tickWidth, fill) {
  const seamOff = r * 0.72;
  const seamBow = r * 0.55;
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>
    <g fill="none" stroke="${stroke}" stroke-linecap="round" stroke-width="${width}">
      <path d="M ${cx - seamOff} ${cy - seamBow} Q ${cx - r * 0.12} ${cy} ${cx - seamOff} ${cy + seamBow}"/>
      <path d="M ${cx + seamOff} ${cy - seamBow} Q ${cx + r * 0.12} ${cy} ${cx + seamOff} ${cy + seamBow}"/>
      ${stitches(cx - seamOff, cy, r, -1, tickWidth)}
      ${stitches(cx + seamOff, cy, r, 1, tickWidth)}
    </g>`;
}

/** 야구공 아이콘. pad=여백 비율(마스커블용). */
function svg(pad = 0) {
  const cx = 0.5;
  const cy = 0.5;
  const r = (0.5 - pad) * 0.66; // 공 반지름(타일 대비 여백 확보)
  const halo = Math.min(r * 1.42, 0.5); // 뒤 발광
  const w = r * 0.085; // 외곽·솔기 굵기
  const tick = r * 0.06; // 잔가지 굵기
  const coreW = r * 0.03; // 밝은 코어 굵기

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">
  <defs>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${NEON}" stop-opacity="0.30"/>
      <stop offset="0.5" stop-color="${NEON}" stop-opacity="0.08"/>
      <stop offset="1" stop-color="${NEON}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="ball" cx="0.4" cy="0.34" r="0.8">
      <stop offset="0" stop-color="#10241a"/>
      <stop offset="1" stop-color="#06090c"/>
    </radialGradient>
    <filter id="glow" x="-45%" y="-45%" width="190%" height="190%">
      <feGaussianBlur stdDeviation="${r * 0.05}" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="1" height="1" rx="0.2" fill="${BG}"/>
  <circle cx="${cx}" cy="${cy}" r="${halo}" fill="url(#halo)"/>
  <g filter="url(#glow)">
    ${ballLines(cx, cy, r, NEON, w, tick, 'url(#ball)')}
  </g>
  <g fill="none" stroke-linecap="round" opacity="0.95">
    ${ballLines(cx, cy, r, CORE, coreW, coreW, 'none')}
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
