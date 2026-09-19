// setSecret 권한/단계 가드: 판 도중 정답 바꿔치기 · 턴 무한 획득 · 스피드 방 오염 차단.
// (가드가 없으면 setSecret이 turn·pending을 리셋해 방장이 턴을 넘기지 않고 계속 던질 수 있었다.)
import { io } from 'socket.io-client';
const URL = process.env.URL || 'http://localhost:3001';
const emit = (s, ev, p) => new Promise((r) => (p === undefined ? s.emit(ev, r) : s.emit(ev, p, r)));
const once = (s, ev) => new Promise((r) => s.once(ev, r));
// 스피드 시작 연출(introMs) 동안은 서버가 추측을 거부하므로, 연출이 끝날 때까지 기다린 뒤 진행.
const startGate = (s) =>
  once(s, 'speedStart').then(async (p) => {
    await new Promise((r) => setTimeout(r, (p?.introMs ?? 0) + 50));
    return p;
  });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const conn = () => {
  const s = io(URL, { transports: ['websocket'] });
  return once(s, 'connect').then(() => s);
};
let fail = false;
const assert = (c, m) => (c ? console.log('  ✓', m) : ((fail = true), console.error('  ✗ FAIL:', m)));

async function duelGuard() {
  console.log('턴제 — setSecret 단계 가드');
  const A = await conn();
  const B = await conn();
  const cr = await emit(A, 'create', { nick: 'A', digits: 3, mode: 'duel' });
  await emit(B, 'join', { nick: 'B', code: cr.code });

  // secret 단계: 한 번은 되고, 두 번째는 막혀야 한다.
  const first = await emit(A, 'setSecret', { secret: '123' });
  assert(first.ok === true, 'secret 단계에서 최초 setSecret 성공');
  const twice = await emit(A, 'setSecret', { secret: '321' });
  assert(twice.ok === false, `secret 단계 재설정 거부: ${twice.error ?? ''}`);

  const started = once(A, 'start');
  await emit(B, 'setSecret', { secret: '456' });
  await started;

  // playing 단계: setSecret 자체가 막혀야 한다.
  const mid = await emit(A, 'setSecret', { secret: '789' });
  assert(mid.ok === false, `playing 중 setSecret 거부: ${mid.error ?? ''}`);

  // 선공이 한 수 두고 → 턴이 넘어간 뒤 setSecret으로 턴을 되돌릴 수 없어야 한다.
  const g1 = await emit(A, 'guess', { guess: '147' });
  assert(g1.ok === true, '선공 첫 추측 성공');
  await wait(2300); // REVEAL_MS(기본 1900) 경과 후 턴 전환
  await emit(A, 'setSecret', { secret: '789' }); // 막히지만 혹시라도 통과하면 turn=0으로 리셋됨
  const g2 = await emit(A, 'guess', { guess: '258' });
  assert(g2.ok === false, `연속 턴 차단(상대 차례 유지): ${g2.error ?? ''}`);

  A.close();
  B.close();
}

async function speedGuard() {
  console.log('스피드 — setSecret 모드 가드');
  const A = await conn();
  const B = await conn();
  const cr = await emit(A, 'create', { nick: 'A', digits: 3, mode: 'speed' });
  await emit(B, 'join', { nick: 'B', code: cr.code });

  const r = await emit(A, 'setSecret', { secret: '123' });
  assert(r.ok === false, `스피드 방에서 setSecret 거부: ${r.error ?? ''}`);

  // 방이 오염되지 않았으면 정상적으로 시작된다.
  const started = startGate(A);
  const st = await emit(A, 'startSpeed');
  assert(st.ok === true, `startSpeed 정상 동작: ${st.error ?? ''}`);
  await started;

  A.close();
  B.close();
}

async function main() {
  setTimeout(() => { console.error('⏱️ TIMEOUT'); process.exit(2); }, 20000);
  await duelGuard();
  await speedGuard();
  console.log(fail ? '\n❌ 실패' : '\n✅ 통과');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
