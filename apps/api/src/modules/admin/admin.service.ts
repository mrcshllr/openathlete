import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@openathlete/database';
import { AdminUserDto } from '@openathlete/shared';

import { maskEmail } from 'src/common/utils/mask-email';

import { AuthUser } from '../auth/decorators/user.decorator';
import { InstanceSettingsService } from '../auth/services/instance-settings.service';
import { PrismaService } from '../prisma/services/prisma.service';

interface UserRow {
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  roles: string[];
  created_at: Date;
  last_seen_at: Date | null;
  disabled_at: Date | null;
  activities: number;
  last_activity_at: Date | null;
  providers: string[];
  athletes: number;
  coaches: number;
}

/**
 * The accounts of the instance, for whoever runs it: who they are and how
 * much they use it. Never what they trained: that takes a coach's access.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: InstanceSettingsService,
  ) {}

  async listUsers(): Promise<AdminUserDto[]> {
    const [rows, admins] = await Promise.all([
      this.prisma.$queryRaw<UserRow[]>(Prisma.sql`
        SELECT u.user_id, u.first_name, u.last_name, u.email,
          u.roles::text[] AS roles, u.created_at, u.last_seen_at, u.disabled_at,
          coalesce(act.activities, 0)::int AS activities,
          act.last_activity_at,
          coalesce(prov.providers, ARRAY[]::text[]) AS providers,
          (SELECT count(*) FROM coach_athlete ca
            WHERE ca.user_id = u.user_id)::int AS athletes,
          (SELECT count(*) FROM coach_athlete ca
            WHERE ca.athlete_id = a.athlete_id)::int AS coaches
        FROM "user" u
        LEFT JOIN athlete a ON a.user_id = u.user_id
        LEFT JOIN LATERAL (
          SELECT count(*) AS activities, max(e.start_date) AS last_activity_at
          FROM event e
          WHERE e.athlete_id = a.athlete_id AND e.type = 'ACTIVITY'
        ) act ON true
        LEFT JOIN LATERAL (
          SELECT array_agg(DISTINCT p.provider::text ORDER BY p.provider::text)
            AS providers
          FROM provider_account p
          WHERE p.athlete_id = a.athlete_id AND p.status = 'active'
        ) prov ON true
        ORDER BY u.user_id`),
      this.settings.adminUserIds(),
    ]);
    return rows.map((row) => ({
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      roles: row.roles,
      admin: admins.includes(row.user_id),
      createdAt: row.created_at,
      lastSeenAt: row.last_seen_at,
      disabledAt: row.disabled_at,
      activities: row.activities,
      lastActivityAt: row.last_activity_at,
      providers: row.providers,
      athletes: row.athletes,
      coaches: row.coaches,
    }));
  }

  /**
   * Locks an account out, or lets it back in. Nothing is deleted: its data
   * and its devices' syncs stay as they are. An administrator is never
   * locked, so that the instance always keeps someone who can undo it.
   */
  async setDisabled(admin: AuthUser, userId: number, disabled: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { userId: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (disabled && (await this.settings.isAdmin(userId))) {
      throw new BadRequestException('ADMIN_CANNOT_BE_DISABLED');
    }
    await this.prisma.user.update({
      where: { userId },
      data: { disabledAt: disabled ? new Date() : null },
    });
    this.logger.log(
      `Account ${userId} (${maskEmail(user.email)}) ${disabled ? 'locked' : 'unlocked'} by administrator ${admin.userId}`,
    );
    return { userId, disabled };
  }
}
