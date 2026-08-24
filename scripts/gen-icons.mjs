// PWA 아이콘 생성기 — SVG를 sharp로 래스터화한다. 한 번 실행해 public/에 PNG를 굽는다.
//   node scripts/gen-icons.mjs
// 컨셉: **네온 야구공**. 다크 타일 위 그린 네온 링(--accent) + 레드 네온 실밥(시접·스티치), 발광.
//   라이트 버전(-light): 밝은 타일 + 흰 공 + 그린 링 + 레드 실밥(발광 대신 은은한 그림자).
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// --- 야구공 시접(베지어) + 실밥 ---
const cub = (P, t) => {
  const u = 1 - t;
  const b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
  return [b0 * P[0][0] + b1 * P[1][0] + b2 * P[2][0] + b3 * P[3][0],
          b0 * P[0][1] + b1 * P[1][1] + b2 * P[2][1] + b3 * P[3][1]];
};
const tanv = (P, t) => {
  const u = 1 - t;
  const dx = 3 * u * u * (P[1][0] - P[0][0]) + 6 * u * t * (P[2][0] - P[1][0]) + 3 * t * t * (P[3][0] - P[2][0]);
  const dy = 3 * u * u * (P[1][1] - P[0][1]) + 6 * u * t * (P[2][1] - P[1][1]) + 3 * t * t * (P[3][1] - P[2][1]);
  const m = Math.hypot(dx, dy) || 1;
  return [dx / m, dy / m];
};
const seamPath = (P) => `M ${P[0][0]} ${P[0][1]} C ${P[1][0]} ${P[1][1]}, ${P[2][0]} ${P[2][1]}, ${P[3][0]} ${P[3][1]}`;
function stitches(P, color, w, L) {
  let s = '';
  for (const t of [0.16, 0.32, 0.48, 0.64, 0.80]) {
    const c = cub(P, t), d = tanv(P, t);
    const a = Math.atan2(d[1], d[0]) + Math.PI / 2 + 0.5; // 접선에서 살짝 기울인 스티치 각
    const ex = Math.cos(a) * L / 2, ey = Math.sin(a) * L / 2;
    s += `<line x1="${(c[0] - ex).toFixed(3)}" y1="${(c[1] - ey).toFixed(3)}" x2="${(c[0] + ex).toFixed(3)}" y2="${(c[1] + ey).toFixed(3)}" stroke="${color}" stroke-width="${w}" stroke-linecap="round"/>`;
  }
  return s;
}

const THEME = {
  dark: { bg: '#05060a', ring: '#4dff5e', seam: '#ff4d6d', fill: '#0a1410', halo: '#4dff5e', glow: true },
  light: { bg: '#eef1f5', ring: '#22c55e', seam: '#e5405e', fill: '#ffffff', halo: '#22c55e', glow: false },
};

/** 네온 야구공. pad=마스커블 안전영역 여백(공을 살짝 축소). */
function ball(pad = 0, theme = 'dark') {
  const T = THEME[theme];
  const cx = 0.5, cy = 0.5;
  const R = 0.3 - pad * 0.4;
  const rw = R * 0.107, sw = R * 0.087, stw = R * 0.067, stL = R * 0.18;
  // 시접 곡선(공 크기에 맞춰 스케일)
  const sc = (x) => cx + (x - 0.5) * (R / 0.3);
  const scy = (y) => cy + (y - 0.5) * (R / 0.3);
  const L = [[0.40, 0.21], [0.255, 0.34], [0.255, 0.66], [0.40, 0.79]].map(([x, y]) => [sc(x), scy(y)]);
  const Rs = [[0.60, 0.21], [0.745, 0.34], [0.745, 0.66], [0.60, 0.79]].map(([x, y]) => [sc(x), scy(y)]);
  const wrap = T.glow
    ? `<filter id="g" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${(R * 0.04).toFixed(4)}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
    : `<filter id="g" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="${(R * 0.03).toFixed(4)}" stdDeviation="${(R * 0.03).toFixed(4)}" flood-color="#0a2a15" flood-opacity="0.22"/></filter>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1">
  <defs>
    <radialGradient id="halo" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${T.halo}" stop-opacity="${T.glow ? 0.35 : 0.14}"/>
      <stop offset="0.6" stop-color="${T.halo}" stop-opacity="${T.glow ? 0.08 : 0.03}"/>
      <stop offset="1" stop-color="${T.halo}" stop-opacity="0"/>
    </radialGradient>
    ${wrap}
  </defs>
  <rect width="1" height="1" rx="0.2" fill="${T.bg}"/>
  <circle cx="${cx}" cy="${cy}" r="${(R * 1.45).toFixed(3)}" fill="url(#halo)"/>
  <g filter="url(#g)">
    <circle cx="${cx}" cy="${cy}" r="${R.toFixed(3)}" fill="${T.fill}" stroke="${T.ring}" stroke-width="${rw.toFixed(4)}"/>
    <path d="${seamPath(L)}" fill="none" stroke="${T.seam}" stroke-width="${sw.toFixed(4)}" stroke-linecap="round"/>
    <path d="${seamPath(Rs)}" fill="none" stroke="${T.seam}" stroke-width="${sw.toFixed(4)}" stroke-linecap="round"/>
    ${stitches(L, T.seam, stw, stL)}
    ${stitches(Rs, T.seam, stw, stL)}
  </g>
</svg>`;
}

async function render(name, size, pad, theme = 'dark') {
  const buf = Buffer.from(ball(pad, theme));
  await sharp(buf, { density: 512 }).resize(size, size).png().toFile(join(publicDir, name));
  console.log('wrote', name, `${size}x${size}`);
}

await Promise.all([
  // 다크(기본, 매니페스트 참조)
  render('pwa-192x192.png', 192, 0),
  render('pwa-512x512.png', 512, 0),
  render('maskable-512x512.png', 512, 0.09),
  render('apple-touch-icon.png', 180, 0.06),
  // 라이트('-light' 대체 브랜드 자산)
  render('pwa-192x192-light.png', 192, 0, 'light'),
  render('pwa-512x512-light.png', 512, 0, 'light'),
  render('maskable-512x512-light.png', 512, 0.09, 'light'),
  render('apple-touch-icon-light.png', 180, 0.06, 'light'),
  // 600x600 (스토어·마케팅)
  render('icon-600x600.png', 600, 0),
  render('icon-600x600-light.png', 600, 0, 'light'),
]);
await writeFile(join(publicDir, 'favicon.svg'), ball(0, 'dark'));
await writeFile(join(publicDir, 'favicon-light.svg'), ball(0, 'light'));
console.log('wrote favicon.svg, favicon-light.svg');
