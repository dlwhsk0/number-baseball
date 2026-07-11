# 숫자 야구 ⚾

서로 다른 세 자리 숫자를 맞히는 숫자 야구 게임 모바일 웹앱.

**▶ 라이브: https://number-baseball-chi.vercel.app**

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
