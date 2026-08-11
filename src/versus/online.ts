/**
 * 온라인 대전 진입점(기본 빌드).
 *
 * 오프라인 빌드(`VITE_TARGET=offline`)에서는 vite alias가 이 모듈을
 * `online.offline.ts`(빈 껍데기)로 바꿔치기한다 → socket.io-client와
 * OnlineSpeed/OnlineDuel 코드가 번들에 아예 안 들어간다.
 * 그래서 App은 반드시 이 배럴(`@versus/online`)로만 온라인 코드를 참조해야 한다.
 */
export const ONLINE_ENABLED = true;
export { OnlineSpeed } from './OnlineSpeed';
export { OnlineDuel } from './OnlineDuel';
export { peekRoom } from '../net/peek';
