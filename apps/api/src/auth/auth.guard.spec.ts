import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { RolesGuard } from './roles.guard';
import { UserRole } from './user.schema';

describe('authorization guards', () => {
  it('rejects a request without a session cookie', async () => {
    const jwt = { verifyAsync: jest.fn() } as unknown as JwtService;
    const auth = { findUser: jest.fn() } as unknown as AuthService;
    const guard = new AuthGuard(jwt, auth);
    const request = { headers: {} };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(
      'Sign in to continue.',
    );
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('loads the current account before allowing a valid session', async () => {
    const identity = {
      sub: 'member-id',
      username: 'jamie',
      role: UserRole.MEMBER,
      playerId: 'player-id',
    };
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue(identity),
    } as unknown as JwtService;
    const auth = {
      findUser: jest.fn().mockResolvedValue(identity),
    } as unknown as AuthService;
    const guard = new AuthGuard(jwt, auth);
    const request = { headers: { cookie: 'fiveaside_session=signed-token' } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('user', identity);
    expect(auth.findUser).toHaveBeenCalledWith(identity);
  });

  it('does not allow a member through an administrator-only route', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([UserRole.ADMIN]),
    } as unknown as Reflector;
    const request = { user: { sub: 'member-id', role: UserRole.MEMBER } };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
