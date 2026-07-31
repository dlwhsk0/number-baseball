// 숫자 야구 게임 로직 — 순수 함수. 프론트 src/game/logic.ts를 그대로 옮긴 것.
// (규칙이 바뀌면 양쪽을 함께 수정한다. 서버가 정답을 쥐고 판정하므로 이 로직이 권위를 가진다.)

export const DIGITS = 3;

export interface Judgement {
  strikes: number;
  balls: number;
  isOut: boolean;
}

/** 서로 다른 digits자리 숫자 생성(각 자리 0~9, 중복 없음, 맨 앞 0 아님). */
export function generateSecret(digits: number = DIGITS, rng: () => number = Math.random): string {
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked = pool.slice(0, digits);
  if (picked[0] === 0) {
    const swapIndex = picked.findIndex((d, i) => i > 0 && d !== 0);
    [picked[0], picked[swapIndex]] = [picked[swapIndex], picked[0]];
  }
  return picked.join('');
}

/** 추측/비밀 숫자가 규칙에 맞는지(digits자리, 숫자만, 중복 없음, 맨 앞 0 아님). */
export function isValidGuess(guess: string, digits: number = DIGITS): boolean {
  if (!new RegExp(`^[0-9]{${digits}}$`).test(guess)) return false;
  if (guess[0] === '0') return false;
  return new Set(guess).size === digits;
}

/** 정답과 추측을 비교해 스트라이크/볼/아웃 판정. */
export function judge(secret: string, guess: string): Judgement {
  let strikes = 0;
  let balls = 0;
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) strikes++;
    else if (secret.includes(guess[i])) balls++;
  }
  return { strikes, balls, isOut: strikes === 0 && balls === 0 };
}

/** 모든 자리가 스트라이크면 승리. */
export function isWin(judgement: Judgement, digits: number = DIGITS): boolean {
  return judgement.strikes === digits;
}
