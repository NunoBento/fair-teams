import {
	CanActivate,
	ExecutionContext,
	Injectable,
	UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
import { UserRole } from './user.schema';

const SESSION_COOKIE = 'fiveaside_session';

function sessionToken(request: Request): string | undefined {
	const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
	return cookie?.slice(SESSION_COOKIE.length + 1);
}

@Injectable()
export class AuthGuard implements CanActivate {
	constructor(
		private readonly jwtService: JwtService,
		private readonly authService: AuthService,
	) { }

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context
			.switchToHttp()
			.getRequest<Request & { user?: AuthenticatedUser }>();
		const token = sessionToken(request);
		if (!token) throw new UnauthorizedException('Sign in to continue.');

		try {
			const payload = await this.jwtService.verifyAsync<AuthenticatedUser>(
				decodeURIComponent(token),
			);
			if (
				!payload.sub ||
				!payload.username ||
				!Object.values(UserRole).includes(payload.role)
			) {
				throw new UnauthorizedException('Invalid session.');
			}
			const currentUser = await this.authService.findUser(payload);
			request.user = {
				...payload,
				username: currentUser.username,
				role: currentUser.role,
				...(currentUser.playerId ? { playerId: currentUser.playerId } : {}),
			};
			return true;
		} catch {
			throw new UnauthorizedException(
				'Your session has expired. Sign in again.',
			);
		}
	}
}
