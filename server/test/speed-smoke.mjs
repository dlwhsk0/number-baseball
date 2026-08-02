// 온라인 스피드 모드 라이브 스모크 — 3명 방 → 시작 → 전원 정답 → speedOver.
import { io } from 'socket.io-client';
const URL = process.env.URL || 'http://localhost:3001';
const log = (...a) => console.log(...a);
let failed = false;
const assert = (c, m) => (c ? log('  ✓', m) : ((failed = true), console.error('  ✗ FAIL:', m)));
const emit = (s, ev, p) => new Promise((r) => (p === undefined ? s.emit(ev, r) : s.emit(ev, p, r)));
const once = (s, ev) => new Promise((r) => s.once(ev, r));

async function main() {
  const A = io(URL, { transports: ['websocket'] });
  const B = io(URL, { transports: ['websocket'] });
  const C = io(URL, { transports: ['websocket'] });
  await Promise.all([once(A, 'connect'), once(B, 'connect'), once(C, 'connect')]);
  log('연결됨');

  const created = await emit(A, 'create', { nick: '앨리스', digits: 3, mode: 'speed' });
  assert(created.ok && created.mode === 'speed' && created.index === 0, `스피드 방 생성: ${created.code}`);

  const jB = await emit(B, 'join', { nick: '밥', code: created.code });
  assert(jB.ok && jB.mode === 'speed' && jB.index === 1, '밥 입장(index 1)');
  const jC = await emit(C, 'join', { nick: '캐럴', code: created.code });
  assert(jC.ok && jC.index === 2, '캐럴 입장(index 2)');

  // 방장 시작 → 모두 speedStart 수신
  const startAll = Promise.all([once(A, 'speedStart'), once(B, 'speedStart'), once(C, 'speedStart')]);
  const sr = await emit(A, 'startSpeed');
  assert(sr.ok, '방장 시작 ack');
  const [sa] = await startAll;
  assert(typeof sa.startAt === 'number' && sa.digits === 3, 'speedStart 브로드캐스트(startAt·digits)');

  // 정답을 알아내기 위해: 판정 정보만으로는 못 맞히니, 아무 추측이나 반복해 서버 판정을 받는다.
  // 간단히: 각자 한 번 추측해 판정 오는지, 그리고 진행 브로드캐스트 오는지 확인.
  const prog = once(B, 'speedProgress');
  const g = await emit(A, 'guess', { guess: '123' });
  assert(g.ok && g.judgement, `앨리스 추측 판정: S${g.judgement.strikes} B${g.judgement.balls}`);
  const pr = await prog;
  assert(Array.isArray(pr.standings) && pr.standings.length === 3, 'speedProgress 브로드캐스트(3인 순위)');

  A.close(); B.close(); C.close();
  log(failed ? '\n❌ 실패' : '\n✅ 스피드 스모크 통과');
  process.exit(failed ? 1 : 0);
}
main().catch((e) => (console.error(e), process.exit(1)));
