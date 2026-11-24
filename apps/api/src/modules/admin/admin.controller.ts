import { ZodValidationPipe } from 'nestjs-zod';

import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import {
  AdminAccessDto,
  AdminSettingsDto,
  AdminUserDto,
  UpdateSignupModeDto,
  updateSignupModeSchema,
} from '@openathlete/shared';

import { AuthUser, JwtUser } from '../auth/decorators/user.decorator';
import { InstanceSettingsService } from '../auth/services/instance-settings.service';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

@ApiTags('Administration')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly settings: InstanceSettingsService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('access')
  @ApiOperation({
    summary: 'Whether the signed-in user administers the instance',
    description:
      'The administrators are the accounts of ADMIN_EMAILS, or without it the first account of the instance. The app shows its administration page to them only.',
  })
  @ApiResponse({ status: 200, description: 'Whether the user is one' })
  async access(@JwtUser() user: AuthUser): Promise<AdminAccessDto> {
    return { admin: await this.settings.isAdmin(user.userId) };
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('users')
  @ApiOperation({
    summary: 'The accounts of the instance',
    description:
      'For administrators. Each account with its name, email, roles, when it was created and last used, whether it is locked, how many activities it holds and which services it connected. Nothing of the training itself.',
  })
  @ApiResponse({ status: 200, description: 'Every account, oldest first' })
  @ApiResponse({ status: 403, description: 'Not an administrator' })
  users(): Promise<AdminUserDto[]> {
    return this.admin.listUsers();
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post('users/:userId/disable')
  @ApiOperation({
    summary: 'Lock an account out',
    description:
      'The account can no longer sign in, its sessions and its agents stop working. Nothing is deleted. An administrator cannot be locked.',
  })
  @ApiResponse({ status: 201, description: 'The account is locked' })
  @ApiResponse({ status: 400, description: 'The account is an administrator' })
  @ApiResponse({ status: 403, description: 'Not an administrator' })
  @ApiResponse({ status: 404, description: 'No such account' })
  disable(
    @JwtUser() user: AuthUser,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.admin.setDisabled(user, userId, true);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post('users/:userId/enable')
  @ApiOperation({ summary: 'Let a locked account back in' })
  @ApiResponse({ status: 201, description: 'The account can sign in again' })
  @ApiResponse({ status: 403, description: 'Not an administrator' })
  @ApiResponse({ status: 404, description: 'No such account' })
  enable(
    @JwtUser() user: AuthUser,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.admin.setDisabled(user, userId, false);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('settings')
  @ApiOperation({
    summary: 'What the administrator can set for the instance',
    description:
      'The sign-up mode in effect, what SIGNUP_MODE says, and whether the administrator chose another one.',
  })
  @ApiResponse({ status: 200, description: 'The settings' })
  @ApiResponse({ status: 403, description: 'Not an administrator' })
  getSettings(): Promise<AdminSettingsDto> {
    return this.settings.signupSettings();
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Put('settings/signup-mode')
  @ApiOperation({
    summary: 'Choose who may create an account',
    description:
      'open, invite or closed, in effect at once and kept over restarts. null goes back to SIGNUP_MODE. Existing accounts are not affected.',
  })
  @ApiResponse({ status: 200, description: 'The settings, as they now are' })
  @ApiResponse({ status: 403, description: 'Not an administrator' })
  setSignupMode(
    @Body(new ZodValidationPipe(updateSignupModeSchema))
    body: UpdateSignupModeDto,
  ): Promise<AdminSettingsDto> {
    return this.settings.setSignupMode(body.mode);
  }
}
