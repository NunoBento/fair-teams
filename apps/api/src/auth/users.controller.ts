import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { UserRole } from './user.schema';

@Controller('users')
@UseGuards(AuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  findMembers() {
    return this.authService.findMembers();
  }

  @Post()
  createMember(@Body() dto: CreateUserDto) {
    return this.authService.createMember(dto);
  }

  @Delete(':id')
  removeMember(@Param('id') id: string) {
    return this.authService.removeMember(id);
  }
}
