import { describe, it, expect } from 'vitest';
import { soloPoints, pairMatches, winPct, gamesBehind } from './ranking';

describe('soloPoints — 적게 시도할수록 높은 점수', () => {
  it('1회=10점 … 10회=1점', () => {
    expect(soloPoints(1, true, 3)).toBe(10);
    expect(soloPoints(10, true, 3)).toBe(1);
    expect(soloPoints(4, true, 3)).toBe(7);
  });
  it('4자리는 2배', () => {
    expect(soloPoints(4, true, 4)).toBe(14);
  });
  it('실패·범위 밖은 0점', () => {
    expect(soloPoints(10, false, 3)).toBe(0);
    expect(soloPoints(0, true, 3)).toBe(0);
    expect(soloPoints(11, true, 3)).toBe(0);
  });
});

describe('pairMatches — 스피드 순위를 구단 대결로', () => {
  const e = (playerId: string, team: string | null, solved = true) => ({ playerId, team, solved });

  it('구단이 다른 모든 쌍: 상위=승', () => {
    const rows = pairMatches([e('a', 'lg'), e('b', 'kia'), e('c', 'nc')]);
    expect(rows.map((r) => `${r.teamW}>${r.teamL}`)).toEqual(['lg>kia', 'lg>nc', 'kia>nc']);
    expect(rows.every((r) => !r.draw)).toBe(true);
  });
  it('같은 구단·구단 없음·같은 사람은 제외', () => {
    expect(pairMatches([e('a', 'lg'), e('b', 'lg')])).toEqual([]);
    expect(pairMatches([e('a', 'lg'), e('b', null)])).toEqual([]);
    expect(pairMatches([e('a', 'lg'), e('a', 'kia')])).toEqual([]);
  });
  it('둘 다 못 맞히면 무승부, 한쪽만 맞히면 승', () => {
    const [r1, r2, r3] = pairMatches([e('a', 'lg'), e('b', 'kia', false), e('c', 'nc', false)]);
    expect(r1.draw).toBe(false);
    expect(r2.draw).toBe(false);
    expect(r3.draw).toBe(true);
  });
});

describe('승률·게임차', () => {
  it('무승부 제외 승률', () => {
    expect(winPct(3, 1)).toBe(0.75);
    expect(winPct(0, 0)).toBe(0);
  });
  it('게임차 = ((1위승-승)+(패-1위패))/2', () => {
    expect(gamesBehind({ w: 10, l: 5 }, { w: 8, l: 6 })).toBe(1.5);
  });
});
