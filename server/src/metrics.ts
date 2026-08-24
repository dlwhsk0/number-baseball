// Prometheus 메트릭(prom-client). /metrics 로 노출.
//   - 카운터: 방 생성/입장, 게임 시작/종료, 추측 수(모드별)
//   - 게이지: 현재 활성 방·연결 소켓·방 인원(스크레이프 시점 계산)
//   - 기본: 프로세스 CPU/메모리/이벤트루프 지연 등(collectDefaultMetrics)
import client from 'prom-client';

export const register = new client.Registry();
register.setDefaultLabels({ app: 'number-baseball-server' });
client.collectDefaultMetrics({ register });

const c = (name: string, help: string, labelNames: string[] = []) =>
  new client.Counter({ name, help, labelNames, registers: [register] });

export const roomsCreated = c('nb_rooms_created_total', '생성된 방 수', ['mode']);
export const roomJoins = c('nb_room_joins_total', '방 입장(방장 제외) 수', ['mode']);
export const gamesStarted = c('nb_games_started_total', '시작된 게임 수', ['mode']);
export const gamesOver = c('nb_games_over_total', '종료된 게임 수', ['mode']);
export const guesses = c('nb_guesses_total', '접수된 추측 수', ['mode']);
export const connectionsTotal = c('nb_socket_connections_total', '소켓 연결(누적)');

/** 런타임 게이지 등록 — 스크레이프 시점에 현재 상태를 읽어 값 설정. */
export function registerRuntimeGauges(getters: {
  socketCount: () => number;
  roomStats: () => { rooms: { duel: number; speed: number }; players: number };
}): void {
  const sockets = new client.Gauge({
    name: 'nb_sockets_connected',
    help: '현재 연결된 소켓 수',
    registers: [register],
    collect() {
      sockets.set(getters.socketCount());
    },
  });
  const roomsActive = new client.Gauge({
    name: 'nb_rooms_active',
    help: '현재 활성 방 수(모드별)',
    labelNames: ['mode'],
    registers: [register],
    collect() {
      const s = getters.roomStats();
      roomsActive.set({ mode: 'duel' }, s.rooms.duel);
      roomsActive.set({ mode: 'speed' }, s.rooms.speed);
    },
  });
  const playersInRooms = new client.Gauge({
    name: 'nb_players_in_rooms',
    help: '현재 방에 있는 플레이어 수(안 나간 인원)',
    registers: [register],
    collect() {
      playersInRooms.set(getters.roomStats().players);
    },
  });
}
