// 숫자 야구 게임 로직 — UI에 의존하지 않는 순수 함수.

/** 기본 자릿수(초보/중급). 고급은 4자리. */
export const DIGITS = 3;

/** 한 번의 추측에 대한 판정 결과. */
export interface Judgement {
  /** 숫자와 위치가 모두 맞은 개수. */
  strikes: number;
  /** 숫자는 있으나 위치가 틀린 개수. */
  balls: number;
  /** 스트라이크도 볼도 없음. */
  isOut: boolean;
}

/**
 * 서로 다른 `digits`자리 숫자를 만든다.
 * - 각 자리는 0~9, 중복 없음
 * - 맨 앞자리는 0이 될 수 없음
 *
 * @param digits 자릿수(기본 3).
 * @param rng 0 이상 1 미만을 반환하는 난수 함수(테스트 시 주입 가능).
 */
export function generateSecret(
  digits: number = DIGITS,
  rng: () => number = Math.random,
): string {
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  // Fisher-Yates 셔플
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const picked = pool.slice(0, digits);

  // 맨 앞이 0이면 뒤쪽의 0이 아닌 자리와 교환한다.
  if (picked[0] === 0) {
    const swapIndex = picked.findIndex((d, i) => i > 0 && d !== 0);
    [picked[0], picked[swapIndex]] = [picked[swapIndex], picked[0]];
  }

  return picked.join('');
}

/**
 * 추측 문자열이 규칙에 맞는지 검사한다.
 * (`digits`자리, 숫자만, 중복 없음, 맨 앞 0 아님)
 */
export function isValidGuess(guess: string, digits: number = DIGITS): boolean {
  if (!new RegExp(`^[0-9]{${digits}}$`).test(guess)) return false;
  if (guess[0] === '0') return false;
  return new Set(guess).size === digits;
}

/**
 * 정답과 추측을 비교해 스트라이크/볼/아웃을 판정한다.
 * 두 인자는 같은 길이의 유효한 숫자 문자열이라고 가정한다.
 */
export function judge(secret: string, guess: string): Judgement {
  let strikes = 0;
  let balls = 0;

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === secret[i]) {
      strikes++;
    } else if (secret.includes(guess[i])) {
      balls++;
    }
  }

  return { strikes, balls, isOut: strikes === 0 && balls === 0 };
}

/** 정답을 맞혔는지 여부(모든 자리가 스트라이크). */
export function isWin(judgement: Judgement, digits: number = DIGITS): boolean {
  return judgement.strikes === digits;
}
