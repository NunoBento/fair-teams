import {
	ConflictException,
	Injectable,
	NotFoundException,
	OnModuleInit,
	UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { compare, hash } from 'bcryptjs';
import { Model } from 'mongoose';
import { randomBytes } from 'node:crypto';
import { Player } from '../players/player.schema';
import { AuthenticatedUser, UserSummary } from './auth.types';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginDto } from './dto/login.dto';
import { User, UserDocument, UserRole } from './user.schema';

@Injectable()
export class AuthService implements OnModuleInit {
	constructor(
		@InjectModel(User.name) private readonly userModel: Model<User>,
		@InjectModel(Player.name) private readonly playerModel: Model<Player>,
		private readonly jwtService: JwtService,
		private readonly configService: ConfigService,
	) { }

	async onModuleInit(): Promise<void> {
		const secret = this.configService.get<string>('JWT_SECRET');
		const username = this.configService.get<string>('ADMIN_USERNAME')?.trim().toLowerCase();
		const password = this.configService.get<string>('ADMIN_PASSWORD');
		if (!secret || secret.length < 32) {
			throw new Error('JWT_SECRET must be set to a random value of at least 32 characters.');
		}
		if (!username || username.length < 3 || !password || password.length < 5) {
			throw new Error(
				'Set ADMIN_USERNAME (at least 3 characters) and ADMIN_PASSWORD (at least 5 characters) to bootstrap the league admin.',
			);
		}

		const existing = await this.userModel.findOne({ username }).exec();
		if (existing) {
			if (existing.role !== UserRole.ADMIN) {
				throw new Error(
					'ADMIN_USERNAME already belongs to a non-admin account.',
				);
			}
			return;
		}
		await this.userModel.create({
			username,
			passwordHash: await hash(password, 12),
			role: UserRole.ADMIN,
		});
	}

	async login(dto: LoginDto): Promise<{ user: UserSummary; token: string }> {
		const user = await this.userModel
			.findOne({
				username: dto.username.trim().toLowerCase(),
			})
			.select('+passwordHash')
			.exec();
		if (!user || !(await compare(dto.password, user.passwordHash))) {
			throw new UnauthorizedException('Username or password is incorrect.');
		}
		const identity = this.toAuthenticatedUser(user);
		return {
			user: this.toUserSummary(user),
			token: await this.jwtService.signAsync(identity),
		};
	}

	async findUser(user: AuthenticatedUser): Promise<UserSummary> {
		const account = await this.userModel.findById(user.sub).exec();
		if (!account)
			throw new UnauthorizedException('This account is no longer available.');
		return this.toUserSummary(account);
	}

	async createMember(
		dto: CreateUserDto,
	): Promise<{ user: UserSummary; temporaryPassword: string }> {
		const username = dto.username.trim().toLowerCase();
		if (await this.userModel.exists({ username })) {
			throw new ConflictException('That username is already in use.');
		}
		if (!(await this.playerModel.exists({ _id: dto.playerId }))) {
			throw new NotFoundException('The selected player does not exist.');
		}
		if (await this.userModel.exists({ playerId: dto.playerId })) {
			throw new ConflictException('That player already has a login account.');
		}

		const temporaryPassword = randomBytes(18).toString('base64url');
		try {
			const user = await this.userModel.create({
				username,
				passwordHash: await hash(temporaryPassword, 12),
				role: UserRole.MEMBER,
				playerId: dto.playerId,
			});
			return { user: this.toUserSummary(user), temporaryPassword };
		} catch (error) {
			if (
				error &&
				typeof error === 'object' &&
				'code' in error &&
				error.code === 11000
			) {
				throw new ConflictException(
					'That username or player already has an account.',
				);
			}
			throw error;
		}
	}

	async findMembers(): Promise<UserSummary[]> {
		const users = await this.userModel
			.find({ role: UserRole.MEMBER })
			.sort({ username: 1 })
			.exec();
		return users.map((user) => this.toUserSummary(user));
	}

	async removeMember(id: string): Promise<void> {
		const result = await this.userModel
			.deleteOne({ _id: id, role: UserRole.MEMBER })
			.exec();
		if (!result.deletedCount)
			throw new NotFoundException('Member account not found.');
	}

	async hasMemberForPlayer(playerId: string): Promise<boolean> {
		return Boolean(
			await this.userModel.exists({ playerId, role: UserRole.MEMBER }),
		);
	}

	private toAuthenticatedUser(user: UserDocument): AuthenticatedUser {
		return {
			sub: user._id.toString(),
			username: user.username,
			role: user.role,
			...(user.playerId ? { playerId: user.playerId.toString() } : {}),
		};
	}

	private toUserSummary(user: UserDocument): UserSummary {
		return {
			id: user._id.toString(),
			username: user.username,
			role: user.role,
			...(user.playerId ? { playerId: user.playerId.toString() } : {}),
		};
	}
}
