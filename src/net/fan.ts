// 팬 랭킹 신원: 익명 기기 id(uuid) + 응원 구단. 로그인 없이 기기(localStorage)에 묶인다.
import { isTeamId } from '../game/teams';

const ID_KEY = 'nb_player_id';
const TEAM_KEY = 'nb_team';

function uuid(): string {
  // randomUUID는 보안 컨텍스트(https·localhost)에서만 — LAN 미리보기 등은 폴백(RFC4122 v4 형태).
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

let memId: string | null = null;
/** 이 기기의 플레이어 id(없으면 생성해 저장). */
export function getPlayerId(): string {
  try {
    const s = localStorage.getItem(ID_KEY);
    if (s) return s;
    const id = uuid();
    localStorage.setItem(ID_KEY, id);
    return id;
  } catch {
    memId ??= uuid();
    return memId;
  }
}

/** 응원 구단 id(미선택이면 null). */
export function getTeam(): string | null {
  try {
    const t = localStorage.getItem(TEAM_KEY);
    return isTeamId(t) ? t : null;
  } catch {
    return null;
  }
}

export function saveTeam(team: string): void {
  try {
    localStorage.setItem(TEAM_KEY, team);
  } catch {
    /* 저장 불가 무시 */
  }
}

/** 방 만들기/입장에 함께 보내는 신원. 구단이 없으면 구단 대결 기록에서 빠진다. */
export function fanIdentity(): { playerId: string; team?: string } {
  const team = getTeam();
  return team ? { playerId: getPlayerId(), team } : { playerId: getPlayerId() };
}
