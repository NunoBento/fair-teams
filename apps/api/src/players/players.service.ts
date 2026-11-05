import {
	ConflictException,
	ForbiddenException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthService } from '../auth/auth.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreatePlayerDto } from './dto/create-player.dto';
import { CreateRatingDto } from './dto/create-rating.dto';
import { calculateMedianStats, PlayerStats, RatedPlayer } from './player-stats';
import { Player, PlayerDocument } from './player.schema';

@Injectable()
export class PlayersService {
	constructor(
		@InjectModel(Player.name) private readonly playerModel: Model<Player>,
		private readonly authService: AuthService,
	) { }

	async findAll(): Promise<RatedPlayer[]> {
		const players = await this.playerModel.find().sort({ name: 1 }).exec();
		return players.map((player) => this.toRatedPlayer(player));
	}

	async create(dto: CreatePlayerDto): Promise<RatedPlayer> {
		const player = await this.playerModel.create({
			name: dto.name.trim(),
			position: dto.position?.trim() || 'Any',
			ratings: [],
		});
		return this.toRatedPlayer(player);
	}

	async addRating(
		id: string,
		dto: CreateRatingDto,
		evaluator: AuthenticatedUser,
	): Promise<RatedPlayer> {
		const player = await this.playerModel.findById(id).exec();
		if (!player) throw new NotFoundException('Player not found.');
		if (evaluator.playerId === id) {
			throw new ForbiddenException('You cannot rate your own player profile.');
		}
		const existingRating = player.ratings.find(
			(rating) => rating.evaluatorUserId === evaluator.sub,
		);
		if (existingRating) {
			existingRating.stats = dto.stats;
			existingRating.createdAt = new Date();
		} else {
			player.ratings.push({
				evaluatorName: evaluator.username,
				evaluatorUserId: evaluator.sub,
				stats: dto.stats,
				createdAt: new Date(),
			});
		}
		await player.save();
		return this.toRatedPlayer(player);
	}

	async findMyRating(
		id: string,
		evaluator: AuthenticatedUser,
	): Promise<PlayerStats | null> {
		const player = await this.playerModel.findById(id).exec();
		if (!player) throw new NotFoundException('Player not found.');
		return (
			player.ratings.find((rating) => rating.evaluatorUserId === evaluator.sub)
				?.stats ?? null
		);
	}

	async remove(id: string): Promise<void> {
		if (await this.authService.hasMemberForPlayer(id)) {
			throw new ConflictException(
				'Remove the linked member account before deleting this player.',
			);
		}
		const result = await this.playerModel.deleteOne({ _id: id }).exec();
		if (result.deletedCount === 0)
			throw new NotFoundException('Player not found.');
	}

	async findByIds(ids: string[]): Promise<RatedPlayer[]> {
		const players = await this.playerModel.find({ _id: { $in: ids } }).exec();
		return players.map((player) => this.toRatedPlayer(player));
	}

	private toRatedPlayer(player: PlayerDocument): RatedPlayer {
		return {
			id: player._id.toString(),
			name: player.name,
			position: player.position,
			ratingCount: player.ratings.length,
			stats: calculateMedianStats(player.ratings),
		};
	}
}
