import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePlayerDto {
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  @Matches(/\S/, { message: 'name must contain a non-whitespace character' })
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  position?: string;
}
