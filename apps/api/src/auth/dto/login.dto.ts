import { IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
	@IsString()
	@MinLength(3)
	@MaxLength(32)
	username!: string;

	@IsString()
	@MinLength(5)
	@MaxLength(128)
	password!: string;
}
