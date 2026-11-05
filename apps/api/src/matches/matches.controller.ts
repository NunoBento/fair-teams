import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AddMatchGoalDto } from './dto/add-match-goal.dto';
import { CreateMatchDto } from './dto/create-match.dto';
import { MatchesService } from './matches.service';

@Controller('matches')
@UseGuards(AuthGuard)
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get('active')
  findActive() {
    return this.matchesService.findActive();
  }

  @Get('recent')
  findRecent() {
    return this.matchesService.findRecent();
  }

  @Get('goal-leaders')
  findGoalLeaders() {
    return this.matchesService.findGoalLeaders();
  }

  @Post()
  create(
    @Body() dto: CreateMatchDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.matchesService.create(dto, user);
  }

  @Post(':id/goals')
  addGoal(
    @Param('id') id: string,
    @Body() dto: AddMatchGoalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.matchesService.addGoal(id, dto, user);
  }

  @Post(':id/finish')
  finish(@Param('id') id: string) {
    return this.matchesService.finish(id);
  }
}
