// 스피드 재대결: 종료 → speedRematch → speedReset(로비) → 다시 시작 가능.
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

function candidates() {
  const out = [];
  for (let a = 1; a <= 9; a++)
    for (let b = 0; b <= 9; b++)
      for (let c = 0; c <= 9; c++) if (a !== b && b !== c && a !== c) out.push(`${a}${b}${c}`);
  return out;
}
const jl = (sec, g) => {
  let s = 0, b = 0;
  for (let i = 0; i < 3; i++) g[i] === sec[i] ? s++ : sec.includes(g[i]) && b++;
  return { s, b };
};
async function solve(sock) {
  let c = candidates();
  for (let i = 0; i < 20; i++) {
    const g = c[0];
    const r = await emit(sock, 'guess', { guess: g });
    if (r.judgement.strikes === 3) return;
    c = c.filter((x) => { const j = jl(x, g); return j.s === r.judgement.strikes && j.b === r.judgement.balls; });
  }
  throw new Error('못 풀음');
}

async function main() {
  setTimeout(() => { console.error('⏱️ TIMEOUT'); process.exit(2); }, 18000);
  const A = await conn();
  const B = await conn();
  const cr = await emit(A, 'create', { nick: 'A', digits: 3, mode: 'speed' });
  await emit(B, 'join', { nick: 'B', code: cr.code });
  const startedA = once(A, 'speedStart');
  await emit(A, 'startSpeed');
  await startedA;
  const over1 = once(A, 'speedOver');
  await solve(A);
  await solve(B);
  await over1;
  assert(true, '1판 종료');

  // 재대결 → 로비 리셋 (speedRematch는 ack 없는 이벤트라 그냥 emit)
  const resetA = once(A, 'speedReset');
  const resetB = once(B, 'speedReset');
  A.emit('speedRematch');
  const rA = await resetA;
  await resetB;
  assert(rA.players.length === 2, 'speedReset → 로비(2명 유지)');

  // 다시 시작 가능
  const start2 = once(B, 'speedStart');
  const sr = await emit(A, 'startSpeed');
  assert(sr.ok, '재시작 ack');
  const st2 = await start2;
  assert(typeof st2.startAt === 'number', '2판 speedStart 수신');

  // 리셋됐는지: 진행 정보 초기화 확인(한 번 추측 → attempts 1 근처)
  const prog = once(B, 'speedProgress');
  await emit(A, 'guess', { guess: '123' });
  const p = await prog;
  const a = p.standings.find((s) => s.nick === 'A');
  assert(a && a.attempts >= 1 && a.solved === false, `2판 진행 초기화됨(attempts=${a?.attempts})`);

  A.close();
  B.close();
  console.log(fail ? '\n❌ 실패' : '\n✅ 통과');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
