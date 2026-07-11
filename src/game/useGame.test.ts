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
    expect(s.slots).toEqual(['4', '5', '6']);
  });

  it('중복 숫자는 무시된다', () => {
    const s = type(start('123'), '454');
    expect(s.slots).toEqual(['4', '5', '']);
  });

  it('맨 앞 0은 무시된다', () => {
    const s = type(start('123'), '0');
    expect(s.slots).toEqual(['', '', '']);
    // 앞자리가 채워지면 이후 0은 허용
    expect(type(start('123'), '90').slots).toEqual(['9', '0', '']);
  });

  it('pop은 마지막으로 채운 칸을 지운다', () => {
    const s = gameReducer(type(start('123'), '456'), { type: 'pop' });
    expect(s.slots).toEqual(['4', '5', '']);
  });
});

describe('gameReducer — 칸 지우기(clearSlot)', () => {
  it('해당 칸만 제자리에서 비운다', () => {
    const s = gameReducer(type(start('123'), '456'), { type: 'clearSlot', index: 1 });
    expect(s.slots).toEqual(['4', '', '6']);
  });

  it('빈 칸을 누르면 아무 변화 없다', () => {
    const before = type(start('123'), '45'); // ['4','5','']
    const s = gameReducer(before, { type: 'clearSlot', index: 2 });
    expect(s).toBe(before);
  });

  it('가운데를 비운 뒤 입력하면 왼쪽 빈 칸부터 채운다', () => {
    let s = gameReducer(type(start('123'), '456'), { type: 'clearSlot', index: 1 }); // ['4','','6']
    s = gameReducer(s, { type: 'push', digit: '7' });
    expect(s.slots).toEqual(['4', '7', '6']);
  });

  it('첫 칸을 비운 뒤 0은 다시 막힌다', () => {
    let s = gameReducer(type(start('123'), '456'), { type: 'clearSlot', index: 0 }); // ['','5','6']
    s = gameReducer(s, { type: 'push', digit: '0' });
    expect(s.slots).toEqual(['', '5', '6']); // 맨 앞 0 거부
  });
});

describe('gameReducer — 제출', () => {
  it('세 자리가 아니면 제출되지 않는다', () => {
    const s = gameReducer(type(start('123'), '45'), { type: 'submit' });
    expect(s.guesses).toHaveLength(0);
    expect(s.slots).toEqual(['4', '5', '']);
  });

  it('빈 칸(구멍)이 있으면 제출되지 않는다', () => {
    const holed = gameReducer(type(start('123'), '456'), { type: 'clearSlot', index: 1 });
    const s = gameReducer(holed, { type: 'submit' });
    expect(s.guesses).toHaveLength(0);
  });

  it('제출하면 히스토리에 판정이 쌓이고 칸이 비워진다', () => {
    const s = gameReducer(type(start('123'), '135'), { type: 'submit' });
    expect(s.guesses).toHaveLength(1);
    expect(s.guesses[0]).toEqual({ guess: '135', judgement: { strikes: 1, balls: 1, isOut: false } });
    expect(s.slots).toEqual(['', '', '']);
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
    expect(s.slots).toEqual(['', '', '']);
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

describe('gameReducer — 메모', () => {
  it('메모는 기본→스트라이크→볼→아웃→기본 순으로 순환한다', () => {
    let s = start('123');
    expect(s.memo['7']).toBeUndefined();
    s = gameReducer(s, { type: 'memo', digit: '7' });
    expect(s.memo['7']).toBe('strike');
    s = gameReducer(s, { type: 'memo', digit: '7' });
    expect(s.memo['7']).toBe('ball');
    s = gameReducer(s, { type: 'memo', digit: '7' });
    expect(s.memo['7']).toBe('out');
    s = gameReducer(s, { type: 'memo', digit: '7' });
    expect(s.memo['7']).toBeUndefined();
  });

  it('숫자별로 독립적으로 표시된다', () => {
    let s = gameReducer(start('123'), { type: 'memo', digit: '0' }); // strike
    s = gameReducer(s, { type: 'memo', digit: '9' });
    s = gameReducer(s, { type: 'memo', digit: '9' }); // ball
    expect(s.memo).toEqual({ '0': 'strike', '9': 'ball' });
  });

  it('reset(새 게임)하면 메모가 초기화된다', () => {
    let s = gameReducer(start('123'), { type: 'memo', digit: '4' });
    s = gameReducer(s, { type: 'reset', secret: '567', maxAttempts: 10 });
    expect(s.memo).toEqual({});
  });

  it('게임이 끝나면 메모를 바꿀 수 없다', () => {
    let s = gameReducer(type(start('123'), '123'), { type: 'submit' }); // won
    s = gameReducer(s, { type: 'memo', digit: '5' });
    expect(s.memo['5']).toBeUndefined();
  });
});
