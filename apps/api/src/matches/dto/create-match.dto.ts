import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
} from 'class-validator';

export class CreateMatchDto {
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsMongoId({ each: true })
  whites!: string[];

  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(5)
  @ArrayUnique()
  @IsMongoId({ each: true })
  blacks!: string[];
}
