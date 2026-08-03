// 온라인 대결 서버 — Socket.IO. 방 코드로 입장, 서버가 정답을 쥐고 판정.
// 턴제(duel, 1:1) + 스피드(speed, 2~4명 동시 레이스).
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { isValidGuess, judge, isWin, generateSecret } from './logic.js';
import {
  createRoom,
  joinRoom,
  getRoom,
  deleteRoom,
  resetDuelToWaiting,
  bothSecretsSet,
  speedStandings,
  allSpeedSolved,
  activeCount,
  type Room,
} from './rooms.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
  Outcome,
  ResumeInfo,
} from './types.js';

const PORT = Number(process.env.PORT) || 3001;
const ORIGIN = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*';
const REVEAL_MS = Number(process.env.REVEAL_MS) || 1900;
const GRACE_MS = Number(process.env.GRACE_MS) || 90000;

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
  {
    cors: { origin: ORIGIN },
    pingInterval: 25000,
    pingTimeout: 40000,
  },
);

function sanitizeNick(nick: unknown): string {
  const n = String(nick ?? '').trim().slice(0, 12);
  return n || '플레이어';
}

// ---------- 턴제(duel) ----------
function endGame(room: Room, outcome: Outcome): void {
  room.phase = 'over';
  const payload = {
    outcome,
    secrets: [room.players[0]?.secret ?? null, room.players[1]?.secret ?? null],
    attempts: [room.histories[0].length, room.histories[1].length],
  };
  room.lastOver = payload;
  io.to(room.code).emit('over', payload);
}

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

// ---------- 스피드(speed) ----------
function speedRoster(room: Room): { index: number; nick: string; connected: boolean }[] {
  return room.players
    .map((p, i) => ({ index: i, nick: p.nick, connected: p.connected, gone: p.gone }))
    .filter((p) => !p.gone)
    .map(({ index, nick, connected }) => ({ index, nick, connected }));
}
function broadcastSpeedRoster(room: Room): void {
  io.to(room.code).emit('speedRoster', { players: speedRoster(room) });
}
function broadcastSpeedProgress(room: Room): void {
  io.to(room.code).emit('speedProgress', { standings: speedStandings(room) });
}
function maybeEndSpeed(room: Room): void {
  if (room.phase !== 'playing' || !allSpeedSolved(room)) return;
  room.phase = 'over';
  io.to(room.code).emit('speedOver', {
    standings: speedStandings(room),
    secret: room.speedSecret ?? '',
  });
}

io.on('connection', (socket) => {
  const data = socket.data;

  socket.on('create', ({ nick, digits, mode }, ack) => {
    const d = digits === 4 ? 4 : 3;
    const m = mode === 'speed' ? 'speed' : 'duel';
    const room = createRoom(socket.id, sanitizeNick(nick), d, m);
    data.code = room.code;
    data.index = 0;
    socket.join(room.code);
    ack({ ok: true, code: room.code, index: 0, digits: d, mode: m, token: room.players[0].token });
  });

  socket.on('join', ({ nick, code }, ack) => {
    const c = String(code ?? '').toUpperCase().trim();
    const res = joinRoom(c, socket.id, sanitizeNick(nick));
    if (res.error || !res.room || res.index == null) {
      ack({ ok: false, error: res.error });
      return;
    }
    const room = res.room;
    data.code = c;
    data.index = res.index;
    socket.join(c);

    if (room.mode === 'speed') {
      ack({
        ok: true,
        code: c,
        index: res.index,
        digits: room.digits,
        mode: 'speed',
        players: speedRoster(room).map(({ index, nick: n }) => ({ index, nick: n })),
        token: room.players[res.index].token,
      });
      broadcastSpeedRoster(room);
      return;
    }

    // 턴제: 둘 다 입장 → 비밀 정하기
    ack({
      ok: true,
      code: c,
      index: 1,
      digits: room.digits,
      mode: 'duel',
      opponentNick: room.players[0].nick,
      token: room.players[1].token,
    });
    socket.to(c).emit('opponentJoined', { nick: room.players[1].nick });
    room.phase = 'secret';
    io.to(c).emit('phase', { phase: 'secret', digits: room.digits });
  });

  // 입장 전 방 종류만 조회 — 코드 입장 시 스피드/턴제를 자동으로 맞추기 위해(부수효과 없음).
  socket.on('peek', ({ code }, ack) => {
    if (typeof ack !== 'function') return;
    const room = getRoom(String(code ?? '').toUpperCase().trim());
    if (!room) {
      ack({ ok: false, error: '방을 찾을 수 없어요. 코드를 확인해주세요.' });
      return;
    }
    if (room.players.length >= room.maxPlayers) {
      ack({ ok: false, error: '방이 가득 찼어요.' });
      return;
    }
    if (room.mode === 'speed' && room.phase !== 'waiting') {
      ack({ ok: false, error: '이미 시작한 방이에요.' });
      return;
    }
    ack({ ok: true, mode: room.mode, digits: room.digits });
  });

  socket.on('startSpeed', (ack) => {
    if (typeof ack !== 'function') return;
    const room = getRoom(data.code);
    if (!room || data.index == null) {
      ack({ ok: false, error: '방이 없어요.' });
      return;
    }
    if (room.mode !== 'speed') {
      ack({ ok: false, error: '스피드 방이 아니에요.' });
      return;
    }
    if (data.index !== 0) {
      ack({ ok: false, error: '방장만 시작할 수 있어요.' });
      return;
    }
    if (room.phase !== 'waiting') {
      ack({ ok: false, error: '이미 시작했어요.' });
      return;
    }
    if (activeCount(room) < 2) {
      ack({ ok: false, error: '2명 이상이어야 시작해요.' });
      return;
    }
    room.speedSecret = generateSecret(room.digits);
    room.startedAt = Date.now();
    room.phase = 'playing';
    ack({ ok: true });
    io.to(room.code).emit('speedStart', { startAt: room.startedAt, digits: room.digits });
    broadcastSpeedProgress(room);
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

    // 스피드: 공통 숫자를 각자 푼다.
    if (room.mode === 'speed') {
      if (room.phase !== 'playing') {
        ack({ ok: false, error: '지금은 추측할 수 없어요.' });
        return;
      }
      const me = room.players[data.index];
      if (!me || me.gone) {
        ack({ ok: false, error: '참가 상태가 아니에요.' });
        return;
      }
      if (me.solved) {
        ack({ ok: false, error: '이미 맞혔어요.' });
        return;
      }
      const g = String(guess ?? '');
      if (!isValidGuess(g, room.digits) || room.speedSecret == null) {
        ack({ ok: false, error: '유효하지 않은 추측이에요.' });
        return;
      }
      const judgement = judge(room.speedSecret, g);
      me.history.push({ guess: g, judgement });
      me.attempts = me.history.length;
      if (isWin(judgement, room.digits)) {
        me.solved = true;
        me.solveMs = Date.now() - room.startedAt;
      }
      ack({ ok: true, judgement });
      broadcastSpeedProgress(room);
      maybeEndSpeed(room);
      return;
    }

    // 턴제
    if (room.phase !== 'playing' || room.pending) {
      ack({ ok: false, error: '지금은 추측할 수 없어요.' });
      return;
    }
    const p = (data.index === 1 ? 1 : 0) as 0 | 1;
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
    room.pending = true;
    io.to(room.code).emit('reveal', {
      by: p,
      guess: g,
      judgement,
      solved: room.solved[p],
      attempts: room.histories[p].length,
    });
    advanceAfterReveal(room, p);
  });

  socket.on('input', ({ value }) => {
    const room = getRoom(data.code);
    if (!room || data.index == null || room.mode !== 'duel') return;
    if (room.phase !== 'playing' || room.pending || room.turn !== data.index) return;
    const v = String(value ?? '')
      .replace(/[^0-9]/g, '')
      .slice(0, room.digits);
    socket.to(room.code).emit('opponentInput', { value: v });
  });

  socket.on('rematch', () => {
    const room = getRoom(data.code);
    if (!room || data.index == null || room.mode !== 'duel') return;
    room.rematch[data.index === 1 ? 1 : 0] = true;
    socket.to(room.code).emit('rematchRequested');
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

  socket.on('rejoin', ({ code, index, token }, ack) => {
    const room = getRoom(String(code ?? '').toUpperCase().trim());
    if (!room) {
      ack({ ok: false, error: '방이 사라졌어요.' });
      return;
    }
    const idx = Math.max(0, Math.min(room.players.length - 1, Math.floor(Number(index) || 0)));
    const me = room.players[idx];
    if (!me || me.token !== token || me.gone) {
      ack({ ok: false, error: '재접속 정보가 올바르지 않아요.' });
      return;
    }
    if (me.graceTimer) {
      clearTimeout(me.graceTimer);
      me.graceTimer = undefined;
    }
    me.id = socket.id;
    me.connected = true;
    data.code = room.code;
    data.index = idx;
    socket.join(room.code);

    if (room.mode === 'speed') {
      const resume: ResumeInfo = {
        mode: 'speed',
        phase: room.phase === 'over' ? 'over' : room.phase === 'waiting' ? 'lobby' : 'playing',
        digits: room.digits,
        startAt: room.startedAt,
        myHistory: me.history,
        standings: speedStandings(room),
        over:
          room.phase === 'over'
            ? { standings: speedStandings(room), secret: room.speedSecret ?? '' }
            : undefined,
      };
      ack({ ok: true, resume });
      broadcastSpeedRoster(room);
      broadcastSpeedProgress(room);
      return;
    }

    // 턴제
    const dIdx = (idx === 1 ? 1 : 0) as 0 | 1;
    const opp = room.players[1 - dIdx];
    const resume: ResumeInfo = {
      mode: 'duel',
      phase: room.phase === 'waiting' ? 'lobby' : room.phase,
      digits: room.digits,
      turn: room.turn,
      secretReady: room.players.map((p) => p.secret != null),
      mySecretSet: me.secret != null,
      oppAttempts: room.histories[1 - dIdx].length,
      oppSolved: room.solved[1 - dIdx],
      oppHistory: room.histories[1 - dIdx],
      opponentNick: opp?.nick ?? '상대',
      opponentConnected: opp?.connected ?? false,
      over: room.phase === 'over' ? room.lastOver : undefined,
    };
    ack({ ok: true, resume });
    socket.to(room.code).emit('opponentReconnected');
  });

  socket.on('leave', (ack) => {
    const room = getRoom(data.code);
    if (room) {
      if (room.mode === 'speed' && data.index != null && room.players[data.index]) {
        const me = room.players[data.index];
        if (me.graceTimer) {
          clearTimeout(me.graceTimer);
          me.graceTimer = undefined;
        }
        me.gone = true;
        me.connected = false;
        if (activeCount(room) === 0) deleteRoom(room.code);
        else {
          broadcastSpeedRoster(room);
          broadcastSpeedProgress(room);
          maybeEndSpeed(room);
        }
      } else {
        // 턴제 — 방은 방장(index 0) 소유. 방장이 나가면 방 종료, 후공이 나가면 방장은 대기 유지.
        const leaverIsHost = data.index === 0;
        if (leaverIsHost || room.players.length <= 1) {
          room.players.forEach((p) => {
            if (p.graceTimer) {
              clearTimeout(p.graceTimer);
              p.graceTimer = undefined;
            }
          });
          socket.to(room.code).emit('opponentLeft');
          deleteRoom(room.code);
        } else {
          // 후공 이탈 → 방장만 남기고 대기 상태로. 방장 클라는 opponentLeft를 '대기 복귀'로 처리.
          resetDuelToWaiting(room);
          socket.to(room.code).emit('opponentLeft');
        }
      }
    }
    if (data.code) socket.leave(data.code);
    data.code = undefined;
    data.index = undefined;
    if (typeof ack === 'function') ack();
  });

  socket.on('disconnect', () => {
    const room = getRoom(data.code);
    if (!room || data.index == null) return;
    const idx = data.index;
    const me = room.players[idx];
    if (!me || me.id !== socket.id) return;
    me.connected = false;

    if (room.mode === 'speed') {
      broadcastSpeedRoster(room);
      broadcastSpeedProgress(room);
      me.graceTimer = setTimeout(() => {
        if (getRoom(room.code) !== room) return;
        me.graceTimer = undefined;
        if (me.connected) return; // 재접속함
        me.gone = true;
        if (activeCount(room) === 0) {
          deleteRoom(room.code);
          return;
        }
        broadcastSpeedRoster(room);
        broadcastSpeedProgress(room);
        maybeEndSpeed(room);
      }, GRACE_MS);
      return;
    }

    // 턴제 — 유예 후에도 안 돌아오면: 방장이면 방 종료, 후공이면 방장은 대기 유지.
    io.to(room.code).emit('opponentDisconnected');
    me.graceTimer = setTimeout(() => {
      if (getRoom(room.code) !== room) return;
      me.graceTimer = undefined;
      if (me.connected) return; // 재접속함
      if (idx === 0 || room.players.length <= 1) {
        io.to(room.code).emit('opponentLeft');
        deleteRoom(room.code);
      } else {
        resetDuelToWaiting(room);
        io.to(room.code).emit('opponentLeft');
      }
    }, GRACE_MS);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[number-baseball] online server listening on :${PORT}`);
});
