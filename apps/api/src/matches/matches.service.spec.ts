import { BadRequestException, ConflictException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { PlayersService } from '../players/players.service';
import { GameMatch } from './match.schema';
import { MatchesService } from './matches.service';

describe('MatchesService', () => {
  let service: MatchesService;
  let matchModel: {
    create: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    aggregate: jest.Mock;
    findById: jest.Mock;
    updateOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
  };
  let playersService: { findByIds: jest.Mock; findAll: jest.Mock };

  const liveMatch = () => ({
    _id: { toString: () => 'match-id' },
    gameDate: new Date('2026-11-05T20:00:00.000Z'),
    status: 'live' as const,
    whites: {
      players: [{ playerId: 'player-1', playerName: 'Alex' }],
    },
    blacks: {
      players: [{ playerId: 'player-2', playerName: 'Sam' }],
    },
    goals: [],
    startedByUserId: 'member-id',
  });

  beforeEach(async () => {
    matchModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      aggregate: jest.fn(),
      findById: jest.fn(),
      updateOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };
    playersService = { findByIds: jest.fn(), findAll: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        { provide: getModelToken(GameMatch.name), useValue: matchModel },
        { provide: PlayersService, useValue: playersService },
      ],
    }).compile();
    service = module.get<MatchesService>(MatchesService);
  });

  it('creates a live game with the canonical roster names', async () => {
    const match = liveMatch();
    playersService.findByIds.mockResolvedValue([
      { id: 'player-1', name: 'Alex' }, { id: 'player-2', name: 'Sam' },
      { id: 'player-3', name: 'Chris' }, { id: 'player-4', name: 'Lee' },
      { id: 'player-5', name: 'Taylor' }, { id: 'player-6', name: 'Jordan' },
      { id: 'player-7', name: 'Morgan' }, { id: 'player-8', name: 'Riley' },
    ]);
    matchModel.create.mockResolvedValue(match);

    await service.create(
      {
        whites: ['player-1', 'player-3', 'player-4', 'player-5'],
        blacks: ['player-2', 'player-6', 'player-7', 'player-8'],
      },
      { sub: 'member-id', username: 'alex', role: 'member' },
    );

    expect(matchModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'live',
        whites: { players: expect.arrayContaining([
          { playerId: 'player-1', playerName: 'Alex' },
        ]) },
        blacks: { players: expect.arrayContaining([
          { playerId: 'player-2', playerName: 'Sam' },
        ]) },
        startedByUserId: 'member-id',
      }),
    );
  });

  it('rejects a player assigned to both teams', async () => {
    await expect(
      service.create(
        {
          whites: ['player-1', 'player-2', 'player-3', 'player-4'],
          blacks: ['player-1', 'player-5', 'player-6', 'player-7'],
        },
        { sub: 'member-id', username: 'alex', role: 'member' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(playersService.findByIds).not.toHaveBeenCalled();
  });

  it('saves a goal with the scorer and the signed-in user', async () => {
    const before = liveMatch();
    const after = liveMatch();
    after.goals = [{
      _id: { toString: () => 'goal-id' },
      team: 'whites',
      playerId: 'player-1',
      playerName: 'Alex',
      scoredAt: new Date('2026-11-05T20:05:00.000Z'),
      scoredByUserId: 'member-id',
    }] as never;
    matchModel.findById
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(before) })
      .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(after) });
    matchModel.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });

    const result = await service.addGoal(
      'match-id',
      { team: 'whites', playerId: 'player-1' },
      { sub: 'member-id', username: 'alex', role: 'member' },
    );

    expect(matchModel.updateOne).toHaveBeenCalledWith(
      { _id: 'match-id', status: 'live' },
      { $push: { goals: expect.objectContaining({
        team: 'whites',
        playerId: 'player-1',
        playerName: 'Alex',
        scoredByUserId: 'member-id',
      }) } },
    );
    expect(result.goals).toHaveLength(1);
    expect(result.goals[0].id).toBe('goal-id');
  });

  it('rejects a scorer who is not on the selected side', async () => {
    matchModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(liveMatch()),
    });

    await expect(
      service.addGoal(
        'match-id',
        { team: 'whites', playerId: 'player-2' },
        { sub: 'member-id', username: 'alex', role: 'member' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(matchModel.updateOne).not.toHaveBeenCalled();
  });

  it('marks a live game complete with a finish timestamp', async () => {
    const completed = {
      ...liveMatch(),
      status: 'completed' as const,
      finishedAt: new Date('2026-11-05T21:00:00.000Z'),
    };
    matchModel.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(completed),
    });

    const result = await service.finish('match-id');

    expect(matchModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'match-id', status: 'live' },
      { $set: { status: 'completed', finishedAt: expect.any(Date) } },
      { new: true },
    );
    expect(result.status).toBe('completed');
    expect(result.finishedAt).toEqual(completed.finishedAt);
  });

  it('includes zero-goal roster players in all-time goal statistics', async () => {
    matchModel.aggregate.mockReturnValue({
      exec: jest.fn().mockResolvedValue([
        { _id: 'player-1', playerName: 'Alex', goals: 2 },
      ]),
    });
    playersService.findAll.mockResolvedValue([
      { id: 'player-1', name: 'Alex' },
      { id: 'player-2', name: 'Sam' },
    ]);

    await expect(service.findGoalLeaders()).resolves.toEqual([
      { playerId: 'player-1', playerName: 'Alex', goals: 2 },
      { playerId: 'player-2', playerName: 'Sam', goals: 0 },
    ]);
  });

  it('rejects a second live game when one already exists', async () => {
    playersService.findByIds.mockResolvedValue(
      Array.from({ length: 8 }, (_, index) => ({
        id: `player-${index + 1}`,
        name: `Player ${index + 1}`,
      })),
    );
    matchModel.create.mockRejectedValue({ code: 11000 });

    await expect(
      service.create(
        {
          whites: ['player-1', 'player-2', 'player-3', 'player-4'],
          blacks: ['player-5', 'player-6', 'player-7', 'player-8'],
        },
        { sub: 'member-id', username: 'alex', role: 'member' },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
