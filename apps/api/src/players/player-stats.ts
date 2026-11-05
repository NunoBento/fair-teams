export const SKILLS = [
  'dribbling',
  'speed',
  'shooting',
  'stamina',
  'passing',
  'defending',
] as const;
export type Skill = (typeof SKILLS)[number];
export type PlayerStats = Record<Skill, number>;
export type MedianPlayerStats = Record<Skill, number | null>;

export function calculateMedianStats(
  ratings: { stats: PlayerStats }[],
): MedianPlayerStats {
  return Object.fromEntries(
    SKILLS.map((skill) => {
      const values = ratings
        .map((rating) => rating.stats[skill])
        .sort((a, b) => a - b);
      if (!values.length) return [skill, null];
      const middle = Math.floor(values.length / 2);
      return [
        skill,
        values.length % 2
          ? values[middle]
          : (values[middle - 1] + values[middle]) / 2,
      ];
    }),
  ) as MedianPlayerStats;
}

export interface RatedPlayer {
  id: string;
  name: string;
  position: string;
  ratingCount: number;
  stats: MedianPlayerStats;
}

export interface BalancedTeams {
  teams: {
    name: 'Team A' | 'Team B';
    players: RatedPlayer[];
    average: number;
  }[];
  balanceGap: number;
}

export function balancePlayers(players: RatedPlayer[]): BalancedTeams {
  if (players.length !== 8 && players.length !== 10) {
    throw new Error('Team balancing requires exactly 8 or 10 players.');
  }
  if (
    players.some((player) =>
      SKILLS.some((skill) => player.stats[skill] === null),
    )
  ) {
    throw new Error(
      'Every player must have ratings for all skills before teams can be balanced.',
    );
  }

  const teamSize = players.length / 2;
  const best = {
    picks: null as number[] | null,
    cost: Number.POSITIVE_INFINITY,
    gap: Number.POSITIVE_INFINITY,
  };
  const average = (indexes: number[], skill: Skill): number =>
    indexes.reduce((sum, index) => sum + players[index].stats[skill]!, 0) /
    indexes.length;
  const overall = (indexes: number[]): number =>
    SKILLS.reduce((sum, skill) => sum + average(indexes, skill), 0) /
    SKILLS.length;

  const visit = (start: number, picks: number[]): void => {
    if (picks.length === teamSize) {
      if (!picks.includes(0)) return;
      const selected = new Set(picks);
      const other = players
        .map((_, index) => index)
        .filter((index) => !selected.has(index));
      const differences = SKILLS.map(
        (skill) => average(picks, skill) - average(other, skill),
      );
      const cost = differences.reduce(
        (sum, difference) => sum + difference ** 2,
        0,
      );
      const gap = Math.abs(overall(picks) - overall(other));
      if (cost < best.cost || (cost === best.cost && gap < best.gap)) {
        best.picks = [...picks];
        best.cost = cost;
        best.gap = gap;
      }
      return;
    }

    for (let index = start; index < players.length; index += 1) {
      visit(index + 1, [...picks, index]);
    }
  };
  visit(0, []);

  const selected = new Set(best.picks ?? []);
  const makeTeam = (indexes: number[], name: 'Team A' | 'Team B') => ({
    name,
    players: indexes.map((index) => players[index]),
    average: overall(indexes),
  });
  return {
    teams: [
      makeTeam([...selected], 'Team A'),
      makeTeam(
        players
          .map((_, index) => index)
          .filter((index) => !selected.has(index)),
        'Team B',
      ),
    ],
    balanceGap: best.gap,
  };
}
