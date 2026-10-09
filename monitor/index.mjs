// 서버·DB 접속 감시 → 디스코드 웹훅 알림. 의존성 없음(Node 22 전역 fetch).
// 게임 서버와 다른 곳에서 돌려야 서버가 통째로 죽은 것도 잡는다(같은 컨테이너·호스트면 같이 죽음).
//
// 검사(INTERVAL_S마다):
//   server — GET /health 가 200 'ok' + Socket.IO 폴링 핸드셰이크(실제 접속 경로)가 sid를 돌려줌
//   db     — GET /health/db 가 200(서버가 살아 있을 때만 — 서버가 죽으면 DB 상태는 알 수 없음)
// FAIL_THRESHOLD번 연속 실패하면 🔴 알림, 계속 죽어 있으면 REMIND_MIN분마다 다시, 살아나면 🟢 복구 알림(다운 시간 포함).

const env = process.env;
const WEBHOOK = env.DISCORD_WEBHOOK_URL;
const TARGET = (env.TARGET_URL || 'https://homerun.techeer.cloud-yaho.cloud').replace(/\/+$/, '');
const INTERVAL_S = Number(env.INTERVAL_S) || 30;
const TIMEOUT_MS = Number(env.TIMEOUT_MS) || 8000;
const FAIL_THRESHOLD = Number(env.FAIL_THRESHOLD) || 2;
const REMIND_MIN = Number(env.REMIND_MIN ?? 30); // 0 = 다시 알리지 않음
const MENTION = env.DISCORD_MENTION || ''; // 예: <@123456789012345678> — 알림이 폰 푸시로 오게
const NAME = env.MONITOR_NAME || '홈런 서버 모니터';

if (!WEBHOOK) {
  console.error('DISCORD_WEBHOOK_URL이 필요합니다.');
  process.exit(1);
}

const log = (...a) => console.log(new Date().toISOString(), ...a);

async function get(path) {
  return fetch(TARGET + path, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: 'no-store' });
}

/** 실패면 사유 문자열, 성공이면 null. */
async function checkServer() {
  try {
    const r = await get('/health');
    if (!r.ok) return `/health → HTTP ${r.status}`;
    if ((await r.text()).trim() !== 'ok') return '/health 응답이 ok가 아님';
    const s = await get(`/socket.io/?EIO=4&transport=polling&t=${Date.now()}`);
    if (!s.ok) return `Socket.IO 핸드셰이크 → HTTP ${s.status}`;
    if (!(await s.text()).includes('"sid"')) return 'Socket.IO 핸드셰이크 응답에 sid 없음';
    return null;
  } catch (err) {
    return errText(err);
  }
}

const DB_REASON = {
  disabled: 'DATABASE_URL이 설정돼 있지 않음',
  init_failed: '서버 시작 때 DB 연결 실패 — DB를 살린 뒤 서버 재시작 필요',
  query_failed: 'SELECT 1 실패/타임아웃 — DB가 응답하지 않음',
};

async function checkDb() {
  try {
    const r = await get('/health/db');
    if (r.ok) return null;
    if (r.status === 404) return '/health/db 없음(옛 서버 버전?)';
    const { db } = await r.json().catch(() => ({}));
    return DB_REASON[db] || `/health/db → HTTP ${r.status}`;
  } catch (err) {
    return errText(err);
  }
}

function errText(err) {
  if (err?.name === 'TimeoutError') return `응답 없음(${TIMEOUT_MS / 1000}초 타임아웃)`;
  const cause = err?.cause?.code || err?.cause?.message;
  return cause ? `${err.message} (${cause})` : String(err?.message || err);
}

function fmtDuration(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return `${Math.round(ms / 1000)}초`;
  if (m < 60) return `${m}분`;
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}

const kst = (t) => new Date(t).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false });

async function notify({ title, description, color, mention }) {
  const body = {
    username: NAME,
    content: mention && MENTION ? MENTION : undefined,
    embeds: [{ title, description, color, footer: { text: TARGET }, timestamp: new Date().toISOString() }],
  };
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(WEBHOOK, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      if (r.ok) return;
      if (r.status === 429) {
        const { retry_after = 1 } = await r.json().catch(() => ({}));
        await sleep(retry_after * 1000);
        continue;
      }
      log('웹훅 실패', r.status, await r.text().catch(() => ''));
      return;
    } catch (err) {
      log('웹훅 오류', errText(err));
      await sleep(2000);
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RED = 0xe5484d;
const GREEN = 0x30a46c;

/** 검사 하나의 상태 — 연속 실패 수, 다운 여부·시작 시각, 마지막 알림 시각. */
function makeCheck(key, label) {
  return { key, label, fails: 0, down: false, since: 0, lastAlert: 0, reason: '' };
}
const server = makeCheck('server', '🖥️ 게임 서버');
const db = makeCheck('db', '🗄️ DB(팬 랭킹)');

async function apply(c, reason, now) {
  if (reason === null) {
    if (c.down) {
      log(`${c.key} 복구`);
      await notify({
        title: `🟢 ${c.label} 복구`,
        description: `다운 시간 **${fmtDuration(now - c.since)}** (${kst(c.since)} ~ ${kst(now)})`,
        color: GREEN,
        mention: true,
      });
    }
    c.fails = 0;
    c.down = false;
    return;
  }
  c.fails++;
  if (c.fails === 1) c.since = now;
  c.reason = reason;
  log(`${c.key} 실패 ${c.fails}회: ${reason}`);
  if (!c.down && c.fails >= FAIL_THRESHOLD) {
    c.down = true;
    c.lastAlert = now;
    await notify({
      title: `🔴 ${c.label} 접속 실패`,
      description: `**사유**: ${reason}\n**첫 실패**: ${kst(c.since)} (연속 ${c.fails}회)`,
      color: RED,
      mention: true,
    });
  } else if (c.down && REMIND_MIN > 0 && now - c.lastAlert >= REMIND_MIN * 60000) {
    c.lastAlert = now;
    await notify({
      title: `🔴 ${c.label} 아직 다운 (${fmtDuration(now - c.since)}째)`,
      description: `**사유**: ${reason}`,
      color: RED,
      mention: false,
    });
  }
}

async function tick() {
  const now = Date.now();
  const serverReason = await checkServer();
  await apply(server, serverReason, now);
  // 서버가 죽으면 /health/db도 당연히 실패 — DB 알림을 중복으로 내지 않고 판단을 보류한다.
  if (serverReason === null) await apply(db, await checkDb(), now);
}

log(`감시 시작: ${TARGET} (${INTERVAL_S}초 간격, ${FAIL_THRESHOLD}회 연속 실패 시 알림)`);
if (env.NOTIFY_ON_START !== '0') {
  await notify({
    title: '👀 모니터 시작',
    description: `${INTERVAL_S}초마다 서버·DB 접속을 확인합니다.`,
    color: 0x5b8def,
  });
}

let running = false;
const loop = async () => {
  if (running) return; // 타임아웃이 길어 한 회차가 간격을 넘으면 겹치지 않게
  running = true;
  try {
    await tick();
  } catch (err) {
    log('검사 오류', err);
  } finally {
    running = false;
  }
};
await loop();
setInterval(loop, INTERVAL_S * 1000);

for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => process.exit(0));
