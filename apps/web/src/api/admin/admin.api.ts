import client, { routes } from '@/utils/axios';

import {
  AdminAccessDto,
  AdminActionDto,
  AdminInvitationDto,
  AdminPasswordResetDto,
  AdminSettingsDto,
  AdminSystemDto,
  AdminUserDto,
  SignupMode,
  adminActionSchema,
  adminInvitationSchema,
  adminSettingsSchema,
  adminSystemSchema,
  adminUserSchema,
} from '@openathlete/shared';

export class AdminAPI {
  static async getAccess(): Promise<AdminAccessDto> {
    const res = await client.get(routes.admin.access);
    return res.data;
  }

  static async getUsers(): Promise<AdminUserDto[]> {
    const res = await client.get(routes.admin.users);
    return adminUserSchema.array().parse(res.data);
  }

  static async setUserDisabled({
    userId,
    disabled,
  }: {
    userId: number;
    disabled: boolean;
  }): Promise<void> {
    await client.post(
      disabled
        ? routes.admin.disableUser(userId)
        : routes.admin.enableUser(userId),
    );
  }

  static async getSettings(): Promise<AdminSettingsDto> {
    const res = await client.get(routes.admin.settings);
    return adminSettingsSchema.parse(res.data);
  }

  /** null goes back to the server's configuration */
  static async setSignupMode(
    mode: SignupMode | null,
  ): Promise<AdminSettingsDto> {
    const res = await client.put(routes.admin.signupMode, { mode });
    return adminSettingsSchema.parse(res.data);
  }

  /** For good: the account and everything it holds */
  static async deleteUser(userId: number): Promise<void> {
    await client.delete(routes.admin.user(userId));
  }

  static async resetPassword(userId: number): Promise<AdminPasswordResetDto> {
    const res = await client.post(routes.admin.passwordReset(userId));
    return res.data;
  }

  static async getInvitations(): Promise<AdminInvitationDto[]> {
    const res = await client.get(routes.admin.invitations);
    return adminInvitationSchema.array().parse(res.data);
  }

  static async createInvitation(label?: string): Promise<AdminInvitationDto> {
    const res = await client.post(routes.admin.invitations, {
      label: label || undefined,
    });
    return adminInvitationSchema.parse(res.data);
  }

  static async revokeInvitation({
    kind,
    id,
  }: Pick<AdminInvitationDto, 'kind' | 'id'>): Promise<void> {
    await client.delete(routes.admin.invitation(kind, id));
  }

  static async getSystem(): Promise<AdminSystemDto> {
    const res = await client.get(routes.admin.system);
    return adminSystemSchema.parse(res.data);
  }

  static async getActions(): Promise<AdminActionDto[]> {
    const res = await client.get(routes.admin.actions);
    return adminActionSchema.array().parse(res.data);
  }
}
