// 멀티 구단 대결 기록 검증: 서로 다른 구단 3인 스피드 → 순위표 versus 반영.
//   URL=http://localhost:3001 node server/test/team-versus-smoke.mjs
import { io } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
const URL = process.env.URL || 'http://localhost:3001';
const emit = (s, ev, p) => new Promise((r) => (p === undefined ? s.emit(ev, r) : s.emit(ev, p, r)));
const once = (s, ev) => new Promise((r) => s.once(ev, r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 서버가 없거나 URL이 틀리면 재연결로 영원히 매달리지 말고 바로 실패.
const conn = () =>
  new Promise((resolve, reject) => {
    const s = io(URL, { transports: ['websocket'], reconnection: false, timeout: 5000 });
    const fail = (err) => {
      clearTimeout(timer);
      s.close();
      reject(new Error(`연결 실패(${URL}): ${err?.message ?? err}`));
    };
    const timer = setTimeout(() => fail('timeout'), 6000);
    s.once('connect_error', fail);
    s.once('connect', () => {
      clearTimeout(timer);
      s.off('connect_error', fail);
      resolve(s);
    });
  });
let fail = false;
const assert = (c, m) => (c ? console.log('  ✓', m) : ((fail = true), console.error('  ✗ FAIL:', m)));

function candidates() {
  const out = [];
  for (let a = 1; a <= 9; a++)
    for (let b = 0; b <= 9; b++)
      for (let c = 0; c <= 9; c++) if (a !== b && b !== c && a !== c) out.push(`${a}${b}${c}`);
  return out;
}
function judge(secret, guess) {
  let s = 0,
    b = 0;
  for (let i = 0; i < 3; i++) {
    if (guess[i] === secret[i]) s++;
    else if (secret.includes(guess[i])) b++;
  }
  return { strikes: s, balls: b };
}
async function solve(sock) {
  let cands = candidates();
  for (let t = 0; t < 20; t++) {
    const g = cands[0];
    const r = await emit(sock, 'guess', { guess: g });
    if (!r.ok) throw new Error(r.error);
    if (r.judgement.strikes === 3) return;
    cands = cands.filter((c) => {
      const jj = judge(c, g);
      return jj.strikes === r.judgement.strikes && jj.balls === r.judgement.balls;
    });
  }
}
const W = (lb, t) => lb.data.versus.find((r) => r.team === t);

async function main() {
  const probe = await conn();
  const before = await emit(probe, 'leaderboard', {});
  assert(before.ok, '순위표 조회');

  const [A, B, C] = await Promise.all([conn(), conn(), conn()]);
  const cr = await emit(A, 'create', { nick: '기아팬', digits: 3, mode: 'speed', playerId: randomUUID(), team: 'kia' });
  const jb = await emit(B, 'join', { nick: '삼성팬', code: cr.code, playerId: randomUUID(), team: 'samsung' });
  assert(jb.players.some((p) => p.team === 'kia'), '입장 명단에 구단 포함');
  await emit(C, 'join', { nick: '한화팬', code: cr.code, playerId: randomUUID(), team: 'hanwha' });

  const overP = once(A, 'speedOver');
  await emit(A, 'startSpeed');
  // A 먼저 완주 → B 완주 → C는 한 번만 던지고 나감(기록 제외)
  await solve(A);
  await solve(B);
  await sleep(100);
  await emit(C, 'guess', { guess: '123' });
  C.emit('leave', () => {});
  const over = await overP;
  assert(over.standings.every((s) => 'team' in s), 'standings에 구단 포함');
  const winTeam = over.standings[0].team;
  const loseTeam = over.standings[1].team;

  // 기록은 speedOver 뒤 비동기로 들어가므로, 고정 대기 대신 반영될 때까지 폴링(최대 5초).
  let after;
  for (const deadline = Date.now() + 5000; Date.now() < deadline; await sleep(150)) {
    after = await emit(probe, 'leaderboard', {});
    if (W(after, winTeam).w > W(before, winTeam).w) break;
  }
  assert(W(after, winTeam).w === W(before, winTeam).w + 1, `${winTeam} +1승`);
  assert(W(after, loseTeam).l === W(before, loseTeam).l + 1, `${loseTeam} +1패`);
  const h0 = W(before, 'hanwha');
  const h1 = W(after, 'hanwha');
  assert(h1.w + h1.l + h1.d === h0.w + h0.l + h0.d, '나간 한화는 기록 없음');

  // 턴제: 같은 구단끼리는 기록 안 됨
  const D = await conn();
  const E = await conn();
  const dc = await emit(D, 'create', { nick: 'd', digits: 3, mode: 'duel', playerId: randomUUID(), team: 'nc' });
  const phaseP = once(D, 'phase');
  const je = await emit(E, 'join', { nick: 'e', code: dc.code, playerId: randomUUID(), team: 'nc' });
  assert(je.opponentTeam === 'nc', '턴제 입장 ack에 상대 구단');
  await phaseP;

  [A, B, C, D, E, probe].forEach((s) => s.close());
  if (fail) process.exit(1);
  console.log('team-versus-smoke OK');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
