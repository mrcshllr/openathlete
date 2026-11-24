import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { AuthUser } from '../auth/decorators/user.decorator';
import { InstanceSettingsService } from '../auth/services/instance-settings.service';

/** Lets the instance's administrators through, after the JWT guard. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly settings: InstanceSettingsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user: AuthUser | undefined = context.switchToHttp().getRequest().user;
    if (!user || !(await this.settings.isAdmin(user.userId))) {
      throw new ForbiddenException('ADMIN_ONLY');
    }
    return true;
  }
}
