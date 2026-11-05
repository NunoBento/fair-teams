import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CreatePlayerDto } from './dto/create-player.dto';
import { CreateRatingDto } from './dto/create-rating.dto';
import { PlayersService } from './players.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../auth/user.schema';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('players')
@UseGuards(AuthGuard, RolesGuard)
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Get()
  findAll() {
    return this.playersService.findAll();
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreatePlayerDto) {
    return this.playersService.create(dto);
  }

  @Get(':id/my-rating')
  findMyRating(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.playersService.findMyRating(id, user);
  }

  @Post(':id/ratings')
  addRating(
    @Param('id') id: string,
    @Body() dto: CreateRatingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.playersService.addRating(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.playersService.remove(id);
  }
}
