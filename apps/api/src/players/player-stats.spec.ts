import {
  balancePlayers,
  calculateMedianStats,
  RatedPlayer,
  SKILLS,
} from './player-stats';

describe('player stats', () => {
  it('calculates the median independently for each skill', () => {
    const stats = calculateMedianStats([
      {
        stats: {
          dribbling: 2,
          speed: 4,
          shooting: 6,
          stamina: 8,
          passing: 1,
          defending: 3,
        },
      },
      {
        stats: {
          dribbling: 8,
          speed: 6,
          shooting: 4,
          stamina: 2,
          passing: 9,
          defending: 7,
        },
      },
      {
        stats: {
          dribbling: 5,
          speed: 8,
          shooting: 2,
          stamina: 6,
          passing: 5,
          defending: 5,
        },
      },
      {
        stats: {
          dribbling: 7,
          speed: 2,
          shooting: 8,
          stamina: 4,
          passing: 3,
          defending: 9,
        },
      },
    ]);

    expect(stats).toEqual({
      dribbling: 6,
      speed: 5,
      shooting: 5,
      stamina: 5,
      passing: 4,
      defending: 6,
    });
    expect(calculateMedianStats([])).toEqual({
      dribbling: null,
      speed: null,
      shooting: null,
      stamina: null,
      passing: null,
      defending: null,
    });
  });

  it.each([8, 10])(
    'creates balanced teams for %i players with every player exactly once',
    (count) => {
      const players: RatedPlayer[] = Array.from(
        { length: count },
        (_, index) => {
          const value = index + 1;
          return {
            id: `${value}`,
            name: `Player ${value}`,
            position: 'Ala',
            ratingCount: 2,
            stats: Object.fromEntries(
              SKILLS.map((skill) => [skill, value]),
            ) as RatedPlayer['stats'],
          };
        },
      );

      const result = balancePlayers(players);

      expect(result.teams[0].players).toHaveLength(count / 2);
      expect(result.teams[1].players).toHaveLength(count / 2);
      expect([
        ...result.teams[0].players,
        ...result.teams[1].players,
      ]).toHaveLength(count);
      expect(result.balanceGap).toBeCloseTo(count === 8 ? 0 : 0.2);
    },
  );
});
