// 스피드: 상대가 나가 혼자 남으면 게임이 종료돼야(speedOver).
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
  setTimeout(() => { console.error('⏱️ TIMEOUT — 종료 안 됨'); process.exit(2); }, 10000);
  const A = await conn();
  const B = await conn();
  const cr = await emit(A, 'create', { nick: 'A', digits: 3, mode: 'speed' });
  await emit(B, 'join', { nick: 'B', code: cr.code });
  const startB = once(B, 'speedStart');
  await emit(A, 'startSpeed');
  await startB;
  assert(true, '레이스 시작(2명)');

  // A가 나감 → B 혼자 → B가 speedOver 받아야.
  const overB = once(B, 'speedOver');
  await emit(A, 'leave');
  const over = await overB;
  assert(Array.isArray(over.standings), 'B가 speedOver 수신(혼자 남아 종료)');
  assert(over.standings.length === 1 && over.standings[0].nick === 'B', '순위에 남은 1명(B)만');

  A.close();
  B.close();
  console.log(fail ? '\n❌ 실패' : '\n✅ 통과');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
