/**
 * 오프라인 전용 빌드(앱인토스·원스토어 APK)용 스텁 — `online.ts`를 대체한다.
 *
 * `import type`만 쓰므로 실제 온라인 모듈은 런타임에 전혀 딸려오지 않는다.
 * (타입은 진짜 구현에서 빌려 와 시그니처가 어긋나면 컴파일 에러가 나게 둔다.)
 */
import type { OnlineSpeed as RealOnlineSpeed } from './OnlineSpeed';
import type { OnlineDuel as RealOnlineDuel } from './OnlineDuel';
import type { peekRoom as realPeekRoom } from '../net/peek';

export const ONLINE_ENABLED = false;

export const OnlineSpeed: typeof RealOnlineSpeed = () => null;
export const OnlineDuel: typeof RealOnlineDuel = () => null;
export const peekRoom: typeof realPeekRoom = () =>
  Promise.resolve({ ok: false, error: '이 버전은 온라인 대전을 지원하지 않아요' });
