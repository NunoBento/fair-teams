import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '../auth/user.schema';
import { GenerateTeamsDto } from './dto/generate-teams.dto';
import { TeamsService } from './teams.service';

@Controller('teams')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post('generate')
  generate(@Body() dto: GenerateTeamsDto) {
    return this.teamsService.generate(dto);
  }
}
