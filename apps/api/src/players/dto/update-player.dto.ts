import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdatePlayerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/\S/, { message: 'name must contain a non-whitespace character' })
  name!: string;
}
