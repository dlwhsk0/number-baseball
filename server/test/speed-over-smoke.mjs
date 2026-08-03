// 스피드 종료(speedOver)에 참가자별 histories가 담기는지 검증.
// 정답은 서버만 알므로, 서버 판정을 이용한 일관성 솔버로 실제로 풀어 종료를 유발한다.
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

// 3자리 후보(맨 앞 0 제외, 서로 다름) 전체.
function candidates() {
  const out = [];
  for (let a = 1; a <= 9; a++)
    for (let b = 0; b <= 9; b++)
      for (let c = 0; c <= 9; c++)
        if (a !== b && b !== c && a !== c) out.push(`${a}${b}${c}`);
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
  for (let tries = 0; tries < 20; tries++) {
    const g = cands[0];
    const r = await emit(sock, 'guess', { guess: g });
    if (!r.ok) throw new Error('guess 실패: ' + r.error);
    const j = r.judgement;
    if (j.strikes === 3) return tries + 1;
    cands = cands.filter((c) => {
      const jj = judge(c, g);
      return jj.strikes === j.strikes && jj.balls === j.balls;
    });
    if (cands.length === 0) throw new Error('후보 소진(판정 불일치)');
  }
  throw new Error('20회 내 못 풀음');
}

async function main() {
  const A = await conn();
  const B = await conn();
  const cr = await emit(A, 'create', { nick: '앨리스', digits: 3, mode: 'speed' });
  assert(cr.ok && cr.mode === 'speed', `스피드 방 ${cr.code}`);
  const jr = await emit(B, 'join', { nick: '밥', code: cr.code });
  assert(jr.ok, '밥 입장');

  const startAll = Promise.all([once(A, 'speedStart'), once(B, 'speedStart')]);
  await emit(A, 'startSpeed');
  await startAll;
  assert(true, '레이스 시작');

  const overP = once(A, 'speedOver');
  const na = await solve(A);
  const nb = await solve(B);
  assert(na > 0 && nb > 0, `둘 다 해결(A ${na}회, B ${nb}회)`);

  const over = await overP;
  assert(Array.isArray(over.histories), 'speedOver.histories 존재');
  assert(over.histories.length === 2, `histories에 2명 (${over.histories.length})`);
  const a = over.histories.find((h) => h.nick === '앨리스');
  const b = over.histories.find((h) => h.nick === '밥');
  assert(a && a.history.length === na, `앨리스 기록 ${a?.history.length}=${na}`);
  assert(b && b.history.length === nb, `밥 기록 ${b?.history.length}=${nb}`);
  assert(a.history[0] && a.history[0].guess && a.history[0].judgement, '기록에 guess·judgement 포함');

  A.close();
  B.close();
  console.log(fail ? '\n❌ 실패' : '\n✅ 통과');
  process.exit(fail ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
