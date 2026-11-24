import { ExecutionContext, ForbiddenException } from '@nestjs/common';

import { InstanceSettingsService } from '../auth/services/instance-settings.service';
import { AdminGuard } from './admin.guard';

const context = (user?: { userId: number }) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('AdminGuard', () => {
  const guard = new AdminGuard({
    isAdmin: async (userId: number) => userId === 1,
  } as unknown as InstanceSettingsService);

  it('lets an administrator through', async () => {
    await expect(guard.canActivate(context({ userId: 1 }))).resolves.toBe(true);
  });

  it('refuses everyone else, signed in or not', async () => {
    await expect(guard.canActivate(context({ userId: 2 }))).rejects.toThrow(
      ForbiddenException,
    );
    await expect(guard.canActivate(context())).rejects.toThrow(
      ForbiddenException,
    );
  });
});
