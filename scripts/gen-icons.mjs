// PWA 아이콘 생성기 — SVG를 sharp로 래스터화한다. 한 번 실행해 public/에 PNG를 굽는다.
//   node scripts/gen-icons.mjs
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

/** 야구공 아이콘. pad=여백 비율(마스커블용). */
function svg(pad = 0) {
  const bg = '#0f172a';
  const r = 0.5 - pad; // 반지름(0~0.5)
  const cx = 0.5;
  const cy = 0.5;
  const stitch = '#ef4444';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">
  <rect width="1" height="1" rx="0.18" fill="${bg}"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#f8fafc"/>
  <g fill="none" stroke="${stitch}" stroke-width="0.016" stroke-linecap="round">
    <path d="M ${cx - r * 0.72} ${cy - r * 0.55} Q ${cx} ${cy} ${cx - r * 0.72} ${cy + r * 0.55}"/>
    <path d="M ${cx + r * 0.72} ${cy - r * 0.55} Q ${cx} ${cy} ${cx + r * 0.72} ${cy + r * 0.55}"/>
    ${stitches(cx - r * 0.72, cy, r, -1)}
    ${stitches(cx + r * 0.72, cy, r, 1)}
  </g>
</svg>`;
}

function stitches(x, cy, r, dir) {
  const out = [];
  for (let i = -3; i <= 3; i++) {
    const y = cy + (i / 3) * r * 0.5;
    const len = 0.028;
    out.push(
      `<path d="M ${x} ${y} l ${dir * len} ${-len * 0.6}"/>` +
        `<path d="M ${x} ${y} l ${dir * len} ${len * 0.6}"/>`,
    );
  }
  return out.join('');
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
