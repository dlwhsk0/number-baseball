// 온라인 턴제 대결 서버 — Socket.IO. 방 코드로 1:1 입장, 서버가 정답을 쥐고 판정한다.
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { isValidGuess, judge, isWin } from './logic.js';
import {
  createRoom,
  joinRoom,
  getRoom,
  deleteRoom,
  bothSecretsSet,
  type Room,
} from './rooms.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  Outcome,
} from './types.js';

const PORT = Number(process.env.PORT) || 3001;
// 배포 시 프론트 도메인만 허용(예: https://number-baseball-chi.vercel.app). 기본은 전체 허용(개발).
const ORIGIN = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*';
// 결과 발표 텀(ms) — 이 시간 동안 양쪽에 결과를 보여준 뒤 턴을 넘긴다. 테스트에선 짧게.
const REVEAL_MS = Number(process.env.REVEAL_MS) || 1900;

const httpServer = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok');
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
  httpServer,
  { cors: { origin: ORIGIN } },
);

function sanitizeNick(nick: unknown): string {
  const n = String(nick ?? '').trim().slice(0, 12);
  return n || '플레이어';
}

function endGame(room: Room, outcome: Outcome): void {
  room.phase = 'over';
  io.to(room.code).emit('over', {
    outcome,
    secrets: [room.players[0]?.secret ?? null, room.players[1]?.secret ?? null],
    attempts: [room.histories[0].length, room.histories[1].length],
  });
}

// 결과 발표 텀 뒤 턴/종료로 진행. 발표 중(pending) 방이 사라지거나 바뀌면 무시.
function advanceAfterReveal(room: Room, guesser: 0 | 1): void {
  setTimeout(() => {
    if (getRoom(room.code) !== room || room.phase !== 'playing' || !room.pending) return;
    room.pending = false;
    if (guesser === 0) {
      room.turn = 1;
      io.to(room.code).emit('turn', { turn: 1 });
    } else {
      if (room.solved[0] && room.solved[1]) endGame(room, 'draw');
      else if (room.solved[0]) endGame(room, 0);
      else if (room.solved[1]) endGame(room, 1);
      else {
        room.turn = 0;
        io.to(room.code).emit('turn', { turn: 0 });
      }
    }
  }, REVEAL_MS);
}

io.on('connection', (socket) => {
  const data = socket.data;

  socket.on('create', ({ nick, digits }, ack) => {
    const d = digits === 4 ? 4 : 3;
    const room = createRoom(socket.id, sanitizeNick(nick), d);
    data.code = room.code;
    data.index = 0;
    socket.join(room.code);
    ack({ ok: true, code: room.code, index: 0, digits: d });
  });

  socket.on('join', ({ nick, code }, ack) => {
    const c = String(code ?? '').toUpperCase().trim();
    const res = joinRoom(c, socket.id, sanitizeNick(nick));
    if (res.error || !res.room) {
      ack({ ok: false, error: res.error });
      return;
    }
    data.code = c;
    data.index = 1;
    socket.join(c);
    ack({
      ok: true,
      code: c,
      index: 1,
      digits: res.room.digits,
      opponentNick: res.room.players[0].nick,
    });
    socket.to(c).emit('opponentJoined', { nick: res.room.players[1].nick });
    // 둘 다 입장 → 비밀 숫자 정하기 단계
    res.room.phase = 'secret';
    io.to(c).emit('phase', { phase: 'secret', digits: res.room.digits });
  });

  socket.on('setSecret', ({ secret }, ack) => {
    const room = getRoom(data.code);
    if (!room || data.index == null) {
      ack({ ok: false, error: '방이 없어요.' });
      return;
    }
    const s = String(secret ?? '');
    if (!isValidGuess(s, room.digits)) {
      ack({ ok: false, error: '유효하지 않은 숫자예요.' });
      return;
    }
    room.players[data.index].secret = s;
    ack({ ok: true });
    io.to(room.code).emit('secretProgress', {
      ready: room.players.map((p) => p.secret != null),
    });
    if (bothSecretsSet(room)) {
      room.phase = 'playing';
      room.turn = 0;
      room.pending = false;
      io.to(room.code).emit('start', { turn: 0, digits: room.digits });
    }
  });

  socket.on('guess', ({ guess }, ack) => {
    const room = getRoom(data.code);
    if (!room || data.index == null) {
      ack({ ok: false, error: '방이 없어요.' });
      return;
    }
    if (room.phase !== 'playing' || room.pending) {
      ack({ ok: false, error: '지금은 추측할 수 없어요.' });
      return;
    }
    const p = data.index;
    if (room.turn !== p) {
      ack({ ok: false, error: '상대 차례예요.' });
      return;
    }
    const g = String(guess ?? '');
    if (!isValidGuess(g, room.digits)) {
      ack({ ok: false, error: '유효하지 않은 추측이에요.' });
      return;
    }
    const opponentSecret = room.players[1 - p].secret;
    if (opponentSecret == null) {
      ack({ ok: false, error: '상대가 아직 준비 중이에요.' });
      return;
    }
    const judgement = judge(opponentSecret, g);
    room.histories[p].push({ guess: g, judgement });
    if (isWin(judgement, room.digits)) room.solved[p] = true;
    ack({ ok: true });

    // 결과를 양쪽에 발표(추측한 사람 숫자는 상대의 비밀과 무관하므로 공개해도 공정성 유지).
    room.pending = true;
    io.to(room.code).emit('reveal', {
      by: p,
      guess: g,
      judgement,
      solved: room.solved[p],
      attempts: room.histories[p].length,
    });
    // 발표 텀 뒤 턴/종료 진행(선공 먼저, 후공에게 같은 라운드 마지막 기회)
    advanceAfterReveal(room, p);
  });

  socket.on('input', ({ value }) => {
    const room = getRoom(data.code);
    if (!room || data.index == null) return;
    if (room.phase !== 'playing' || room.pending || room.turn !== data.index) return;
    const v = String(value ?? '')
      .replace(/[^0-9]/g, '')
      .slice(0, room.digits);
    socket.to(room.code).emit('opponentInput', { value: v });
  });

  socket.on('rematch', () => {
    const room = getRoom(data.code);
    if (!room || data.index == null) return;
    room.rematch[data.index] = true;
    socket.to(room.code).emit('rematchRequested'); // 상대에게 신청 알림
    if (room.players.length === 2 && room.rematch[0] && room.rematch[1]) {
      room.histories = [[], []];
      room.solved = [false, false];
      room.rematch = [false, false];
      room.players.forEach((pl) => (pl.secret = null));
      room.phase = 'secret';
      room.turn = 0;
      room.pending = false;
      io.to(room.code).emit('phase', { phase: 'secret', digits: room.digits });
    }
  });

  socket.on('disconnect', () => {
    const room = getRoom(data.code);
    if (!room) return;
    // 한 명이라도 나가면 방을 정리하고 상대에게 알린다.
    socket.to(room.code).emit('opponentLeft');
    deleteRoom(room.code);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[number-baseball] online duel server listening on :${PORT}`);
});
