import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { GenerateTeamsDto } from './dto/generate-teams.dto';
import { TeamsService } from './teams.service';

@Controller('teams')
@UseGuards(AuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post('generate')
  generate(@Body() dto: GenerateTeamsDto) {
    return this.teamsService.generate(dto);
  }
}
