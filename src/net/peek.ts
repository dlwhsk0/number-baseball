import { getSocket } from './socket';
import type { PeekAck } from './protocol';

/**
 * 입장 전 방 종류(스피드/턴제)만 조회한다. 코드로 입장할 때 방장이 만든 모드로
 * 자동 진입하기 위해 씀(부수효과 없음 — 실제 join은 해당 모드 컴포넌트가 함).
 * 소켓이 안 붙어 있으면 연결부터 하고 peek을 보낸다.
 */
export function peekRoom(code: string): Promise<PeekAck> {
  return new Promise((resolve) => {
    const s = getSocket();
    let done = false;
    const finish = (r: PeekAck) => {
      if (done) return;
      done = true;
      resolve(r);
    };
    const run = () => s.emit('peek', { code }, finish);
    if (s.connected) run();
    else {
      s.once('connect', run);
      s.connect();
    }
    window.setTimeout(() => finish({ ok: false, error: '서버 응답이 없어요. 다시 시도해주세요.' }), 8000);
  });
}
