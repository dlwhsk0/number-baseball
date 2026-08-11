// 안드로이드(APK/AAB) 런처 아이콘·스플래시 생성기.
//   pnpm add -D sharp && node scripts/gen-android-assets.mjs
//   git checkout package.json pnpm-lock.yaml     # sharp는 애드혹 — 되돌리기
//
// android/app/src/main/res/ 아래에 밀도별 PNG를 바로 굽는다.
// (@capacitor/assets는 sharp 0.32 네이티브 바이너리를 못 받아 와서 직접 만든다.)
// 아트는 PWA 아이콘과 같은 scripts/icon-art.mjs를 쓴다 — 브랜드 일관성.
import { writeFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { globSync } from 'node:fs';
import sharp from 'sharp';
import { svg, BG } from './icon-art.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'android/app/src/main/res');

const png = (markup, size) =>
  sharp(Buffer.from(markup), { density: 512 }).resize(size, size).png();

// 레거시 아이콘 48dp, 적응형 전경 108dp — 밀도 배수는 1 / 1.5 / 2 / 3 / 4.
const DENSITIES = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];

/** 원형 마스크(ic_launcher_round용). */
const circleMask = (size) =>
  Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#fff"/></svg>`,
  );

for (const [dpi, k] of DENSITIES) {
  const dir = join(res, `mipmap-${dpi}`);
  const legacy = Math.round(48 * k);
  const fg = Math.round(108 * k);

  // 레거시(사각) — 런처가 알아서 마스킹하므로 모서리는 각지게.
  await png(svg(0, { radius: 0 }), legacy).toFile(join(dir, 'ic_launcher.png'));

  // 레거시(원형) — 원형 런처용으로 직접 잘라 준다.
  await png(svg(0, { radius: 0 }), legacy)
    .composite([{ input: circleMask(legacy), blend: 'dest-in' }])
    .toFile(join(dir, 'ic_launcher_round.png'));

  // 적응형 전경 — 배경 없이, 바깥 33%가 잘리는 걸 감안해 여백을 넉넉히.
  await png(svg(0.2, { bg: 'none' }), fg).toFile(join(dir, 'ic_launcher_foreground.png'));
  console.log(`mipmap-${dpi}: ${legacy}px / fg ${fg}px`);
}

// 적응형 배경색(= 아이콘 타일 배경).
await writeFile(
  join(res, 'values/ic_launcher_background.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BG}</color>
</resources>
`,
);

// 스플래시 — 밀도별 PNG 대신 layer-list(단색 + 가운데 아이콘)로. 어느 해상도든 안 깨진다.
// 템플릿이 깔아 둔 splash.png들은 같은 이름이라 충돌하므로 지운다.
for (const f of globSync('drawable*/splash.png', { cwd: res })) {
  await rm(join(res, f));
}
await writeFile(
  join(res, 'drawable/splash.xml'),
  `<?xml version="1.0" encoding="utf-8"?>
<!-- 실행 직후 잠깐 뜨는 화면. 앱이 단일 다크라 배경도 같은 검정. -->
<layer-list xmlns:android="http://schemas.android.com/apk/res/android">
    <item android:drawable="@color/ic_launcher_background" />
    <item android:gravity="center">
        <bitmap
            android:gravity="center"
            android:src="@mipmap/ic_launcher_foreground" />
    </item>
</layer-list>
`,
);
console.log('wrote values/ic_launcher_background.xml, drawable/splash.xml');
