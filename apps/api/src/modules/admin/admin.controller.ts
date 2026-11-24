import { ZodValidationPipe } from 'nestjs-zod';

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
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
  AdminActionDto,
  AdminInvitationDto,
  AdminPasswordResetDto,
  AdminSettingsDto,
  AdminSystemDto,
  AdminUserDto,
  CreateInstanceInvitationDto,
  UpdateSignupModeDto,
  createInstanceInvitationSchema,
  updateSignupModeSchema,
} from '@openathlete/shared';

import { AuthUser, JwtUser } from '../auth/decorators/user.decorator';
import { InstanceSettingsService } from '../auth/services/instance-settings.service';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

const INVITATION_KINDS = {
  INSTANCE: 'INSTANCE',
  ATHLETE: 'ATHLETE',
  COACH: 'COACH',
} as const;

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
    @JwtUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateSignupModeSchema))
    body: UpdateSignupModeDto,
  ): Promise<AdminSettingsDto> {
    return this.admin.setSignupMode(user, body.mode);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Delete('users/:userId')
  @ApiOperation({
    summary: 'Delete an account for good',
    description:
      'Deletes the account and everything it holds, as the user could from their own settings. It cannot be undone. An administrator cannot be deleted.',
  })
  @ApiResponse({ status: 200, description: 'The account is gone' })
  @ApiResponse({ status: 400, description: 'The account is an administrator' })
  @ApiResponse({ status: 403, description: 'Not an administrator' })
  @ApiResponse({ status: 404, description: 'No such account' })
  deleteUser(
    @JwtUser() user: AuthUser,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.admin.deleteUser(user, userId);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post('users/:userId/password-reset')
  @ApiOperation({
    summary: 'Give an account a link to set a new password',
    description:
      'The link of "forgot password", valid 15 minutes. With email on the instance it is sent to the account; without, it is returned for the administrator to pass on.',
  })
  @ApiResponse({ status: 201, description: 'Whether it was sent, or the link' })
  @ApiResponse({ status: 403, description: 'Not an administrator' })
  @ApiResponse({ status: 404, description: 'No such account' })
  resetPassword(
    @JwtUser() user: AuthUser,
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<AdminPasswordResetDto> {
    return this.admin.resetPassword(user, userId);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('invitations')
  @ApiOperation({
    summary: 'The invitations still open on the instance',
    description:
      "The administrator's sign-up links with their URL, and the invitations users sent to athletes and coaches, each with who sent it and when it expires.",
  })
  @ApiResponse({ status: 200, description: 'The open invitations' })
  @ApiResponse({ status: 403, description: 'Not an administrator' })
  invitations(): Promise<AdminInvitationDto[]> {
    return this.admin.listInvitations();
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Post('invitations')
  @ApiOperation({
    summary: 'Create a sign-up link',
    description:
      'A link to hand to someone, used once and valid 7 days. It lets an account be created whatever the sign-up mode, even closed, and ties it to no coach or club.',
  })
  @ApiResponse({ status: 201, description: 'The invitation, with its link' })
  @ApiResponse({ status: 403, description: 'Not an administrator' })
  createInvitation(
    @JwtUser() user: AuthUser,
    @Body(new ZodValidationPipe(createInstanceInvitationSchema))
    body: CreateInstanceInvitationDto,
  ): Promise<AdminInvitationDto> {
    return this.admin.createInvitation(user, body.label);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Delete('invitations/:kind/:id')
  @ApiOperation({
    summary: 'Take an open invitation back',
    description:
      'kind is INSTANCE, ATHLETE or COACH. The link stops working. An invitation already used is not found.',
  })
  @ApiResponse({ status: 200, description: 'The invitation is gone' })
  @ApiResponse({ status: 403, description: 'Not an administrator' })
  @ApiResponse({ status: 404, description: 'No such open invitation' })
  revokeInvitation(
    @JwtUser() user: AuthUser,
    @Param('kind', new ParseEnumPipe(INVITATION_KINDS))
    kind: AdminInvitationDto['kind'],
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.admin.revokeInvitation(user, kind, id);
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('system')
  @ApiOperation({
    summary: 'How the instance is doing',
    description:
      'The number of accounts and activities, the size of the database and of the activities in it (bytes), and for each background queue how many jobs wait, run, are delayed or failed.',
  })
  @ApiResponse({ status: 200, description: 'The figures' })
  @ApiResponse({ status: 403, description: 'Not an administrator' })
  system(): Promise<AdminSystemDto> {
    return this.admin.system();
  }

  @UseGuards(AuthGuard('jwt'), AdminGuard)
  @Get('actions')
  @ApiOperation({
    summary: 'What administrators did',
    description:
      'The last 100 actions, the latest first: who, what, on which account (its email masked) and when.',
  })
  @ApiResponse({ status: 200, description: 'The actions' })
  @ApiResponse({ status: 403, description: 'Not an administrator' })
  actions(): Promise<AdminActionDto[]> {
    return this.admin.listActions();
  }
}
