import { describe, it, expect } from 'vitest';
import { generateSecret, isValidGuess, judge, isWin, DIGITS } from './logic';

/** 0..1 사이 값을 순서대로 뱉는 결정적 난수 함수(테스트용). */
function seededRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('generateSecret', () => {
  it('세 자리, 서로 다른 숫자, 맨 앞 0 아님 — 1000회 반복 검증', () => {
    for (let n = 0; n < 1000; n++) {
      const secret = generateSecret();
      expect(secret).toHaveLength(DIGITS);
      expect(/^[0-9]{3}$/.test(secret)).toBe(true);
      expect(secret[0]).not.toBe('0');
      expect(new Set(secret).size).toBe(DIGITS);
    }
  });

  it('맨 앞이 0으로 뽑히면 뒤의 0 아닌 자리와 교환한다', () => {
    // 셔플이 항상 index 0을 고르도록 rng=0 → pool 순서 유지 → [0,1,2]
    const secret = generateSecret(DIGITS, seededRng([0]));
    expect(secret[0]).not.toBe('0');
    expect(new Set(secret).size).toBe(DIGITS);
  });

  it('고급(4자리)도 서로 다른 숫자, 맨 앞 0 아님', () => {
    for (let n = 0; n < 500; n++) {
      const secret = generateSecret(4);
      expect(secret).toHaveLength(4);
      expect(secret[0]).not.toBe('0');
      expect(new Set(secret).size).toBe(4);
    }
  });
});

describe('isValidGuess', () => {
  it('유효한 추측', () => {
    expect(isValidGuess('123')).toBe(true);
    expect(isValidGuess('102')).toBe(true);
    expect(isValidGuess('987')).toBe(true);
  });

  it('무효한 추측', () => {
    expect(isValidGuess('012')).toBe(false); // 맨 앞 0
    expect(isValidGuess('112')).toBe(false); // 중복
    expect(isValidGuess('12')).toBe(false); // 길이
    expect(isValidGuess('1234')).toBe(false); // 길이
    expect(isValidGuess('12a')).toBe(false); // 숫자 아님
    expect(isValidGuess('')).toBe(false);
  });

  it('고급(4자리) 검사', () => {
    expect(isValidGuess('1234', 4)).toBe(true);
    expect(isValidGuess('123', 4)).toBe(false); // 길이
    expect(isValidGuess('1123', 4)).toBe(false); // 중복
    expect(isValidGuess('0123', 4)).toBe(false); // 맨 앞 0
  });
});

describe('judge', () => {
  it('3 스트라이크', () => {
    expect(judge('123', '123')).toEqual({ strikes: 3, balls: 0, isOut: false });
  });

  it('스트라이크 + 볼 혼합', () => {
    // 1: 스트라이크(위치0), 3: 볼(정답 위치2), 5: 없음
    expect(judge('123', '135')).toEqual({ strikes: 1, balls: 1, isOut: false });
  });

  it('전부 볼(자리만 다름)', () => {
    expect(judge('123', '312')).toEqual({ strikes: 0, balls: 3, isOut: false });
  });

  it('아웃', () => {
    expect(judge('123', '456')).toEqual({ strikes: 0, balls: 0, isOut: true });
  });
});

describe('judge — 4자리', () => {
  it('4 스트라이크', () => {
    expect(judge('1234', '1234')).toEqual({ strikes: 4, balls: 0, isOut: false });
  });
  it('스트라이크 + 볼', () => {
    // 1:S(0) 2:S(1) 4:볼(정답 위치3) 9:없음
    expect(judge('1234', '1249')).toEqual({ strikes: 2, balls: 1, isOut: false });
  });
});

describe('isWin', () => {
  it('3 스트라이크면 승리(기본)', () => {
    expect(isWin(judge('123', '123'))).toBe(true);
    expect(isWin(judge('123', '132'))).toBe(false);
  });
  it('4자리는 4 스트라이크라야 승리', () => {
    expect(isWin(judge('1234', '1234'), 4)).toBe(true);
    expect(isWin(judge('1234', '1243'), 4)).toBe(false);
  });
});
