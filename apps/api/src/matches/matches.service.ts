import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PlayersService } from '../players/players.service';
import { AddMatchGoalDto } from './dto/add-match-goal.dto';
import { CreateMatchDto } from './dto/create-match.dto';
import type { GameMatch, GameMatchDocument, MatchTeam } from './match.schema';
import { GameMatch as GameMatchModel } from './match.schema';

export interface MatchView {
  id: string;
  gameDate: Date;
  status: 'live' | 'completed';
  teams: {
    whites: GameMatch['whites'];
    blacks: GameMatch['blacks'];
  };
  goals: Array<{
    id: string;
    team: MatchTeam;
    playerId: string;
    playerName: string;
    scoredAt: Date;
  }>;
  finishedAt?: Date;
}

@Injectable()
export class MatchesService {
  constructor(
    @InjectModel(GameMatchModel.name)
    private readonly matchModel: Model<GameMatchModel>,
    private readonly playersService: PlayersService,
  ) {}

  async findActive(): Promise<MatchView | null> {
    const match = await this.matchModel.findOne({ status: 'live' }).exec();
    return match ? this.toView(match) : null;
  }

  async findRecent(): Promise<MatchView[]> {
    const matches = await this.matchModel
      .find({ status: 'completed' })
      .sort({ gameDate: -1 })
      .limit(20)
      .exec();
    return matches.map((match) => this.toView(match));
  }

  async findGoalLeaders(): Promise<Array<{
    playerId: string;
    playerName: string;
    goals: number;
    gamesPlayed: number;
    wins: number;
    losses: number;
  }>> {
    const [leaders, players, completedMatches] = await Promise.all([
      this.matchModel
        .aggregate([
          { $match: { status: 'completed' } },
          { $unwind: '$goals' },
          {
            $group: {
              _id: '$goals.playerId',
              playerName: { $last: '$goals.playerName' },
              goals: { $sum: 1 },
            },
          },
          { $sort: { goals: -1, playerName: 1 } },
        ])
        .exec(),
      this.playersService.findAll(),
      this.matchModel.find({ status: 'completed' }).select('whites blacks goals').exec(),
    ]);
    const goalsByPlayer = new Map<string, { playerName: string; goals: number }>(
      leaders.map((leader) => [
        leader._id,
        { playerName: leader.playerName, goals: leader.goals },
      ]),
    );
    for (const player of players) {
      if (!goalsByPlayer.has(player.id)) {
        goalsByPlayer.set(player.id, { playerName: player.name, goals: 0 });
      }
    }
    const recordsByPlayer = new Map<string, {
      playerName: string;
      gamesPlayed: number;
      wins: number;
      losses: number;
    }>();
    const recordTeam = (team: MatchTeam, roster: GameMatch['whites']['players'], whiteScore: number, blackScore: number) => {
      for (const player of roster) {
        const record = recordsByPlayer.get(player.playerId) ?? {
          playerName: player.playerName,
          gamesPlayed: 0,
          wins: 0,
          losses: 0,
        };
        record.gamesPlayed += 1;
        const won = team === 'whites' ? whiteScore > blackScore : blackScore > whiteScore;
        const lost = team === 'whites' ? whiteScore < blackScore : blackScore < whiteScore;
        if (won) record.wins += 1;
        if (lost) record.losses += 1;
        recordsByPlayer.set(player.playerId, record);
        if (!goalsByPlayer.has(player.playerId)) {
          goalsByPlayer.set(player.playerId, { playerName: player.playerName, goals: 0 });
        }
      }
    };
    for (const match of completedMatches) {
      const whiteScore = match.goals.filter((goal) => goal.team === 'whites').length;
      const blackScore = match.goals.length - whiteScore;
      recordTeam('whites', match.whites.players, whiteScore, blackScore);
      recordTeam('blacks', match.blacks.players, whiteScore, blackScore);
    }

    return [...goalsByPlayer].map(([playerId, leader]) => {
      const record = recordsByPlayer.get(playerId);
      return {
      playerId,
      playerName: record?.playerName ?? leader.playerName,
      goals: leader.goals,
      gamesPlayed: record?.gamesPlayed ?? 0,
      wins: record?.wins ?? 0,
      losses: record?.losses ?? 0,
      };
    }).sort((a, b) => b.goals - a.goals || a.playerName.localeCompare(b.playerName));
  }

  async create(dto: CreateMatchDto, user: AuthenticatedUser): Promise<MatchView> {
    if (
      ![4, 5].includes(dto.whites.length) ||
      dto.whites.length !== dto.blacks.length
    ) {
      throw new BadRequestException(
        'Each team must have the same number of players: 4 or 5.',
      );
    }
    const playerIds = [...dto.whites, ...dto.blacks];
    if (new Set(playerIds).size !== playerIds.length) {
      throw new BadRequestException(
        'A player cannot be assigned to both teams.',
      );
    }
    const players = await this.playersService.findByIds(playerIds);
    if (players.length !== playerIds.length) {
      throw new NotFoundException(
        'One or more selected players could not be found.',
      );
    }
    const playersById = new Map(players.map((player) => [player.id, player]));
    const side = (ids: string[]) => ({
      players: ids.map((playerId) => {
        const player = playersById.get(playerId);
        if (!player) {
          throw new NotFoundException('A selected player could not be found.');
        }
        return { playerId, playerName: player.name };
      }),
    });

    try {
      const match = await this.matchModel.create({
        gameDate: new Date(),
        status: 'live',
        whites: side(dto.whites),
        blacks: side(dto.blacks),
        goals: [],
        startedByUserId: user.sub,
      });
      return this.toView(match);
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('There is already a live game.');
      }
      throw error;
    }
  }

  async addGoal(
    id: string,
    dto: AddMatchGoalDto,
    user: AuthenticatedUser,
  ): Promise<MatchView> {
    const match = await this.matchModel.findById(id).exec();
    if (!match) throw new NotFoundException('Game not found.');
    if (match.status !== 'live') {
      throw new ConflictException('This game has already finished.');
    }
    const player = match[dto.team].players.find(
      (candidate) => candidate.playerId === dto.playerId,
    );
    if (!player) {
      throw new BadRequestException(
        'The selected player is not on that team.',
      );
    }

    const result = await this.matchModel
      .updateOne(
        { _id: id, status: 'live' },
        {
          $push: {
            goals: {
              team: dto.team,
              playerId: player.playerId,
              playerName: player.playerName,
              scoredAt: new Date(),
              scoredByUserId: user.sub,
            },
          },
        },
      )
      .exec();
    if (!result.modifiedCount) {
      throw new ConflictException('This game has already finished.');
    }

    const updated = await this.matchModel.findById(id).exec();
    if (!updated) throw new NotFoundException('Game not found.');
    return this.toView(updated);
  }

  async undoLatestGoal(id: string): Promise<MatchView> {
    const match = await this.matchModel.findById(id).exec();
    if (!match) throw new NotFoundException('Game not found.');
    if (match.status !== 'live') {
      throw new ConflictException('This game has already finished.');
    }
    const lastGoal = match.goals[match.goals.length - 1];
    if (!lastGoal) throw new BadRequestException('There are no goals to undo.');

    const updated = await this.matchModel
      .findOneAndUpdate(
        {
          _id: id,
          status: 'live',
          'goals._id': lastGoal._id,
          goals: { $size: match.goals.length },
        },
        { $pull: { goals: { _id: lastGoal._id } } },
        { new: true },
      )
      .exec();
    if (updated) return this.toView(updated);

    const current = await this.matchModel.findById(id).exec();
    if (!current) throw new NotFoundException('Game not found.');
    if (current.status !== 'live') {
      throw new ConflictException('This game has already finished.');
    }
    throw new ConflictException('The latest goal changed. Refresh and try again.');
  }

  async finish(id: string): Promise<MatchView> {
    const match = await this.matchModel
      .findOneAndUpdate(
        { _id: id, status: 'live' },
        { $set: { status: 'completed', finishedAt: new Date() } },
        { new: true },
      )
      .exec();
    if (match) return this.toView(match);

    const existing = await this.matchModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Game not found.');
    throw new ConflictException('This game has already finished.');
  }

  private toView(match: GameMatchDocument): MatchView {
    return {
      id: match._id.toString(),
      gameDate: match.gameDate,
      status: match.status,
      teams: {
        whites: match.whites,
        blacks: match.blacks,
      },
      goals: match.goals.map((goal) => ({
        id: goal._id.toString(),
        team: goal.team,
        playerId: goal.playerId,
        playerName: goal.playerName,
        scoredAt: goal.scoredAt,
      })),
      finishedAt: match.finishedAt,
    };
  }

  private isDuplicateKeyError(error: unknown): error is { code: number } {
    return typeof error === 'object' && error !== null && 'code' in error &&
      error.code === 11000;
  }
}
