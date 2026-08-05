// 스피드 규칙: 제한시간 자릿수별(3자리 5분·4자리 7분). env 미설정 기본값 검증.
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

async function limitFor(digits) {
  const A = await conn();
  const B = await conn();
  const cr = await emit(A, 'create', { nick: 'A', digits, mode: 'speed' });
  await emit(B, 'join', { nick: 'B', code: cr.code });
  const start = once(A, 'speedStart');
  await emit(A, 'startSpeed');
  const st = await start;
  A.close();
  B.close();
  return st.limitMs;
}

async function main() {
  setTimeout(() => { console.error('⏱️ TIMEOUT'); process.exit(2); }, 12000);
  const l3 = await limitFor(3);
  assert(l3 === 300000, `3자리 제한시간 5분(=300000): ${l3}`);
  const l4 = await limitFor(4);
  assert(l4 === 420000, `4자리 제한시간 7분(=420000): ${l4}`);
  console.log(fail ? '\n❌ 실패' : '\n✅ 통과');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
