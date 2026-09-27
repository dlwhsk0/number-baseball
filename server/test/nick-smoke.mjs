// 닉네임 유일성 + 랜덤 닉네임 검증. DATABASE_URL이 붙은 서버가 필요하다.
//   URL=http://localhost:3001 node server/test/nick-smoke.mjs
// (실제 DB에 테스트 플레이어 행이 남는다 — 라이브에선 돌린 뒤 정리.)
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

const s = await conn();
const a = randomUUID();
const b = randomUUID();
const name = `닉${Math.floor(Math.random() * 1e6)}`;

const r1 = await emit(s, 'claimNick', { playerId: a, nick: '', team: 'doosan' });
assert(r1.ok && r1.nick && r1.nick !== '플레이어', `빈 닉네임 → 랜덤(${r1.nick})`);
const r2 = await emit(s, 'claimNick', { playerId: a, nick: '', team: 'doosan' });
assert(r2.ok && r2.nick === r1.nick, '다시 비워 보내도 같은 닉네임 유지');

const r3 = await emit(s, 'claimNick', { playerId: a, nick: name, team: 'doosan' });
assert(r3.ok && r3.nick === name, '새 닉네임 등록');
const r4 = await emit(s, 'claimNick', { playerId: b, nick: name, team: 'lg' });
assert(!r4.ok && r4.taken, '다른 사람이 같은 닉네임 → 거절');
const r5 = await emit(s, 'claimNick', { playerId: a, nick: name, team: 'doosan' });
assert(r5.ok, '내 닉네임 다시 저장은 OK');

const r6 = await emit(s, 'claimNick', { playerId: b, nick: '플레이어', team: 'lg' });
assert(r6.ok && r6.nick !== '플레이어', `'플레이어'는 예약어 → 랜덤(${r6.nick})`);

// 확인 없이 들어오는 경로(랭킹전 시작)도 중복이면 원래 이름 유지 + ack로 알려줌.
const st = await emit(s, 'rankedStart', { playerId: b, nick: name, team: 'lg', digits: 3 });
assert(st.ok && st.nick === r6.nick, `랭킹전 시작에 남의 닉네임 → 원래 이름(${st.nick})`);

s.close();
console.log(fail ? 'nick-smoke FAIL' : 'nick-smoke OK');
process.exit(fail ? 1 : 0);
