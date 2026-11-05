import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Player } from './player.schema';
import { PlayersService } from './players.service';
import { AuthService } from '../auth/auth.service';

describe('PlayersService', () => {
  let service: PlayersService;
  let deleteOne: jest.Mock;
  let findById: jest.Mock;
  let hasMemberForPlayer: jest.Mock;
  let player: {
    _id: { toString: () => string };
    name: string;
    position: string;
    ratings: Array<{
      evaluatorName: string;
      evaluatorUserId?: string;
      stats: Record<string, number>;
      createdAt: Date;
    }>;
    save: jest.Mock;
  };

  beforeEach(async () => {
    deleteOne = jest.fn();
    findById = jest.fn();
    hasMemberForPlayer = jest.fn().mockResolvedValue(false);
    player = {
      _id: { toString: () => 'player-id' },
      name: 'Jamie Chen',
      position: 'Ala',
      ratings: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayersService,
        {
          provide: getModelToken(Player.name),
          useValue: { deleteOne, findById },
        },
        {
          provide: AuthService,
          useValue: { hasMemberForPlayer },
        },
      ],
    }).compile();

    service = module.get<PlayersService>(PlayersService);
  });

  it('deletes the player by id', async () => {
    const exec = jest.fn().mockResolvedValue({ deletedCount: 1 });
    deleteOne.mockReturnValue({ exec });

    await expect(service.remove('player-id')).resolves.toBeUndefined();
    expect(deleteOne).toHaveBeenCalledWith({ _id: 'player-id' });
    expect(exec).toHaveBeenCalled();
  });

  it('reports when the player does not exist', async () => {
    deleteOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    });
    await expect(service.remove('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('requires removing a linked member account before deleting its player', async () => {
    hasMemberForPlayer.mockResolvedValue(true);

    await expect(service.remove('player-id')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(deleteOne).not.toHaveBeenCalled();
  });

  it('attributes a rating to the signed-in member and updates their existing rating', async () => {
    findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(player),
    });
    const evaluator = {
      sub: 'member-id',
      username: 'jamie',
      role: 'member' as const,
      playerId: 'another-player-id',
    };
    const firstStats = {
      dribbling: 5,
      speed: 6,
      shooting: 7,
      stamina: 8,
      passing: 9,
      defending: 4,
    };

    await service.addRating('player-id', { stats: firstStats }, evaluator);
    await service.addRating(
      'player-id',
      { stats: { ...firstStats, speed: 10 } },
      evaluator,
    );

    expect(player.ratings).toHaveLength(1);
    expect(player.ratings[0]).toMatchObject({
      evaluatorName: 'jamie',
      evaluatorUserId: 'member-id',
      stats: { ...firstStats, speed: 10 },
    });
    expect(player.save).toHaveBeenCalledTimes(2);
  });

  it('returns only the signed-in evaluator’s rating for a player', async () => {
    const ownStats = {
      dribbling: 5,
      speed: 6,
      shooting: 7,
      stamina: 8,
      passing: 9,
      defending: 4,
    };
    player.ratings = [
      {
        evaluatorName: 'jamie',
        evaluatorUserId: 'member-id',
        stats: ownStats,
        createdAt: new Date(),
      },
      {
        evaluatorName: 'other',
        evaluatorUserId: 'other-member-id',
        stats: { ...ownStats, speed: 1 },
        createdAt: new Date(),
      },
    ];
    findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(player),
    });

    await expect(
      service.findMyRating('player-id', {
        sub: 'member-id',
        username: 'jamie',
        role: 'member',
        playerId: 'another-player-id',
      }),
    ).resolves.toEqual(ownStats);
  });

  it('returns null when the signed-in evaluator has not rated the player', async () => {
    findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(player),
    });

    await expect(
      service.findMyRating('player-id', {
        sub: 'member-id',
        username: 'jamie',
        role: 'member',
        playerId: 'another-player-id',
      }),
    ).resolves.toBeNull();
  });

  it('prevents a member from rating their own linked player profile', async () => {
    findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(player),
    });
    await expect(
      service.addRating(
        'player-id',
        {
          stats: {
            dribbling: 5,
            speed: 5,
            shooting: 5,
            stamina: 5,
            passing: 5,
            defending: 5,
          },
        },
        {
          sub: 'member-id',
          username: 'jamie',
          role: 'member',
          playerId: 'player-id',
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(player.save).not.toHaveBeenCalled();
  });
});
