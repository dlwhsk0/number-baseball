import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from './protocol';

// 온라인 대결 서버 주소. 개발은 로컬(:3001) 기본, 배포는 VITE_SERVER_URL(wss://도메인)로 주입.
const SERVER_URL: string =
  (import.meta.env.VITE_SERVER_URL as string | undefined) || 'http://localhost:3001';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

/** 단일 소켓 인스턴스(자동 연결 꺼둠 — 온라인 화면 진입 시 connect). */
export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: false,
      transports: ['websocket'],
      reconnection: true,
    });
  }
  return socket;
}
