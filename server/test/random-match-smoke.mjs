// 턴제 랜덤 매치 스모크 — 대기열·매칭·자릿수 분리·같은 기기 제외·취소·랜덤 방 수명.
import { io } from 'socket.io-client';
const URL = process.env.URL || 'http://localhost:3001';
const emit = (s, ev, p) => new Promise((r) => (p === undefined ? s.emit(ev, r) : s.emit(ev, p, r)));
const once = (s, ev) => new Promise((r) => s.once(ev, r));
const quiet = (s, ev, ms = 400) =>
  new Promise((r) => {
    const t = setTimeout(() => r(true), ms);
    s.once(ev, () => (clearTimeout(t), r(false)));
  });
const conn = () => {
  const s = io(URL, { transports: ['websocket'] });
  return once(s, 'connect').then(() => s);
};
const pid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
let fail = false;
const assert = (c, m) => (c ? console.log('  ✓', m) : ((fail = true), console.error('  ✗ FAIL:', m)));

async function main() {
  // 1) 자릿수가 다르면 매칭 안 됨
  const a = await conn();
  const b = await conn();
  assert((await emit(a, 'queue', { nick: 'A', digits: 3, playerId: pid(1) })).ok, 'A 3자리 대기');
  const bNoMatch = quiet(b, 'matched');
  assert((await emit(b, 'queue', { nick: 'B', digits: 4, playerId: pid(2) })).ok, 'B 4자리 대기');
  assert(await bNoMatch, '자릿수 다르면 매칭 안 됨');

  // 2) 같은 기기(playerId)끼리는 매칭 안 됨
  const a2 = await conn();
  const a2NoMatch = quiet(a2, 'matched');
  await emit(a2, 'queue', { nick: 'A탭2', digits: 3, playerId: pid(1) });
  assert(await a2NoMatch, '같은 기기 두 탭은 매칭 안 됨');
  await emit(a2, 'leave');
  a2.close();

  // 3) 취소(cancelQueue) 후엔 매칭 대상 아님 — B 취소, C 4자리 → 매칭 없음
  b.emit('cancelQueue');
  await new Promise((r) => setTimeout(r, 100));
  const c = await conn();
  const cNoMatch = quiet(c, 'matched');
  await emit(c, 'queue', { nick: 'C', digits: 4, playerId: pid(3) });
  assert(await cNoMatch, '취소한 B와는 매칭 안 됨');
  await emit(c, 'leave');
  c.close();
  b.close();

  // 4) 같은 자릿수 D가 오면 A(먼저 대기)=방장, D=후공으로 성사 + phase
  const d = await conn();
  const aM = once(a, 'matched');
  const dM = once(d, 'matched');
  const aPhase = once(a, 'phase');
  const dPhase = once(d, 'phase');
  await emit(d, 'queue', { nick: 'D', digits: 3, playerId: pid(4), team: 'lg' });
  const [am, dm] = await Promise.all([aM, dM]);
  assert(am.code === dm.code && am.index === 0 && dm.index === 1, `성사 — 같은 방 ${am.code}, A=0 D=1`);
  assert(am.opponentNick === 'D' && am.opponentTeam === 'lg' && dm.opponentNick === 'A', '상대 닉·구단 전달');
  const [ap] = await Promise.all([aPhase, dPhase]);
  assert(ap.phase === 'secret' && ap.digits === 3, 'phase secret 진입');

  // 5) 랜덤 방은 코드 입장 불가
  const e = await conn();
  const pk = await emit(e, 'peek', { code: am.code });
  const jr = await emit(e, 'join', { nick: 'E', code: am.code });
  assert(!pk.ok && !jr.ok, '랜덤 방은 코드로 못 들어감');
  e.close();

  // 6) 방에 있는 동안 queue 거부
  assert(!(await emit(a, 'queue', { nick: 'A', digits: 3 })).ok, '방에 있으면 대기 거부');

  // 7) 게임 진행 후 후공이 나가도 방장은 대기 복귀가 아니라 방 종료
  await emit(a, 'setSecret', { secret: '123' });
  const aStart = once(a, 'start');
  await emit(d, 'setSecret', { secret: '456' });
  await aStart;
  const aLeft = once(a, 'opponentLeft');
  await emit(d, 'leave');
  await aLeft;
  const f = await conn();
  const pk2 = await emit(f, 'peek', { code: am.code });
  assert(!pk2.ok, '후공 이탈 → 랜덤 방 삭제(대기 복귀 없음)');

  // 8) 끊긴 소켓은 대기열에서 빠진다
  const g = await conn();
  await emit(g, 'queue', { nick: 'G', digits: 4, playerId: pid(7) });
  g.close();
  await new Promise((r) => setTimeout(r, 200));
  const h = await conn();
  const hNoMatch = quiet(h, 'matched');
  await emit(h, 'queue', { nick: 'H', digits: 4, playerId: pid(8) });
  assert(await hNoMatch, '끊긴 G와는 매칭 안 됨');
  await emit(h, 'leave');

  [a, d, f, h].forEach((s) => s.close());
  console.log(fail ? '\n❌ 실패' : '\n✅ 통과');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
