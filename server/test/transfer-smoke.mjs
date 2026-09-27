// 기기 옮기기(코드 발급·입력·기록 합치기) 검증. DATABASE_URL이 붙은 서버가 필요하다.
//   URL=http://localhost:3001 node server/test/transfer-smoke.mjs
// (실제 DB에 테스트 플레이어·판 1개가 남는다 — 라이브에선 돌린 뒤 정리.)
import { io } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
const URL = process.env.URL || 'http://localhost:3001';
const emit = (s, ev, p) => new Promise((r) => s.emit(ev, p, r));
const conn = () =>
  new Promise((resolve, reject) => {
    const s = io(URL, { transports: ['websocket'], reconnection: false, timeout: 5000 });
    const timer = setTimeout(() => reject(new Error(`연결 실패(${URL})`)), 6000);
    s.once('connect_error', (e) => (clearTimeout(timer), reject(e)));
    s.once('connect', () => (clearTimeout(timer), resolve(s)));
  });
let fail = false;
const assert = (c, m) => (c ? console.log('  ✓', m) : ((fail = true), console.error('  ✗ FAIL:', m)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const s = await conn();
const oldId = randomUUID(); // 원래 기기
const newId = randomUUID(); // 새 기기(여기서도 한 판 함)
const nick = `옮김${Math.floor(Math.random() * 1e6)}`;

const none = await emit(s, 'transferCreate', { playerId: randomUUID() });
assert(!none.ok, '기록 없는 기기는 코드 발급 불가');

await emit(s, 'claimNick', { playerId: oldId, nick, team: 'kia' });

// 새 기기: 랭킹전 한 판(추측 1번 후 포기 → 실패 1판 기록)
const st = await emit(s, 'rankedStart', { playerId: newId, nick: '', team: 'lg', digits: 3 });
await emit(s, 'rankedGuess', { gameId: st.gameId, guess: '123' });
await sleep(300);
await emit(s, 'rankedStart', { playerId: newId, nick: '', team: 'lg', digits: 3, forfeit: true });

const c1 = await emit(s, 'transferCreate', { playerId: oldId });
assert(c1.ok && /^[A-Z2-9]{6}$/.test(c1.code), `코드 발급(${c1.code})`);
const c2 = await emit(s, 'transferCreate', { playerId: oldId });
assert(c2.ok && c2.code !== c1.code, '다시 받으면 새 코드');
const stale = await emit(s, 'transferRedeem', { code: c1.code, playerId: newId });
assert(!stale.ok, '이전 코드는 무효');

const bad = await emit(s, 'transferRedeem', { code: 'ZZZZZZ', playerId: newId });
assert(!bad.ok, '틀린 코드 거절');

const ok = await emit(s, 'transferRedeem', { code: c2.code.toLowerCase(), playerId: newId });
assert(ok.ok && ok.playerId === oldId && ok.nick === nick && ok.team === 'kia', '코드 입력 → 원래 기기 신원(소문자 입력도 OK)');
const again = await emit(s, 'transferRedeem', { code: c2.code, playerId: newId });
assert(!again.ok, '코드는 1회용');

const lbOld = await emit(s, 'leaderboard', { playerId: oldId });
assert(lbOld.ok && lbOld.data.me?.games === 1, `새 기기 판이 원래 id로 합쳐짐(games=${lbOld.data.me?.games})`);
const lbNew = await emit(s, 'leaderboard', { playerId: newId });
assert(lbNew.ok && lbNew.data.me === null, '새 기기 id는 사라짐');

s.close();
console.log(fail ? 'transfer-smoke FAIL' : 'transfer-smoke OK');
process.exit(fail ? 1 : 0);
