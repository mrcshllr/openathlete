import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { Prisma, TokenType } from '@openathlete/database';
import {
  AdminActionDto,
  AdminActionType,
  AdminInvitationDto,
  AdminPasswordResetDto,
  AdminSettingsDto,
  AdminSystemDto,
  AdminUserDto,
  ApiEnvSchemaType,
  SignupMode,
} from '@openathlete/shared';

import { maskEmail } from 'src/common/utils/mask-email';
import { SendEmailEvent } from 'src/events';

import { AuthUser } from '../auth/decorators/user.decorator';
import {
  instanceInvitationExpiry,
  instanceInvitationUrl,
  newInstanceInvitationToken,
} from '../auth/helpers/instance-invitation';
import { passwordResetUrl } from '../auth/helpers/password-reset-url';
import { AccountDeletionService } from '../auth/services/account-deletion.service';
import { InstanceSettingsService } from '../auth/services/instance-settings.service';
import { TokenService } from '../auth/services/token.service';
import { emailTransportKind } from '../notification/services/email-transport.service';
import { PrismaService } from '../prisma/services/prisma.service';
import { QueueService } from '../queue/queue.service';

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
  storage_bytes: number;
}

/** A user's invitation stays open a week, as its own services have it */
const INVITATION_MS = 7 * 24 * 3600 * 1000;
const ACTIONS_SHOWN = 100;

const fullName = (user: { firstName: string; lastName: string }) =>
  `${user.firstName} ${user.lastName}`.trim();

/**
 * The instance, for whoever runs it: its accounts and how much they use it,
 * the invitations still open, what it stores and what it has left to do.
 * Never what was trained: that takes a coach's access. Everything an
 * administrator changes is written down.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: InstanceSettingsService,
    private readonly config: ConfigService<ApiEnvSchemaType, true>,
    private readonly accountDeletion: AccountDeletionService,
    private readonly tokens: TokenService,
    private readonly events: EventEmitter2,
    private readonly queues: QueueService,
  ) {}

  private async record(
    admin: AuthUser,
    action: AdminActionType,
    entry: {
      target?: { userId: number; email: string };
      detail?: string | null;
    } = {},
  ) {
    await this.prisma.adminAction.create({
      data: {
        adminUserId: admin.userId,
        action,
        targetUserId: entry.target?.userId,
        target: entry.target ? maskEmail(entry.target.email) : null,
        detail: entry.detail ?? null,
      },
    });
    this.logger.log(
      `${action} by administrator ${admin.userId}${entry.target ? ` on account ${entry.target.userId} (${maskEmail(entry.target.email)})` : ''}`,
    );
  }

  /** The account an action is about: it exists, and is not an administrator */
  private async target(userId: number, { adminAllowed = false } = {}) {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: { userId: true, email: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (!adminAllowed && (await this.settings.isAdmin(userId))) {
      throw new BadRequestException('ADMIN_ACCOUNT_PROTECTED');
    }
    return user;
  }

  async listUsers(): Promise<AdminUserDto[]> {
    const [rows, admins] = await Promise.all([
      this.prisma.$queryRaw<UserRow[]>(Prisma.sql`
        SELECT u.user_id, u.first_name, u.last_name, u.email,
          u.roles::text[] AS roles, u.created_at, u.last_seen_at, u.disabled_at,
          coalesce(act.activities, 0)::int AS activities,
          act.last_activity_at,
          coalesce(act.storage_bytes, 0)::float8 AS storage_bytes,
          coalesce(prov.providers, ARRAY[]::text[]) AS providers,
          (SELECT count(*) FROM coach_athlete ca
            WHERE ca.user_id = u.user_id)::int AS athletes,
          (SELECT count(*) FROM coach_athlete ca
            WHERE ca.athlete_id = a.athlete_id)::int AS coaches
        FROM "user" u
        LEFT JOIN athlete a ON a.user_id = u.user_id
        LEFT JOIN LATERAL (
          SELECT count(*) AS activities, max(e.start_date) AS last_activity_at,
            sum(coalesce(pg_column_size(ea.stream), 0) + coalesce(f.size, 0))
              AS storage_bytes
          FROM event e
          LEFT JOIN event_activity ea ON ea.event_id = e.event_id
          LEFT JOIN event_activity_file f
            ON f.event_activity_id = ea.event_activity_id
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
      storageBytes: row.storage_bytes,
    }));
  }

  /**
   * Locks an account out, or lets it back in. Nothing is deleted: its data
   * and its devices' syncs stay as they are. An administrator is never
   * locked, so that the instance always keeps someone who can undo it.
   */
  async setDisabled(admin: AuthUser, userId: number, disabled: boolean) {
    const user = await this.target(userId, { adminAllowed: !disabled });
    await this.prisma.user.update({
      where: { userId },
      data: { disabledAt: disabled ? new Date() : null },
    });
    await this.record(admin, disabled ? 'USER_LOCKED' : 'USER_UNLOCKED', {
      target: user,
    });
    return { userId, disabled };
  }

  /**
   * Deletes an account and everything it holds, for good, the way the user
   * could from their own settings. Never an administrator's.
   */
  async deleteUser(admin: AuthUser, userId: number) {
    const user = await this.target(userId);
    await this.accountDeletion.deleteAccount(userId);
    await this.record(admin, 'USER_DELETED', { target: user });
    return { userId };
  }

  /**
   * A link to set a new password, as "forgot password" makes one. Sent to
   * the account when the instance has email; else given to the administrator
   * to pass on, as the server's log did until now.
   */
  async resetPassword(
    admin: AuthUser,
    userId: number,
  ): Promise<AdminPasswordResetDto> {
    const user = await this.target(userId, { adminAllowed: true });
    const token = await this.tokens.createToken(
      { userId },
      TokenType.PASSWORD_RESET,
    );
    const url = passwordResetUrl(this.config.get('APP_URL'), token.token);
    const hasEmail = !!emailTransportKind((key) => this.config.get(key));
    if (hasEmail) {
      this.events.emit(
        SendEmailEvent.SLUG,
        new SendEmailEvent({
          type: 'password-reset',
          to: user.email,
          params: { url },
        }),
      );
    }
    await this.record(admin, 'PASSWORD_RESET', {
      target: user,
      detail: hasEmail ? 'email' : 'link',
    });
    return { sent: hasEmail, url: hasEmail ? null : url };
  }

  async setSignupMode(
    admin: AuthUser,
    mode: SignupMode | null,
  ): Promise<AdminSettingsDto> {
    const settings = await this.settings.setSignupMode(mode);
    await this.record(admin, 'SIGNUP_MODE_SET', {
      detail: mode ?? `SIGNUP_MODE (${settings.signupModeDefault})`,
    });
    return settings;
  }

  /** A sign-up link to hand to someone: used once, valid a week */
  async createInvitation(
    admin: AuthUser,
    label?: string,
  ): Promise<AdminInvitationDto> {
    const invitation = await this.prisma.instanceInvitation.create({
      data: {
        token: newInstanceInvitationToken(),
        label: label || null,
        createdBy: admin.userId,
      },
    });
    await this.record(admin, 'INVITATION_CREATED', { detail: label || null });
    const [mine] = (await this.listInvitations()).filter(
      (entry) =>
        entry.kind === 'INSTANCE' &&
        entry.id === invitation.instanceInvitationId,
    );
    return mine;
  }

  /** Every invitation still open: the administrator's links, and the users' */
  async listInvitations(now = new Date()): Promise<AdminInvitationDto[]> {
    const since = new Date(now.getTime() - INVITATION_MS);
    const appUrl = this.config.get('APP_URL');
    const [links, toAthletes, toCoaches] = await Promise.all([
      this.prisma.instanceInvitation.findMany({
        where: { usedAt: null, createdAt: { gt: since } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.athleteInvitation.findMany({
        where: {
          createdAt: { gt: since },
          OR: [{ status: 'PENDING' }, { status: null }],
        },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.coachInvitation.findMany({
        where: { createdAt: { gt: since }, status: 'PENDING' },
        include: {
          athleteUser: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const senders = await this.prisma.user.findMany({
      where: { userId: { in: links.map((link) => link.createdBy) } },
      select: { userId: true, firstName: true, lastName: true },
    });
    return [
      ...links.map((link) => ({
        kind: 'INSTANCE' as const,
        id: link.instanceInvitationId,
        recipient: link.label,
        sender: fullName(
          senders.find((user) => user.userId === link.createdBy) ?? {
            firstName: '',
            lastName: '',
          },
        ),
        createdAt: link.createdAt,
        expiresAt: instanceInvitationExpiry(link.createdAt),
        url: instanceInvitationUrl(appUrl, link.token),
      })),
      ...toAthletes.map((invitation) => ({
        kind: 'ATHLETE' as const,
        id: invitation.athleteInvitationId,
        recipient: invitation.email,
        sender: fullName(invitation.user),
        createdAt: invitation.createdAt,
        expiresAt: new Date(invitation.createdAt.getTime() + INVITATION_MS),
        url: null,
      })),
      ...toCoaches.map((invitation) => ({
        kind: 'COACH' as const,
        id: invitation.coachInvitationId,
        recipient: invitation.email,
        sender: fullName(invitation.athleteUser),
        createdAt: invitation.createdAt,
        expiresAt: new Date(invitation.createdAt.getTime() + INVITATION_MS),
        url: null,
      })),
    ];
  }

  /** Takes an open invitation back, whoever sent it: its link stops working */
  async revokeInvitation(
    admin: AuthUser,
    kind: AdminInvitationDto['kind'],
    id: number,
  ) {
    const { count } =
      kind === 'INSTANCE'
        ? await this.prisma.instanceInvitation.deleteMany({
            where: { instanceInvitationId: id, usedAt: null },
          })
        : kind === 'ATHLETE'
          ? await this.prisma.athleteInvitation.deleteMany({
              where: {
                athleteInvitationId: id,
                OR: [{ status: 'PENDING' }, { status: null }],
              },
            })
          : await this.prisma.coachInvitation.deleteMany({
              where: { coachInvitationId: id, status: 'PENDING' },
            });
    if (count === 0) throw new NotFoundException('Invitation not found');
    await this.record(admin, 'INVITATION_REVOKED', { detail: kind });
    return { kind, id };
  }

  /** What the instance stores, and what its queues still have to do */
  async system(): Promise<AdminSystemDto> {
    const [[sizes], users, activities, queues] = await Promise.all([
      this.prisma.$queryRaw<
        { database_bytes: number; activity_bytes: number }[]
      >(Prisma.sql`
        SELECT pg_database_size(current_database())::float8 AS database_bytes,
          (coalesce((SELECT sum(pg_column_size(stream)) FROM event_activity), 0)
            + coalesce((SELECT sum(size) FROM event_activity_file), 0))::float8
            AS activity_bytes`),
      this.prisma.user.count(),
      this.prisma.event.count({ where: { type: 'ACTIVITY' } }),
      // Redis down says nothing of the rest: the page still opens
      this.queues.counts().catch((error: Error) => {
        this.logger.warn(`Queue counts unavailable: ${error.message}`);
        return [];
      }),
    ]);
    return {
      users,
      activities,
      databaseBytes: sizes.database_bytes,
      activityBytes: sizes.activity_bytes,
      queues,
    };
  }

  /** What administrators did, the latest first */
  async listActions(): Promise<AdminActionDto[]> {
    const actions = await this.prisma.adminAction.findMany({
      orderBy: { adminActionId: 'desc' },
      take: ACTIONS_SHOWN,
    });
    const admins = await this.prisma.user.findMany({
      where: { userId: { in: actions.map((action) => action.adminUserId) } },
      select: { userId: true, firstName: true, lastName: true },
    });
    return actions.map((action) => ({
      adminActionId: action.adminActionId,
      admin: fullName(
        admins.find((user) => user.userId === action.adminUserId) ?? {
          firstName: '',
          lastName: '',
        },
      ),
      action: action.action,
      target: action.target,
      detail: action.detail,
      createdAt: action.createdAt,
    }));
  }
}
