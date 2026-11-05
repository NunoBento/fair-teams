import { IsIn, IsMongoId } from 'class-validator';
import type { MatchTeam } from '../match.schema';

export class AddMatchGoalDto {
  @IsIn(['whites', 'blacks'])
  team!: MatchTeam;

  @IsMongoId()
  playerId!: string;
}
