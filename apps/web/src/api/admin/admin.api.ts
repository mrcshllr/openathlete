import client, { routes } from '@/utils/axios';

import {
  AdminAccessDto,
  AdminSettingsDto,
  AdminUserDto,
  SignupMode,
  adminSettingsSchema,
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
}
