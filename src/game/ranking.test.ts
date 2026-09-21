import { describe, it, expect } from 'vitest';
import { soloPoints, pairMatches, winPct, gamesBehind, tieRanks, tierOf } from './ranking';

describe('soloPoints — 적게 시도할수록 높은 점수', () => {
  it('1회=15점 … 15회=1점', () => {
    expect(soloPoints(1, true, 3)).toBe(15);
    expect(soloPoints(15, true, 3)).toBe(1);
    expect(soloPoints(6, true, 3)).toBe(10);
  });
  it('4자리는 2배', () => {
    expect(soloPoints(6, true, 4)).toBe(20);
  });
  it('실패·범위 밖은 0점', () => {
    expect(soloPoints(15, false, 3)).toBe(0);
    expect(soloPoints(0, true, 3)).toBe(0);
    expect(soloPoints(16, true, 3)).toBe(0);
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

describe('tieRanks — 동순위', () => {
  const id = (n: number) => n;
  it('동점이면 같은 순위, 다음은 건너뛴다(1,1,3)', () => {
    expect(tieRanks([30, 30, 20, 10, 10, 10, 5], id)).toEqual([1, 1, 3, 4, 4, 4, 7]);
  });
  it('동률 없으면 1..n', () => {
    expect(tieRanks([3, 2, 1], id)).toEqual([1, 2, 3]);
  });
  it('승률은 기록이 달라도 같은 값이면 공동(1/2 = 2/4)', () => {
    expect(tieRanks([winPct(2, 2), winPct(1, 1)], id)).toEqual([1, 1]);
  });
  it('빈 목록', () => {
    expect(tieRanks([], id)).toEqual([]);
  });
});

describe('tierOf — 평균 점수 등급', () => {
  it('경계값은 위 등급', () => {
    expect(tierOf(12).id).toBe('mvp');
    expect(tierOf(10).id).toBe('allstar');
    expect(tierOf(8).id).toBe('starter');
    expect(tierOf(6).id).toBe('prospect');
  });
  it('경계 바로 아래는 아래 등급', () => {
    expect(tierOf(11.99).id).toBe('allstar');
    expect(tierOf(5.99).id).toBe('rookie');
  });
  it('0점(전부 실패)도 루키', () => {
    expect(tierOf(0).id).toBe('rookie');
  });
});
