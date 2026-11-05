import { ArrayUnique, IsArray, IsMongoId } from 'class-validator';

export class GenerateTeamsDto {
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  playerIds!: string[];
}
