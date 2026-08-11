# 앱인토스(Apps in Toss) 출시 가이드

숫자 야구를 토스 앱 안의 **미니앱**으로 올리는 절차 정리.
앱인토스 버전은 **온라인 대전 없이 오프라인(한 기기)만** 제공한다 — 자체 서버(VM) 부하를 안 지려고.

> 출처: [앱인토스 개발자센터](https://developers-apps-in-toss.toss.im/) ·
> [게임 등급분류](https://toss.im/apps-in-toss/blog/game_rating_classification) ·
> [자체등급분류 게임물 정보 입력](https://toss.im/apps-in-toss/blog/self-rated_game_distribution) ·
> [게임 출시 체크리스트](https://developers-apps-in-toss.toss.im/checklist/app-game.html) ·
> [원스토어 개발자센터](https://onestore-dev.gitbook.io/dev)
> 정책은 자주 바뀌니 진행 직전에 원문을 다시 확인할 것.

---

## 0. 큰 그림

앱 유형을 **게임**으로 등록하면 앱인토스는 **오픈마켓 출시 URL 또는 게임물관리위원회 등급분류증명서**를
요구한다. 등급분류가 리드타임이 제일 기니 여기부터 시작한다.

```
[A] 등급분류
    A-1 원스토어 출시 → IARC 자체등급분류 → 게임위 조회 → 앱인토스에 URL+정보 제출   ← 이 문서의 메인 경로
    A-2 (대안) 게임위(GRAC) 직접 신청 → 등급분류증명서 제출
                         │
[B] 앱인토스 콘솔 등록 + 미니앱 빌드 ─┴─→ 앱 정보 검토 요청 → 승인 → 출시
```

A와 B는 병렬로 진행 가능. **A가 끝나야 B의 검토 요청을 넣을 수 있다.**

---

## 1-A. 원스토어에 먼저 출시하기 (메인 경로)

원스토어는 **IARC 자체등급분류사업자**다. 게임을 등록하면서 콘텐츠 설문만 작성하면
연령 등급이 자동 부여되고, 그 결과가 게임물관리위원회 **'자체등급분류 게임물'** 로 통보된다.
개발자 등록비가 **무료**고 심사가 빠른 게 장점.

### 1-A-0. 웹앱을 APK로 감싸기 (Capacitor — **셋업 완료**)

원스토어는 **APK 또는 AAB 바이너리**를 요구한다. 이 프로젝트는 Vite SPA라 안드로이드 껍데기가 필요해서
**Capacitor**를 붙여 뒀다(`android/` 디렉터리). 웹 자산이 APK 안에 통째로 들어가므로 서버·네트워크를
전혀 안 탄다 — 오프라인 전용 빌드와 궁합이 딱 맞고, 원스토어 심사에서 네트워크 이슈가 안 생긴다.

> 대안이던 TWA(Bubblewrap)는 **앱이 Vercel 서버에 의존**하고 온라인 대전이 그대로 노출돼서 안 쓴다.

**준비물**: JDK 21 + Android SDK(Android Studio). `android/local.properties`의 `sdk.dir`은 로컬 전용(gitignore).

#### AAB 빌드 (릴리스)

```sh
# 1) 릴리스 서명키 만들기 — 최초 1회.
#    ⚠️ jks 파일과 비밀번호를 잃어버리면 앱 업데이트가 영원히 불가능하다. 안전한 곳에 백업.
keytool -genkey -v -keystore android/nb-release.jks \
        -keyalg RSA -keysize 2048 -validity 10000 -alias nb

# 2) android/keystore.properties 작성 (gitignore 되어 있음)
cat > android/keystore.properties <<'EOF'
storeFile=nb-release.jks
storePassword=…
keyAlias=nb
keyPassword=…
EOF

# 3) 빌드
pnpm build:native                 # → dist-native/
pnpm exec cap sync android        # → android/app/src/main/assets/public/
cd android && ./gradlew bundleRelease
#   → android/app/build/outputs/bundle/release/app-release.aab  (약 3.2 MB)
```

`keystore.properties`가 없으면 서명 없이 빌드된다(로컬 확인용). **원스토어 업로드는 서명 필수.**

#### 에뮬레이터/실기기 확인

```sh
pnpm build:native && pnpm exec cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n io.github.dlwhsk0.numberbaseball/.MainActivity
```

#### 이미 해 둔 설정

| 항목 | 위치 | 내용 |
|---|---|---|
| appId | `capacitor.config.ts` | `io.github.dlwhsk0.numberbaseball` — **첫 업로드 뒤엔 변경 불가** |
| 웹 루트 | `capacitor.config.ts` | `dist-native` (`pnpm build:native` 결과물) |
| 배경색 | `capacitor.config.ts` | `#05060a` — 웹뷰 뜨기 전 흰 번쩍임 방지 |
| 세로 고정 | `AndroidManifest.xml` | `android:screenOrientation="portrait"` |
| 다크 테마 | `res/values/styles.xml` | 시스템이 라이트여도 항상 어둡게, 상태바 아이콘 밝게 |
| 스플래시 | `res/drawable/splash.xml` | 검정 + 가운데 로고(layer-list, 해상도 무관) |
| 런처 아이콘 | `res/mipmap-*` | `node scripts/gen-android-assets.mjs`로 생성(PWA와 같은 아트) |
| 버전 | `app/build.gradle` | `versionCode 1` / `versionName "1.0.0"` — **업로드마다 versionCode 증가** |
| 서명 | `app/build.gradle` | `android/keystore.properties`에서 읽음 |
| 뒤로가기 | `src/native/backButton.native.ts` | 모달→대결화면→멀티탭 순으로 닫고, 최상위에선 2번 눌러야 종료 |

**검증 완료**(Android 15 에뮬레이터): 앱 실행 · 세이프에어리어 정상 · 멀티 탭에 온라인 항목 없음 ·
뒤로가기 1회는 화면 복귀, 최상위에서 연속 2회만 종료 · 런처 아이콘 정상 표시.

#### 아이콘을 바꾸려면

```sh
pnpm add -D sharp
node scripts/gen-icons.mjs           # PWA/파비콘 (public/)
node scripts/gen-android-assets.mjs  # 런처 아이콘·스플래시 (android/.../res/)
git checkout package.json pnpm-lock.yaml   # sharp는 애드혹 — 되돌리기
```

아트는 `scripts/icon-art.mjs` 한 군데(웹·안드로이드 공용).

### 1-A-1. 원스토어 개발자센터 가입

[원스토어 개발자센터](https://dev.onestore.co.kr) 회원가입.

- **개발자 등록비 없음(무료).** 구글($25)·애플($99/년)과 달리 공짜.
- 회원 구분: **개인 / 개인사업자 / 법인사업자** — **사업자등록 없는 개인도 가입 가능**.
- 무료 앱만 낼 거면 정산정보 등록 불필요. (유료·인앱결제 하려면 정산계좌·서류 필요.)

### 1-A-2. 앱 등록

1. **기본 정보** — 앱 이름(`숫자 야구`), 키워드, 앱 설명(3,000자 이내), 카테고리는 **게임**.
2. **그래픽 자산** — 아이콘, 스크린샷. `store-assets/`에 이미 있는 것들 재활용.
3. **바이너리 등록** — 위에서 만든 **AAB**(또는 APK) 업로드.
   '앱 서명 사용'에서 **원스토어가 서명키를 관리·보호**하는 옵션을 쓸 수 있다.
4. **연령등급(IARC)** — 여기가 등급분류의 핵심.
   - 다른 스토어에서 이미 IARC 인증을 받았으면 **IARC 인증 ID**를 입력.
   - 처음이면 **콘텐츠 평가 설문**을 진행. 항목: 폭력성 / 공포 / 선정성 / 범죄 / 약물 /
     부적절한 언어 / 사행성. 숫자 야구는 전부 해당 없음 → **전체이용가**.
   - 설문 제출 즉시 등급이 발급된다.
5. **유료/무료** — 무료 선택.
6. **심사 제출** — 원스토어 심사는 빠르다(**1~2시간 ~ 1일** 수준). 결과는 메일로 통보.

> ⚠️ 사행성 관련 설문에 주의. 숫자 야구는 도박 요소가 없지만, '베팅/확률형' 문항을 잘못 체크하면
> 청소년이용불가로 튀어 앱인토스에 못 낸다(청불은 GRAC 추가 심의 대상).

### 1-A-3. 게임위 '자체등급분류 게임물' 조회

출시 후 [게임물관리위원회](https://www.grac.or.kr)의 **'자체등급분류 게임물 조회'** 에서 게임물명을 검색해
아래를 확인한다(반영에 며칠 걸릴 수 있음).

- **등급분류일자 / 등급분류번호**
- **이용등급**
- **내용정보**(선정성·폭력성·공포·약물·범죄·언어·사행성 표시)

### 1-A-4. 앱인토스 콘솔에 제출

앱인토스 콘솔 → 앱 등록 → **게임 등급분류** 탭.

1. **기본정보** — 사업자면 사업자등록증 정보, 개인이면 본인 정보.
2. **게임물 정보** — 위에서 조회한 값을 **글자 그대로 동일하게** 입력.
   - 등록자명(스토어에 표시된 개발자/제공자명)
   - **자체등급분류사업자명 = `원스토어`**
   - 등급분류일자 / 등급분류번호 / 이용등급 / 내용정보
   - **대표자 인감 또는 사인 이미지** ← 미리 스캔해 둘 것
3. **게임 플레이 화면** — 자체등급분류 당시 화면 **2장** + 앱인토스 내 게임 화면 **2장**.
   → 원스토어 APK와 앱인토스 미니앱이 **같은 오프라인 빌드**라 화면이 동일해 유리하다.
4. 선정성·폭력성이 있으면 관련 화면 추가 — 해당 없음.

그리고 앱 정보의 **등급분류** 항목에 **원스토어 상세페이지 URL**을 넣는다.

> ❗ 자체등급분류로 받은 게임을 다른 플랫폼(앱인토스)에 유통하면서 이 정보를 **입력하지 않으면**
> 등급미필 게임물로 간주되어 시정권고·수사의뢰·행정처분 대상이 된다. 빼먹지 말 것.

---

## 1-B. (대안) 게임위 직접 신청 — 원스토어를 건너뛰고 싶다면

APK를 안 만들고 싶으면 이 경로가 더 짧다. 앱인토스는 **등급분류증명서**도 인정한다.

[게임물관리위원회](https://www.grac.or.kr) → `등급분류신청` → **오픈마켓 등급분류 신청**(= 등급분류 간소화 서비스)

- **대상**: 전체이용가~15세이용가 **모바일 게임물**.
- **자격**: **개인 회원 가입으로 가능** — 사업자등록·게임제작업 등록증 없이 신청할 수 있다.
  신청 시 **공동인증서 개인 인증** 필요.
- **제출물**: **게임 설명서 1부 + 게임 실행 영상 1부**(화면 녹화면 충분).
- **수수료**: 개인(사업자 없음)은 저렴. **비영리 게임물이면 면제** — 가입 후 스토어명에서
  `비영리 게임물 단순목적`을 고르면 자동 적용. 단 앱인토스에 광고·결제를 붙일 거면 비영리가 아니다.
  애매하면 게임위에 먼저 문의(잘못 고르면 재신청 사유).
- **플랫폼/스토어 입력**: 플랫폼 `모바일 게임`, 스토어명 **`기타 - 앱인토스`**.
- **소요**: 약 **10~15일** → 등급분류증명서 발급.

| | 원스토어 경유(1-A) | 게임위 직접(1-B) |
|---|---|---|
| 추가 작업 | **APK/AAB 래핑 필요** | 없음(설명서 + 영상만) |
| 비용 | 무료 | 저렴 / 비영리면 면제 |
| 소요 | 원스토어 심사 수시간 + 게임위 반영 며칠 | **10~15일** |
| 부수 효과 | 원스토어에도 앱이 깔린다 | 없음 |
| 앱인토스 추가 입력 | 자체등급분류 게임물 정보(인감 등) | 증명서 업로드 |

---

## 2. 앱인토스 콘솔 등록

### 2-1. 가입
[앱인토스 콘솔](https://developers-apps-in-toss.toss.im/) 가입. **만 19세 이상 + 본인 명의 토스앱** 필요.
워크스페이스는 사업자당 1개.

### 2-2. 사업자 등록 (선택)
- **비사업자(개인)도 출시 가능.**
- **수익화(광고·결제·토스페이·프로모션)를 쓰려면 사업자등록 필수.**
- 개인사업자는 사업자등록증만 제출. 검토 영업일 1~2일.

### 2-3. 앱 등록
- **앱 이름**: `숫자 야구`
- **appName**: `intoss://{appName}` 딥링크 키. **등록 후 수정 불가** (예: `number-baseball`).
  `granite.config.ts`의 `appName`과 **반드시 동일**.
- **앱 유형**: **게임**

### 2-4. 앱 정보
| 항목 | 규격 | 이 레포의 준비물 |
|---|---|---|
| 부제 | 50자 내외 | — |
| 상세 설명 | "접속 → 행동 → 결과" 흐름 | — |
| 고객문의 이메일 | 필수 | — |
| 앱 로고 | **600×600 PNG**, 둥근 모서리·투명배경 X | `store-assets/` 600×600 로고 |
| 스크린샷 | 세로 **636×1048**, 3장 이상 권장 | `store-assets/` 세로 5장 |
| 썸네일(게임) | **1932×828 PNG** | `store-assets/` 가로 썸네일 |
| 리더보드(게임) | 점수 단위·정렬 기준 | 예: `시도 횟수` 오름차순 |
| 등급분류(게임) | 원스토어 URL 또는 증명서 | 1-A / 1-B 결과물 |

입력 후 **[검토 요청하기]** → 영업일 **1~2일** → 승인 후 출시.

---

## 3. 미니앱 기술 통합 (WebView)

앱인토스는 **WebView SDK**와 **React Native SDK** 두 방식. 이 프로젝트는 Vite+React 웹앱이라 **WebView**.

```sh
pnpm add @apps-in-toss/web-framework
pnpm dlx ait init          # granite.config.ts 생성
```

```ts
// granite.config.ts
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'number-baseball',      // 콘솔 등록값과 동일
  brand: {
    displayName: '숫자 야구',
    primaryColor: '#4dff5e',
    icon: '',                      // 콘솔에 올린 로고 이미지 URL
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'pnpm dev:offline',
      build: 'pnpm build:offline',  // ← 오프라인 전용 빌드
    },
  },
  permissions: [],
  outdir: 'dist-offline',
});
```

빌드 결과(`dist-offline/`)를 **콘솔에 업로드** → 테스트 → 출시 요청.

> ⚠️ TDS(`@toss/tds-mobile`)는 peer로 **React 18**을 요구한다. 이 프로젝트는 React 19라
> TDS는 쓰지 말고 자체 디자인 시스템을 유지할 것(야구장 컨셉이라 어차피 안 맞음).

### 게임 출시 체크리스트에서 걸릴 만한 것
- ✅ **CSR/SSG만 허용, SSR 금지** — Vite SPA라 OK.
- ✅ **`eval` 등 외부 코드 실행 금지** — 없음.
- ✅ **WebSocket은 `wss://`만** — 오프라인 빌드는 소켓을 통째로 뺐으니 무관.
- ✅ **초기 화면 10초 내 로딩** — 240KB(gzip 73KB), 외부 폰트 없음(`Seg7`이 CSS로 그림).
- ⚠️ **Safe Area 침범 금지** — `.app`이 `100dvh`라 토스 웹뷰 인셋 확인 필요. `env(safe-area-inset-*)` 보정.
- ⚠️ **브라우저 히스토리 조작 불가** — 현재 라우터 없음(상태 기반)이라 OK. 추가하지 말 것.
- ⚠️ **사용자 식별자 발급·저장 / 기록 유지** — 현재 `localStorage`만. 리더보드를 붙이면 SDK 식별자 필요.
- ⚠️ **닫기 버튼 동작 / 자동 바텀시트 미노출** — 실기기 테스트로 확인.
- — 사운드 없음 → 사운드 항목은 해당 없음.

---

## 4. 이 레포의 오프라인 전용 빌드

타깃이 세 개다.

| 명령 | 결과물 | 쓰는 곳 | 온라인 대전 | PWA(SW) | Capacitor |
|---|---|---|---|---|---|
| `pnpm build` | `dist/` | 웹·Vercel | ✅ | ✅ | ✗ |
| `pnpm build:offline` | `dist-offline/` | **앱인토스 콘솔 업로드** | ✗ | ✗ | ✗ |
| `pnpm build:native` | `dist-native/` | **원스토어 APK/AAB** | ✗ | ✗ | ✅ |

(`pnpm dev:offline` / `preview:offline`으로 오프라인 모드를 로컬에서 볼 수 있다.)

동작 방식 — `vite.config.ts`가 `VITE_TARGET`을 보고:

- `@versus/online` → `src/versus/online.offline.ts`(빈 스텁)로 **alias**
  → `OnlineSpeed`/`OnlineDuel`/`socket.io-client`가 **번들에 아예 안 들어감**
- `@native/back-button` → `native` 타깃만 진짜 구현, 나머지는 빈 훅 → `@capacitor/*` 미포함
- `vite-plugin-pwa` 제외 + `virtual:pwa-register/react` → no-op 훅
- `base: './'`(file:// 대응), 타깃별 `outDir`
- `__OFFLINE_BUILD__` 상수 주입 → `src/target.ts`의 `IS_OFFLINE_BUILD`

UI 쪽:
- `App.tsx`는 `ONLINE_ENABLED`(배럴에서 옴)로 멀티 메뉴를 분기.
  오프라인 빌드에선 **닉네임·자릿수·[방 만들기]·[코드로 입장]이 사라지고**
  `종류 [⚡스피드|🥎주고받기]` + **[📱 한 기기로 하기]** 만 남는다.
- `IS_OFFLINE_BUILD`면 PWA 아이콘 재설치 안내 배너도 뜨지 않는다.

빌드 결과 비교:

| | `dist` (웹) | `dist-offline` (앱인토스) | `dist-native` (APK) |
|---|---|---|---|
| JS | 314 KB (gzip 95.8) | **240 KB (gzip 73.5)** | 242 KB + capacitor 청크 9 KB |
| `sw.js` / manifest | 있음 | 없음 | 없음 |
| socket.io · `wss://` · '방 만들기' | 있음 | **없음** | **없음** |
| `@capacitor/*` | 없음 | **없음** | 있음 |

**주의**: 온라인 대전 코드를 건드릴 땐 `App.tsx`가 `./versus/OnlineDuel`을 직접 import하지 않도록
반드시 `@versus/online` 배럴을 경유할 것. 직접 import하면 오프라인 빌드에 소켓이 다시 딸려온다.
같은 이유로 `@capacitor/*`는 `backButton.native.ts` 밖에서 import하지 말 것.

---

## 5. 진행 순서 요약

1. [x] ~~Capacitor로 안드로이드 껍데기 만들기~~ → **완료**. 남은 건 **서명키 생성 + AAB 빌드**(1-A-0)
2. [ ] 원스토어 개발자센터 가입(무료) → 앱 등록 → **IARC 설문(전체이용가)** → 심사 통과 → 출시
3. [ ] 게임위 '자체등급분류 게임물 조회'에서 등급분류번호·일자·내용정보 확인
4. [ ] 앱인토스 콘솔 가입 → 앱 등록(유형: **게임**, appName 확정)
5. [ ] `pnpm add @apps-in-toss/web-framework` + `ait init` → `granite.config.ts` 작성
6. [ ] `pnpm build:offline` → `dist-offline` 콘솔 업로드 → 실기기 테스트
7. [ ] 콘솔 **게임 등급분류** 탭에 자체등급분류 정보 + 화면 4장 + 인감 이미지 제출
8. [ ] 앱 정보(로고·스크린샷·썸네일·리더보드·원스토어 URL) 입력 → **검토 요청**
9. [ ] 승인 → 출시 🎉
