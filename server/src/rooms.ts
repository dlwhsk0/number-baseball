// 방(room) 상태 관리 — 메모리 저장(영속화 없음). 코드로 입장하는 1:1 턴제 대결.
import type { GuessRecord } from './types.js';

export interface Player {
  id: string;
  nick: string;
  /** 상대가 맞힐 비밀 숫자. 서버만 알고, 게임 종료 시에만 공개. */
  secret: string | null;
}

export type Phase = 'waiting' | 'secret' | 'playing' | 'over';

export interface Room {
  code: string;
  digits: number;
  players: Player[]; // index 0 = 방장(선공), 1 = 후공
  phase: Phase;
  turn: 0 | 1;
  /** 결과 발표 텀 동안 true — 이 사이 추측을 막는다. */
  pending: boolean;
  histories: [GuessRecord[], GuessRecord[]];
  solved: [boolean, boolean];
  rematch: [boolean, boolean];
}

const rooms = new Map<string, Room>();
// 헷갈리는 문자(0/O, 1/I) 제외한 코드 알파벳
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

export function createRoom(hostId: string, nick: string, digits: number): Room {
  const room: Room = {
    code: genCode(),
    digits,
    players: [{ id: hostId, nick, secret: null }],
    phase: 'waiting',
    turn: 0,
    pending: false,
    histories: [[], []],
    solved: [false, false],
    rematch: [false, false],
  };
  rooms.set(room.code, room);
  return room;
}

export function joinRoom(
  code: string,
  id: string,
  nick: string,
): { room?: Room; index?: 1; error?: string } {
  const room = rooms.get(code);
  if (!room) return { error: '방을 찾을 수 없어요. 코드를 확인해주세요.' };
  if (room.players.length >= 2) return { error: '방이 가득 찼어요.' };
  room.players.push({ id, nick, secret: null });
  return { room, index: 1 };
}

export function getRoom(code: string | undefined): Room | undefined {
  return code ? rooms.get(code) : undefined;
}

export function deleteRoom(code: string): void {
  rooms.delete(code);
}

export function bothSecretsSet(room: Room): boolean {
  return room.players.length === 2 && room.players.every((p) => p.secret != null);
}
