// 온라인 턴제 대결 서버 e2e 스모크 — 두 클라이언트로 한 판을 끝까지 진행한다.
// 사용: 서버(:3001)를 띄운 뒤 `node test/e2e.mjs`.
import { io } from 'socket.io-client';

const URL = process.env.URL || 'http://localhost:3001';
const log = (...a) => console.log(...a);
let failed = false;
function assert(cond, msg) {
  if (!cond) {
    failed = true;
    console.error('  ✗ FAIL:', msg);
  } else {
    log('  ✓', msg);
  }
}
const emit = (sock, ev, payload) =>
  new Promise((res) => sock.emit(ev, payload, res));
const once = (sock, ev) => new Promise((res) => sock.once(ev, res));

async function main() {
  const A = io(URL, { transports: ['websocket'] });
  const B = io(URL, { transports: ['websocket'] });
  await Promise.all([once(A, 'connect'), once(B, 'connect')]);
  log('연결됨');

  // A가 방 생성
  const created = await emit(A, 'create', { nick: '앨리스', digits: 3 });
  assert(created.ok && created.code && created.index === 0, `방 생성: ${created.code}`);

  // 둘 다 secret 단계 진입 이벤트를 기다리며 B가 입장
  const aPhase = once(A, 'phase');
  const joined = await emit(B, 'join', { nick: '밥', code: created.code });
  assert(joined.ok && joined.index === 1 && joined.digits === 3, '밥 입장');
  const ph = await aPhase;
  assert(ph.phase === 'secret', 'secret 단계 진입(양쪽)');

  // 비밀 설정: A는 456(밥이 맞힘), B는 123(앨리스가 맞힘)
  const aStart = once(A, 'start');
  const s1 = await emit(A, 'setSecret', { secret: '456' });
  const s2 = await emit(B, 'setSecret', { secret: '123' });
  assert(s1.ok && s2.ok, '비밀 숫자 설정');
  const start = await aStart;
  assert(start.turn === 0, 'start turn=0(선공 앨리스)');

  // 잘못된 값 거부 확인
  const bad = await emit(A, 'guess', { guess: '112' });
  assert(!bad.ok, '중복 숫자 추측 거부');

  // 앨리스가 밥의 숫자(123) 정답 추측 → 발표(reveal) 3스트라이크
  const aReveal = once(A, 'reveal');
  const bTurn = once(B, 'turn');
  const gWin = await emit(A, 'guess', { guess: '123' });
  assert(gWin.ok, '앨리스 추측 접수');
  const rev = await aReveal;
  assert(rev.by === 0 && rev.judgement.strikes === 3 && rev.solved, '발표: 앨리스 3스트라이크·정답');

  // 발표 텀(pending) 동안엔 추측 거부
  const pend = await emit(A, 'guess', { guess: '456' });
  assert(!pend.ok, '발표 중 추측 거부');

  const t = await bTurn;
  assert(t.turn === 1, '발표 후 후공(밥)에게 마지막 기회 턴');

  // 상대 차례에 앨리스가 또 두면 거부
  const notYours = await emit(A, 'guess', { guess: '456' });
  assert(!notYours.ok, '상대 차례엔 추측 거부');

  // 밥은 못 맞힘 → 발표 뒤 앨리스 승(outcome 0)
  const over = once(A, 'over');
  const gLose = await emit(B, 'guess', { guess: '789' });
  assert(gLose.ok, '밥 추측 접수');
  const result = await over;
  assert(result.outcome === 0, '결과: 선공(앨리스) 승');
  assert(result.secrets[0] === '456' && result.secrets[1] === '123', '종료 시 양쪽 정답 공개');
  assert(result.attempts[0] === 1 && result.attempts[1] === 1, '시도 횟수 집계');

  A.close();
  B.close();
  log(failed ? '\n❌ 실패한 단언 있음' : '\n✅ 모든 단언 통과');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
