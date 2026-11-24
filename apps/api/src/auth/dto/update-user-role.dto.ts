import { IsEnum } from 'class-validator';
import { UserRole } from '../user.schema';

export class UpdateUserRoleDto {
  @IsEnum(UserRole)
  role!: UserRole;
}
