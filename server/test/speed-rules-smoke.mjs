// 스피드 규칙: 5분 제한(강제 종료) + 지연 페널티. 짧은 env로 테스트.
//   SPEED_LIMIT_MS=2000 GUESS_LIMIT_MS=400 node dist/index.js  (서버)
import { io } from 'socket.io-client';
const URL = process.env.URL || 'http://localhost:3001';
const emit = (s, ev, p) => new Promise((r) => (p === undefined ? s.emit(ev, r) : s.emit(ev, p, r)));
const once = (s, ev) => new Promise((r) => s.once(ev, r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const conn = () => {
  const s = io(URL, { transports: ['websocket'] });
  return once(s, 'connect').then(() => s);
};
let fail = false;
const assert = (c, m) => (c ? console.log('  ✓', m) : ((fail = true), console.error('  ✗ FAIL:', m)));

async function main() {
  const A = await conn();
  const B = await conn();
  const cr = await emit(A, 'create', { nick: 'A', digits: 3, mode: 'speed' });
  await emit(B, 'join', { nick: 'B', code: cr.code });

  const startA = once(A, 'speedStart');
  await emit(A, 'startSpeed');
  const st = await startA;
  assert(typeof st.limitMs === 'number' && st.limitMs > 0, `speedStart.limitMs=${st.limitMs}`);

  // 지연 페널티: A가 GUESS_LIMIT(=400ms) 넘겨 추측 → attempts에 페널티 반영.
  await sleep(950); // 두 번의 제한 창(=페널티 2 예상)
  const g = await emit(A, 'guess', { guess: '123' });
  assert(g.ok, 'A 추측 접수');
  const progP = await once(B, 'speedProgress');
  const aStand = progP.standings.find((s) => s.nick === 'A');
  assert(aStand && aStand.attempts >= 2, `지연 페널티로 attempts 증가(=${aStand?.attempts}, 추측1회)`);

  // 5분 제한(=2000ms) 강제 종료: 아무도 못 풀어도 종료돼야.
  const over = await once(A, 'speedOver');
  assert(Array.isArray(over.standings) && over.standings.length === 2, '강제 종료 → speedOver(2명 순위)');
  assert(over.histories.length === 2, 'histories 포함');

  A.close();
  B.close();
  console.log(fail ? '\n❌ 실패' : '\n✅ 통과');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
