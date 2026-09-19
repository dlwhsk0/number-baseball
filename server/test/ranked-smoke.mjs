// 솔로 랭킹전(서버 판정) + 순위표 검증. DATABASE_URL이 붙은 서버가 필요하다.
//   URL=http://localhost:3001 node server/test/ranked-smoke.mjs
import { io } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
const URL = process.env.URL || 'http://localhost:3001';
const emit = (s, ev, p) => new Promise((r) => s.emit(ev, p, r));
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

async function main() {
  const S = await conn();
  const me = randomUUID();

  // 검증: 잘못된 신원/구단 거부
  let r = await emit(S, 'rankedStart', { playerId: 'nope', nick: 'x', team: 'lg', digits: 3 });
  assert(!r.ok, '형식 틀린 playerId 거부');
  r = await emit(S, 'rankedStart', { playerId: me, nick: 'x', team: 'yankees', digits: 3 });
  assert(!r.ok, '없는 구단 거부');
  r = await emit(S, 'rankedGuess', { gameId: 'bogus', guess: '123' });
  assert(!r.ok && r.expired, '없는 gameId → expired');

  // 한 판 풀기
  r = await emit(S, 'rankedStart', { playerId: me, nick: '엘지팬', team: 'lg', digits: 3 });
  assert(r.ok && r.gameId && r.maxAttempts === 10 && r.guesses.length === 0, '랭킹전 시작');
  const gameId = r.gameId;
  const bad = await emit(S, 'rankedGuess', { gameId, guess: '112' });
  assert(!bad.ok, '중복 숫자 추측 거부');

  let cands = candidates();
  let final;
  for (let i = 0; i < 10; i++) {
    const g = cands[0];
    await sleep(300);
    const gr = await emit(S, 'rankedGuess', { gameId, guess: g });
    if (!gr.ok) throw new Error('guess 실패: ' + gr.error);
    if (i === 0) {
      // 이어하기: 같은 조건으로 다시 start하면 같은 판·기록 유지
      const again = await emit(S, 'rankedStart', { playerId: me, nick: '엘지팬', team: 'lg', digits: 3 });
      assert(again.gameId === gameId && again.guesses.length === 1, '재시작 시 진행 중 판 이어하기');
    }
    if (gr.status !== 'playing') {
      final = gr;
      break;
    }
    assert(gr.secret === undefined, `진행 중엔 정답 비공개 (${i + 1}회)`);
    cands = cands.filter((c) => {
      const jj = judge(c, g);
      return jj.strikes === gr.judgement.strikes && jj.balls === gr.judgement.balls;
    });
  }
  assert(final && final.secret && final.secret.length === 3, `종료·정답 공개 ${final?.secret}`);
  if (final.status === 'won') {
    assert(final.result.points >= 1 && final.result.points <= 10, `점수 ${final.result.points}`);
  } else {
    assert(final.result.points === 0, '실패 0점');
  }
  assert(final.result.recorded, 'DB 기록됨');
  assert(final.result.team === 'lg' && final.result.teamRank >= 1, `LG 구단 ${final.result.teamRank}위`);
  assert(final.result.total >= final.result.points && final.result.rank >= 1, `내 누적 ${final.result.total} (${final.result.rank}위)`);
  const after = await emit(S, 'rankedGuess', { gameId, guess: '123' });
  assert(!after.ok && after.expired, '끝난 판에 추측 불가');

  // 포기(forfeit): 추측 1번 후 새 판 → 실패로 기록
  r = await emit(S, 'rankedStart', { playerId: me, nick: '엘지팬', team: 'lg', digits: 3 });
  await sleep(300);
  await emit(S, 'rankedGuess', { gameId: r.gameId, guess: '123' });
  const r2 = await emit(S, 'rankedStart', { playerId: me, nick: '엘지팬', team: 'lg', digits: 3, forfeit: true });
  assert(r2.ok && r2.gameId !== r.gameId && r2.guesses.length === 0, '포기 후 새 판');
  await sleep(300);

  const lb = await emit(S, 'leaderboard', { playerId: me });
  assert(lb.ok && lb.data.team.length === 10, '순위표: 10개 구단');
  const lg = lb.data.team.find((t) => t.team === 'lg');
  assert(lg.games >= 2, `LG 판 수 ${lg.games} (포기 포함)`);
  assert(lb.data.me && lb.data.me.games >= 2, `내 기록 ${lb.data.me?.games}판`);
  assert(lb.data.players.some((p) => p.me) && lb.data.players.every((p) => p.playerId === undefined), '개인 순위: 내 표시 + 남의 id 비노출');
  assert(Array.isArray(lb.data.versus) && lb.data.versus.length === 10, '구단 대결표 10행');

  S.close();
  if (fail) process.exit(1);
  console.log('ranked-smoke OK');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
