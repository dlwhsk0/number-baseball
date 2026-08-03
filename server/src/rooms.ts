// 방(room) 상태 관리 — 메모리 저장(영속화 없음). 코드로 입장.
// 턴제(duel, 1:1) + 스피드(speed, 2~4명 동시 레이스) 두 모드.
// 재접속 지원: 끊겨도 방을 바로 안 지우고 토큰으로 재합류(rejoin).
import { randomBytes } from 'node:crypto';
import type { GuessRecord, Outcome, Mode, SpeedStanding } from './types.js';

export interface Player {
  id: string; // 현재 소켓 id(재접속하면 바뀜)
  nick: string;
  /** 턴제: 상대가 맞힐 비밀 숫자. 서버만 알고 종료 시 공개. */
  secret: string | null;
  /** 재접속 인증 토큰. */
  token: string;
  connected: boolean;
  /** 끊긴 뒤 유예 타이머(만료되면 방 정리/스피드는 이탈 처리). */
  graceTimer?: ReturnType<typeof setTimeout>;
  // --- 스피드 전용 ---
  solved: boolean;
  attempts: number;
  solveMs: number | null;
  history: GuessRecord[];
  /** 스피드: 완전히 나감(인덱스 유지 위해 splice 대신 제외 표시). */
  gone: boolean;
}

export type Phase = 'waiting' | 'secret' | 'playing' | 'over';

export interface Room {
  code: string;
  mode: Mode;
  digits: number;
  maxPlayers: number;
  players: Player[]; // 턴제: index 0=방장(선공), 1=후공. 스피드: 0~3.
  phase: Phase;
  // --- 턴제 전용 ---
  turn: 0 | 1;
  pending: boolean;
  histories: [GuessRecord[], GuessRecord[]];
  solved: [boolean, boolean];
  rematch: [boolean, boolean];
  lastOver?: { outcome: Outcome; secrets: (string | null)[]; attempts: number[] };
  // --- 스피드 전용 ---
  speedSecret: string | null;
  startedAt: number; // ms epoch, 0=미시작
}

const rooms = new Map<string, Room>();
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genCode(): string {
  let code = '';
  do {
    code = '';
    for (let i = 0; i < 4; i++) {
      code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
  } while (rooms.has(code));
  return code;
}

function genToken(): string {
  return randomBytes(12).toString('hex');
}

function newPlayer(id: string, nick: string): Player {
  return {
    id,
    nick,
    secret: null,
    token: genToken(),
    connected: true,
    solved: false,
    attempts: 0,
    solveMs: null,
    history: [],
    gone: false,
  };
}

export function createRoom(hostId: string, nick: string, digits: number, mode: Mode): Room {
  const room: Room = {
    code: genCode(),
    mode,
    digits,
    maxPlayers: mode === 'speed' ? 4 : 2,
    players: [newPlayer(hostId, nick)],
    phase: 'waiting',
    turn: 0,
    pending: false,
    histories: [[], []],
    solved: [false, false],
    rematch: [false, false],
    speedSecret: null,
    startedAt: 0,
  };
  rooms.set(room.code, room);
  return room;
}

export function joinRoom(
  code: string,
  id: string,
  nick: string,
): { room?: Room; index?: number; error?: string } {
  const room = rooms.get(code);
  if (!room) return { error: '방을 찾을 수 없어요. 코드를 확인해주세요.' };
  if (room.players.length >= room.maxPlayers) return { error: '방이 가득 찼어요.' };
  // 스피드는 시작 후 입장 불가.
  if (room.mode === 'speed' && room.phase !== 'waiting') return { error: '이미 시작한 방이에요.' };
  const index = room.players.length;
  room.players.push(newPlayer(id, nick));
  return { room, index };
}

export function getRoom(code: string | undefined): Room | undefined {
  return code ? rooms.get(code) : undefined;
}

/**
 * 턴제 방을 '방장만 남은 대기' 상태로 되돌린다(후공이 나갔을 때).
 * 방은 방장 소유 — 방장이 나가야 방이 사라지고, 후공이 나가면 방장은 새 상대를 계속 기다린다.
 */
export function resetDuelToWaiting(room: Room): void {
  // 방장(index 0)만 남기고 후공 제거.
  const extras = room.players.slice(1);
  extras.forEach((p) => p.graceTimer && clearTimeout(p.graceTimer));
  room.players = room.players.slice(0, 1);
  const host = room.players[0];
  if (host) host.secret = null;
  room.phase = 'waiting';
  room.turn = 0;
  room.pending = false;
  room.histories = [[], []];
  room.solved = [false, false];
  room.rematch = [false, false];
  room.lastOver = undefined;
}

export function deleteRoom(code: string): void {
  const room = rooms.get(code);
  room?.players.forEach((p) => p.graceTimer && clearTimeout(p.graceTimer));
  rooms.delete(code);
}

export function bothSecretsSet(room: Room): boolean {
  return room.players.length === 2 && room.players.every((p) => p.secret != null);
}

/** 스피드 리더보드 — 나간 사람 제외. 맞힌 사람(적은 횟수→빠른 시간) 먼저, 못 맞힌 사람은 시도 적은 순. */
export function speedStandings(room: Room): SpeedStanding[] {
  return room.players
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.gone)
    .map(({ p, i }) => ({
      index: i,
      nick: p.nick,
      attempts: p.attempts,
      solved: p.solved,
      solveMs: p.solveMs,
      connected: p.connected,
    }))
    .sort((a, b) => {
      if (a.solved !== b.solved) return a.solved ? -1 : 1;
      if (a.solved) {
        if (a.attempts !== b.attempts) return a.attempts - b.attempts;
        return (a.solveMs ?? 0) - (b.solveMs ?? 0);
      }
      return a.attempts - b.attempts;
    });
}

/** 로비/레이스 참가 중(안 나간) 인원 수. */
export function activeCount(room: Room): number {
  return room.players.filter((p) => !p.gone).length;
}

/** 남아있는 전원이 맞혔는지(스피드 종료 판정). 참가자 0이면 false. */
export function allSpeedSolved(room: Room): boolean {
  const active = room.players.filter((p) => !p.gone);
  return active.length > 0 && active.every((p) => p.solved);
}
