# 숫자 야구 ⚾

서로 다른 세 자리 숫자를 맞히는 숫자 야구 게임 모바일 웹앱.

**▶ 라이브: https://homerun-bb.vercel.app** (구 주소 `number-baseball-chi.vercel.app`로 들어와도 이쪽으로 자동 이동)

## 규칙
- 컴퓨터가 서로 다른 세 자리 숫자(0~9, 중복 없음, 맨 앞자리 0 제외)를 정합니다.
- 추측을 입력하면 판정합니다:
  - **스트라이크(S)**: 숫자와 위치가 모두 일치
  - **볼(B)**: 숫자는 있으나 위치가 다름
  - **아웃**: 하나도 없음
- 3 스트라이크면 승리. 시도 10회 제한.

## 스택
- Vite + React + TypeScript
- PWA (홈 화면 추가 + 오프라인)
- 패키지 매니저: **pnpm** (Vite 8의 rolldown 네이티브 바이너리 이슈로 npm 대신 사용)

## 개발
```bash
pnpm install
pnpm dev       # 개발 서버
pnpm test      # 단위 테스트 (게임 로직)
pnpm build     # 프로덕션 빌드
```

## 구조
- `src/game/logic.ts` — 정답 생성·판정(순수 함수) + 테스트
- `src/game/useGame.ts` — 상태 관리 reducer/훅 + 테스트
- `src/components/` — Keypad · History · ResultBanner
- `scripts/gen-icons.mjs` — PWA 아이콘 생성기

## 라이선스

[PolyForm Noncommercial 1.0.0](LICENSE) · Copyright (c) 2026 dlwhsk0

- 개인 학습·연구·취미 등 **비상업적 목적**의 사용, 수정, 공유는 자유롭다. 공유할 때는 이 라이선스와 저작권 표시를 함께 전달해야 한다.
- **상업적 이용은 허락하지 않는다.** 유료 서비스·광고 수익·사내 상용 제품 등에 쓰거나, 이 게임(코드·디자인·이름)을 복제해 수익을 내는 서비스로 운영하려면 저작권자에게 **사전에 서면 허락**을 받아야 한다. 문의: [GitHub @dlwhsk0](https://github.com/dlwhsk0)
- 위반 시 라이선스는 종료되며, 저작권 침해에 대해 법적 조치를 취할 수 있다.
- 이 레포에 기여한 코드도 같은 라이선스로 배포된다.

### 제3자 자료
`public/teams/*`의 KBO 구단 엠블럼과 `public/kbo-logo.png`는 각 구단·KBO의 상표·저작물로, **이 라이선스의 대상이 아니다.** 팬 콘텐츠 표시 목적으로만 쓰며 권리는 각 소유자에게 있다. 재사용하려면 해당 권리자의 정책을 따라야 한다. 이 프로젝트는 KBO 및 각 구단과 관련이 없는 비공식 팬 게임이다.
