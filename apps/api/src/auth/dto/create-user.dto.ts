import {
  IsMongoId,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9._-]+$/, {
    message:
      'username may contain letters, numbers, dots, underscores, and hyphens',
  })
  username!: string;

  @IsMongoId()
  playerId!: string;
}
