// PWA 아이콘 생성기 — SVG를 sharp로 래스터화한다. 한 번 실행해 public/에 PNG를 굽는다.
//   pnpm add -D sharp && node scripts/gen-icons.mjs
//   (sharp는 애드혹 — 생성 후 `git checkout package.json pnpm-lock.yaml`로 되돌린다.)
// 아트는 scripts/icon-art.mjs 공용. APK 런처 아이콘은 scripts/gen-android-assets.mjs.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { svg } from './icon-art.mjs';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

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
