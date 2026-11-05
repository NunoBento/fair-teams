import { Type } from 'class-transformer';
import { IsInt, Max, Min, ValidateNested } from 'class-validator';

export class RatingStatsDto {
  @IsInt() @Min(1) @Max(10) dribbling!: number;
  @IsInt() @Min(1) @Max(10) speed!: number;
  @IsInt() @Min(1) @Max(10) shooting!: number;
  @IsInt() @Min(1) @Max(10) stamina!: number;
  @IsInt() @Min(1) @Max(10) passing!: number;
  @IsInt() @Min(1) @Max(10) defending!: number;
}

export class CreateRatingDto {
  @ValidateNested()
  @Type(() => RatingStatsDto)
  stats!: RatingStatsDto;
}
