// peek + 방장 소유 방 수명 스모크.
import { io } from 'socket.io-client';
const URL = process.env.URL || 'http://localhost:3001';
const emit = (s, ev, p) => new Promise((r) => (p === undefined ? s.emit(ev, r) : s.emit(ev, p, r)));
const once = (s, ev) => new Promise((r) => s.once(ev, r));
const conn = () => {
  const s = io(URL, { transports: ['websocket'] });
  return once(s, 'connect').then(() => s);
};
let fail = false;
const assert = (c, m) => (c ? console.log('  ✓', m) : ((fail = true), console.error('  ✗ FAIL:', m)));

async function main() {
  const host = await conn();
  const cr = await emit(host, 'create', { nick: '호스트', digits: 3, mode: 'duel' });
  assert(cr.ok && cr.mode === 'duel', `duel 방 생성 ${cr.code}`);

  // peek — 입장 없이 모드 조회
  const peeker = await conn();
  const pk = await emit(peeker, 'peek', { code: cr.code });
  assert(pk.ok && pk.mode === 'duel' && pk.digits === 3, 'peek → duel/3자리');
  peeker.close();

  // 후공1 입장 → 방장 secret 진입
  const j1 = await conn();
  const hostPhase = once(host, 'phase');
  const jr = await emit(j1, 'join', { nick: '후공1', code: cr.code });
  assert(jr.ok && jr.index === 1 && jr.mode === 'duel', '후공1 입장(index 1)');
  await hostPhase;

  // 후공1 나감 → 방장은 opponentLeft 받고 방은 유지
  const hostLeft1 = once(host, 'opponentLeft');
  await emit(j1, 'leave');
  await hostLeft1;
  assert(true, '후공 이탈 → 방장 opponentLeft 수신');
  j1.close();

  // 방이 살아있어야: 새 후공2 입장 가능
  const j2 = await conn();
  const jr2 = await emit(j2, 'join', { nick: '후공2', code: cr.code });
  assert(jr2.ok && jr2.index === 1, '방 유지됨 — 새 후공2 입장 성공');

  // 방장 나감 → 방 삭제, 후공2 opponentLeft, 이후 peek 실패
  const j2Left = once(j2, 'opponentLeft');
  await emit(host, 'leave');
  await j2Left;
  assert(true, '방장 이탈 → 후공2 opponentLeft');
  const peeker2 = await conn();
  const pk2 = await emit(peeker2, 'peek', { code: cr.code });
  assert(!pk2.ok, '방장 이탈 후 방 삭제됨(peek 실패)');

  host.close();
  j2.close();
  peeker2.close();
  console.log(fail ? '\n❌ 실패' : '\n✅ 통과');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
