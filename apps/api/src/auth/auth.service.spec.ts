import { compare } from 'bcryptjs';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Player } from '../players/player.schema';
import { AuthService } from './auth.service';
import { User, UserRole } from './user.schema';

describe('AuthService', () => {
  function createService() {
    const userModel = {
      exists: jest.fn(),
      create: jest.fn(),
      findOne: jest.fn(),
      findById: jest.fn(),
      findOneAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
    } as unknown as Model<User>;
    const playerModel = {
      exists: jest.fn(),
    } as unknown as Model<Player>;
    const jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-session'),
    } as unknown as JwtService;
    const configService = {
      get: jest.fn(),
    } as unknown as ConfigService;
    return {
      service: new AuthService(
        userModel,
        playerModel,
        jwtService,
        configService,
      ),
      userModel,
      playerModel,
      jwtService,
      configService,
    };
  }

  it('creates a linked member with a random password and stores only its hash', async () => {
    const { service, userModel, playerModel } = createService();
    const createdUser = {
      _id: { toString: () => 'user-id' },
      username: 'jamie',
      role: UserRole.MEMBER,
      playerId: { toString: () => 'player-id' },
    };
    (userModel.exists as jest.Mock).mockResolvedValue(null);
    (playerModel.exists as jest.Mock).mockResolvedValue({ _id: 'player-id' });
    (userModel.create as jest.Mock).mockImplementation(
      (account) => createdUser,
    );

    const result = await service.createMember({
      username: ' Jamie ',
      playerId: 'player-id',
    });

    expect(result.user).toEqual({
      id: 'user-id',
      username: 'jamie',
      role: UserRole.MEMBER,
      playerId: 'player-id',
    });
    expect(result.temporaryPassword).toMatch(/^[A-Za-z0-9_-]{24}$/);
    const storedAccount = (userModel.create as jest.Mock).mock.calls[0][0];
    expect(storedAccount.passwordHash).not.toBe(result.temporaryPassword);
    expect(
      await compare(result.temporaryPassword, storedAccount.passwordHash),
    ).toBe(true);
    expect(storedAccount.role).toBe(UserRole.MEMBER);
  });

  it('does not create another account for an existing username or player', async () => {
    const { service, userModel, playerModel } = createService();
    (userModel.exists as jest.Mock).mockResolvedValue({ _id: 'existing' });

    await expect(
      service.createMember({
        username: 'jamie',
        playerId: 'player-id',
      }),
    ).rejects.toThrow('That username is already in use.');
    expect(playerModel.exists).not.toHaveBeenCalled();
    expect(userModel.create).not.toHaveBeenCalled();
  });

  it('promotes a linked player account to administrator', async () => {
    const { service, userModel } = createService();
    const target = {
      _id: { toString: () => 'user-id' },
      username: 'jamie',
      role: UserRole.MEMBER,
      playerId: { toString: () => 'player-id' },
    };
    const updated = { ...target, role: UserRole.ADMIN };
    (userModel.findById as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(target),
    });
    (userModel.findOneAndUpdate as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(updated),
    });

    await expect(
      service.updateMemberRole('user-id', UserRole.ADMIN, {
        sub: 'other-admin',
        username: 'admin',
        role: UserRole.ADMIN,
      }),
    ).resolves.toEqual({
      id: 'user-id',
      username: 'jamie',
      role: UserRole.ADMIN,
      playerId: 'player-id',
    });
    expect(userModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'user-id', role: UserRole.MEMBER, playerId: { $exists: true } },
      { $set: { role: UserRole.ADMIN } },
      { new: true },
    );
  });

  it('demotes an administrator when another administrator remains', async () => {
    const { service, userModel } = createService();
    const target = {
      _id: { toString: () => 'user-id' },
      username: 'jamie',
      role: UserRole.ADMIN,
      playerId: { toString: () => 'player-id' },
    };
    const updated = { ...target, role: UserRole.MEMBER };
    (userModel.findById as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(target),
    });
    (userModel.countDocuments as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(2),
    });
    (userModel.findOneAndUpdate as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(updated),
    });

    await expect(
      service.updateMemberRole('user-id', UserRole.MEMBER, {
        sub: 'other-admin',
        username: 'admin',
        role: UserRole.ADMIN,
      }),
    ).resolves.toMatchObject({ role: UserRole.MEMBER });
  });

  it('does not allow demoting the last administrator', async () => {
    const { service, userModel } = createService();
    (userModel.findById as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: { toString: () => 'user-id' },
        username: 'jamie',
        role: UserRole.ADMIN,
        playerId: { toString: () => 'player-id' },
      }),
    });
    (userModel.countDocuments as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue(1),
    });

    await expect(
      service.updateMemberRole('user-id', UserRole.MEMBER, {
        sub: 'other-admin',
        username: 'admin',
        role: UserRole.ADMIN,
      }),
    ).rejects.toThrow('At least one administrator must remain.');
    expect(userModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not allow administrators to demote themselves', async () => {
    const { service, userModel } = createService();
    (userModel.findById as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: { toString: () => 'admin-id' },
        username: 'admin',
        role: UserRole.ADMIN,
        playerId: { toString: () => 'player-id' },
      }),
    });

    await expect(
      service.updateMemberRole('admin-id', UserRole.MEMBER, {
        sub: 'admin-id',
        username: 'admin',
        role: UserRole.ADMIN,
      }),
    ).rejects.toThrow('You cannot remove your own administrator access.');
    expect(userModel.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('creates the initial administrator only when one does not already exist', async () => {
    const { service, userModel, configService } = createService();
    const findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    (userModel as unknown as { findOne: jest.Mock }).findOne = findOne;
    (userModel.create as jest.Mock).mockResolvedValue({});
    (configService.get as jest.Mock).mockImplementation(
      (key: string) =>
        ({
          JWT_SECRET: 's'.repeat(48),
          ADMIN_USERNAME: 'League-Admin',
          ADMIN_PASSWORD: 'a secure initial password',
        })[key],
    );

    await service.onModuleInit();

    expect(findOne).toHaveBeenCalledWith({ username: 'league-admin' });
    expect(userModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        username: 'league-admin',
        role: UserRole.ADMIN,
      }),
    );
    const passwordHash = (userModel.create as jest.Mock).mock.calls[0][0]
      .passwordHash;
    expect(passwordHash).not.toBe('a secure initial password');
    expect(await compare('a secure initial password', passwordHash)).toBe(true);
  });

  it('does not reset an existing administrator from bootstrap environment values', async () => {
    const { service, userModel, configService } = createService();
    const existingAdmin = { role: UserRole.ADMIN };
    const findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(existingAdmin),
    });
    (userModel as unknown as { findOne: jest.Mock }).findOne = findOne;
    (configService.get as jest.Mock).mockImplementation(
      (key: string) =>
        ({
          JWT_SECRET: 's'.repeat(48),
          ADMIN_USERNAME: 'league-admin',
          ADMIN_PASSWORD: 'a different bootstrap password',
        })[key],
    );

    await service.onModuleInit();

    expect(userModel.create).not.toHaveBeenCalled();
  });
});
