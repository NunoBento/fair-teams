import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlayersService } from '../players/players.service';
import { balancePlayers } from '../players/player-stats';
import type { RatedPlayer } from '../players/player-stats';
import { GenerateTeamsDto } from './dto/generate-teams.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly playersService: PlayersService) {}

  async generate(dto: GenerateTeamsDto) {
    if (dto.playerIds.length !== 8 && dto.playerIds.length !== 10) {
      throw new BadRequestException(
        'Select exactly 8 or 10 players to build teams.',
      );
    }
    const foundPlayers = await this.playersService.findByIds(dto.playerIds);
    const playersById = new Map(
      foundPlayers.map((player) => [player.id, player]),
    );
    const players = dto.playerIds.map((id) => playersById.get(id));
    if (players.some((player) => player === undefined)) {
      throw new NotFoundException(
        'One or more selected players could not be found.',
      );
    }
    const orderedPlayers = players.filter(
      (player): player is RatedPlayer => player !== undefined,
    );
    try {
      return balancePlayers(orderedPlayers);
    } catch (error) {
      if (error instanceof Error) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
