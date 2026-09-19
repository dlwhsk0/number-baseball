// 솔로 랭킹전·순위표 요청 — 공용 소켓의 ack 래퍼(연결 안 됐으면 붙고 보냄, 타임아웃 폴백).
import { getSocket } from './socket';
import type { RankedStartAck, RankedGuessAck, LeaderboardAck } from './protocol';

const NO_SERVER = '서버 응답이 없어요. 다시 시도해주세요.';

function request<T extends { ok: boolean; error?: string }>(
  send: (done: (r: T) => void) => void,
): Promise<T> {
  return new Promise((resolve) => {
    const s = getSocket();
    let finished = false;
    // 타임아웃 뒤 늦게 연결돼도 보내지 않는다(사용자가 실패로 본 추측·판이 서버에 남지 않게).
    const onConnect = () => {
      if (!finished) send(done);
    };
    const timer = window.setTimeout(() => done({ ok: false, error: NO_SERVER } as T), 8000);
    function done(r: T) {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      s.off('connect', onConnect);
      resolve(r);
    }
    if (s.connected) send(done);
    else {
      s.once('connect', onConnect);
      s.connect();
    }
  });
}

export function startRanked(p: {
  playerId: string;
  nick: string;
  team: string;
  digits: number;
  forfeit?: boolean;
}): Promise<RankedStartAck> {
  return request((done) => getSocket().emit('rankedStart', p, done));
}

export function guessRanked(gameId: string, guess: string): Promise<RankedGuessAck> {
  return request((done) => getSocket().emit('rankedGuess', { gameId, guess }, done));
}

export function fetchLeaderboard(playerId: string): Promise<LeaderboardAck> {
  return request((done) => getSocket().emit('leaderboard', { playerId }, done));
}
