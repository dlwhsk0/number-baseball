import { describe, it, expect } from 'vitest';
import { initGame, gameReducer, type GameState } from './useGame';

function start(secret: string, maxAttempts = 10): GameState {
  return initGame(secret, maxAttempts);
}

function type(state: GameState, digits: string): GameState {
  return [...digits].reduce(
    (s, d) => gameReducer(s, { type: 'push', digit: d }),
    state,
  );
}

describe('gameReducer — 입력', () => {
  it('세 자리까지만 입력된다', () => {
    const s = type(start('123'), '4567');
    expect(s.input).toBe('456');
  });

  it('중복 숫자는 무시된다', () => {
    const s = type(start('123'), '454');
    expect(s.input).toBe('45');
  });

  it('맨 앞 0은 무시된다', () => {
    const s = type(start('123'), '0');
    expect(s.input).toBe('');
    // 앞자리가 채워지면 이후 0은 허용
    expect(type(start('123'), '90').input).toBe('90');
  });

  it('pop은 마지막 한 자리를 지운다', () => {
    const s = gameReducer(type(start('123'), '456'), { type: 'pop' });
    expect(s.input).toBe('45');
  });
});

describe('gameReducer — 제출', () => {
  it('세 자리가 아니면 제출되지 않는다', () => {
    const s = gameReducer(type(start('123'), '45'), { type: 'submit' });
    expect(s.guesses).toHaveLength(0);
    expect(s.input).toBe('45');
  });

  it('제출하면 히스토리에 판정이 쌓이고 입력이 비워진다', () => {
    const s = gameReducer(type(start('123'), '135'), { type: 'submit' });
    expect(s.guesses).toHaveLength(1);
    expect(s.guesses[0]).toEqual({ guess: '135', judgement: { strikes: 1, balls: 1, isOut: false } });
    expect(s.input).toBe('');
  });

  it('정답을 맞히면 status가 won', () => {
    const s = gameReducer(type(start('123'), '123'), { type: 'submit' });
    expect(s.status).toBe('won');
  });

  it('시도 횟수를 소진하면 status가 lost', () => {
    let s = start('123', 2);
    s = gameReducer(type(s, '456'), { type: 'submit' });
    expect(s.status).toBe('playing');
    s = gameReducer(type(s, '789'), { type: 'submit' });
    expect(s.status).toBe('lost');
  });

  it('게임이 끝나면 추가 입력/제출이 막힌다', () => {
    let s = gameReducer(type(start('123'), '123'), { type: 'submit' }); // won
    s = gameReducer(s, { type: 'push', digit: '4' });
    expect(s.input).toBe('');
  });
});

describe('gameReducer — reset', () => {
  it('reset은 새 정답으로 초기화한다', () => {
    let s = gameReducer(type(start('123'), '123'), { type: 'submit' });
    s = gameReducer(s, { type: 'reset', secret: '456', maxAttempts: 10 });
    expect(s).toEqual(initGame('456', 10));
    expect(s.status).toBe('playing');
  });
});
