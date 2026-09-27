// 개인 순위 닉네임 — 비워두면 구단·마스코트를 섞은 랜덤 닉네임(예: 두산곰27, 끝내기호랑이08)을 붙인다.
// 닉네임은 players 테이블에서 대소문자 무시 유일(db.ts `players_nick_uniq`).
import { randomInt } from 'node:crypto';
import { TEAM_IDS } from './teams.js';

export const NICK_MAX = 12;

/** 예전 기본값 — 사람 이름으로 쓰지 못하게 막고, 들어오면 '비워둠'으로 취급한다. */
export const LEGACY_DEFAULT_NICK = '플레이어';

/** 구단별 앞말(구단명·연고 구장)과 마스코트. */
const TEAM_WORDS: Record<string, { prefix: string[]; mascot: string[] }> = {
  kia: { prefix: ['기아', '광주', '챔필'], mascot: ['호랑이', '타이거'] },
  samsung: { prefix: ['삼성', '대구', '라팍'], mascot: ['사자', '라이온'] },
  lg: { prefix: ['엘지', '잠실'], mascot: ['쌍둥이', '트윈스'] },
  doosan: { prefix: ['두산', '잠실'], mascot: ['곰', '베어'] },
  kt: { prefix: ['케이티', '수원'], mascot: ['마법사', '위즈'] },
  ssg: { prefix: ['쓱', '인천', '문학'], mascot: ['랜더스', '상륙선'] },
  lotte: { prefix: ['롯데', '사직', '부산'], mascot: ['갈매기', '거인'] },
  hanwha: { prefix: ['한화', '대전', '보살'], mascot: ['독수리', '이글'] },
  nc: { prefix: ['엔씨', '창원', '마산'], mascot: ['공룡', '다이노'] },
  kiwoom: { prefix: ['키움', '고척'], mascot: ['영웅', '히어로'] },
};

/** 구단 무관 야구 앞말. */
const BASEBALL_WORDS = ['홈런', '끝내기', '역전', '필승', '무적', '에이스', '강철', '불꽃', '철벽', '도루왕', '만루', '번개', '직관', '응원단장'];

const pick = <T>(xs: readonly T[]): T => xs[randomInt(xs.length)];

/**
 * 랜덤 닉네임 한 개. 구단을 모르면 아무 구단이나.
 * `wide`면 숫자를 네 자리로 — 두 자리가 계속 겹칠 때(유일성 재시도) 쓴다.
 */
export function randomNick(team: string | null | undefined, wide = false): string {
  const words = TEAM_WORDS[team ?? ''] ?? TEAM_WORDS[pick(TEAM_IDS)];
  // 앞말은 구단 말 반·야구 말 반 — '두산곰', '홈런곰'이 고르게 섞이게.
  const prefix = randomInt(2) === 0 ? pick(words.prefix) : pick(BASEBALL_WORDS);
  const num = wide ? String(randomInt(1000, 10000)) : String(randomInt(10, 100));
  const base = `${prefix}${pick(words.mascot)}`;
  return `${base.slice(0, NICK_MAX - num.length)}${num}`;
}

/** 입력 정리: 앞뒤 공백 제거·길이 제한. 옛 기본값('플레이어')은 빈 값으로. */
export function cleanNick(nick: unknown): string {
  const n = String(nick ?? '').trim().slice(0, NICK_MAX);
  return n === LEGACY_DEFAULT_NICK ? '' : n;
}
