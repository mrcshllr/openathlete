import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiEnvSchemaType } from '@openathlete/shared';

import { AuthUser } from 'src/modules/auth/decorators/user.decorator';
import {
  consumeInstanceInvitation,
  usableInstanceInvitation,
} from 'src/modules/auth/helpers/instance-invitation';
import {
  COACH_USER_ID,
  DELETED_USER_ID,
  accountFixtureSql,
} from 'src/modules/auth/services/account-deletion.fixture';
import { AccountDeletionService } from 'src/modules/auth/services/account-deletion.service';
import { InstanceSettingsService } from 'src/modules/auth/services/instance-settings.service';
import { TokenService } from 'src/modules/auth/services/token.service';
import { PrismaService } from 'src/modules/prisma/services/prisma.service';
import { QueueService } from 'src/modules/queue/queue.service';
import { StripeService } from 'src/modules/subscription/services/stripe.service';

import { AdminService } from './admin.service';

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
if (!databaseUrl)
  throw new Error(
    'INTEGRATION_DATABASE_URL must point to a disposable test database',
  );

describe('administration (PostgreSQL)', () => {
  let prisma: PrismaService;
  const env: Partial<Record<keyof ApiEnvSchemaType, string>> = {};
  const config = {
    get: (key: keyof ApiEnvSchemaType) => env[key],
  } as unknown as ConfigService<ApiEnvSchemaType, true>;
  const events = { emit: jest.fn() };
  let settings: InstanceSettingsService;
  let admin: AdminService;
  const me = { userId: DELETED_USER_ID } as AuthUser;

  beforeAll(async () => {
    prisma = new PrismaService({ datasourceUrl: databaseUrl });
    await prisma.$connect();
    settings = new InstanceSettingsService(prisma, config);
    admin = new AdminService(
      prisma,
      settings,
      config,
      new AccountDeletionService(prisma, {} as StripeService),
      new TokenService(prisma),
      events as never,
      {
        counts: async () => [
          {
            name: 'activity-import',
            waiting: 2,
            active: 1,
            delayed: 0,
            failed: 3,
          },
        ],
      } as unknown as QueueService,
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    const tables = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'`;
    await prisma.$executeRawUnsafe(
      `TRUNCATE ${tables.map((t) => `"${t.table_name}"`).join(', ')} RESTART IDENTITY CASCADE`,
    );
    for (const sql of accountFixtureSql) await prisma.$executeRawUnsafe(sql);
    delete env.ADMIN_EMAILS;
    delete env.SIGNUP_MODE;
    delete env.SMTP_HOST;
    env.APP_URL = 'https://train.example.com/';
    events.emit.mockClear();
  });

  it('lists every account with how it is used, the first one as administrator', async () => {
    const users = await admin.listUsers();

    expect(users.map((user) => user.userId)).toEqual(
      [...users.map((user) => user.userId)].sort((a, b) => a - b),
    );
    const first = users.find((user) => user.userId === DELETED_USER_ID)!;
    expect(first).toMatchObject({
      admin: true,
      disabledAt: null,
      lastSeenAt: null,
      providers: ['GARMIN'],
      // Coaches athlete 2002, and is coached by user 1002
      athletes: 1,
      coaches: 1,
    });
    expect(first.activities).toBeGreaterThan(0);
    expect(first.storageBytes).toBeGreaterThanOrEqual(0);
    expect(first.lastActivityAt).toBeInstanceOf(Date);
    const coach = users.find((user) => user.userId === COACH_USER_ID)!;
    expect(coach).toMatchObject({ admin: false, activities: 0, providers: [] });
  });

  it('takes the administrators from ADMIN_EMAILS when it is set', async () => {
    const coach = await prisma.user.findUniqueOrThrow({
      where: { userId: COACH_USER_ID },
    });
    env.ADMIN_EMAILS = ` ${coach.email.toUpperCase()} , nobody@example.com`;

    expect(await settings.adminUserIds()).toEqual([COACH_USER_ID]);
    expect(await settings.isAdmin(DELETED_USER_ID)).toBe(false);
  });

  it('locks an account and lets it back in, but never an administrator', async () => {
    await admin.setDisabled(me, COACH_USER_ID, true);
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { userId: COACH_USER_ID },
        })
      ).disabledAt,
    ).toBeInstanceOf(Date);

    await admin.setDisabled(me, COACH_USER_ID, false);
    expect(
      (
        await prisma.user.findUniqueOrThrow({
          where: { userId: COACH_USER_ID },
        })
      ).disabledAt,
    ).toBeNull();

    await expect(admin.setDisabled(me, DELETED_USER_ID, true)).rejects.toThrow(
      BadRequestException,
    );
    await expect(admin.setDisabled(me, 999999, true)).rejects.toThrow(
      NotFoundException,
    );
  });

  it("keeps the administrator's sign-up mode over SIGNUP_MODE, until reset", async () => {
    env.SIGNUP_MODE = 'closed';
    expect(await settings.signupSettings()).toEqual({
      signupMode: 'closed',
      signupModeDefault: 'closed',
      signupModeOverridden: false,
    });

    expect(await settings.setSignupMode('invite')).toEqual({
      signupMode: 'invite',
      signupModeDefault: 'closed',
      signupModeOverridden: true,
    });
    expect(await settings.signupMode()).toBe('invite');

    await settings.setSignupMode(null);
    expect(await settings.signupMode()).toBe('closed');
  });

  it('writes down what the administrator did, the latest first', async () => {
    await admin.setDisabled(me, COACH_USER_ID, true);
    await admin.setSignupMode(me, 'invite');
    await admin.setSignupMode(me, null);

    const actions = await admin.listActions();
    expect(actions.map((action) => action.action)).toEqual([
      'SIGNUP_MODE_SET',
      'SIGNUP_MODE_SET',
      'USER_LOCKED',
    ]);
    expect(actions[0].detail).toBe('SIGNUP_MODE (open)');
    expect(actions[1].detail).toBe('invite');
    // The account by its masked email, never the address itself
    const coach = await prisma.user.findUniqueOrThrow({
      where: { userId: COACH_USER_ID },
    });
    expect(actions[2].target).not.toBe(coach.email);
    expect(actions[2].target).toContain('@');
  });

  it('deletes an account for good, but never an administrator', async () => {
    await admin.deleteUser(me, COACH_USER_ID);
    expect(
      await prisma.user.findUnique({ where: { userId: COACH_USER_ID } }),
    ).toBeNull();
    // The record outlives the account
    expect((await admin.listActions())[0]).toMatchObject({
      action: 'USER_DELETED',
    });

    await expect(admin.deleteUser(me, DELETED_USER_ID)).rejects.toThrow(
      BadRequestException,
    );
    expect(
      await prisma.user.findUnique({ where: { userId: DELETED_USER_ID } }),
    ).not.toBeNull();
  });

  it('hands the reset link to the administrator without email, and sends it with', async () => {
    const handed = await admin.resetPassword(me, COACH_USER_ID);
    expect(handed.sent).toBe(false);
    expect(handed.url).toMatch(
      /^https:\/\/train\.example\.com\/auth\/password-reset\?token=/,
    );
    expect(events.emit).not.toHaveBeenCalled();

    env.SMTP_HOST = 'smtp.example.com';
    const sent = await admin.resetPassword(me, COACH_USER_ID);
    expect(sent).toEqual({ sent: true, url: null });
    expect(events.emit).toHaveBeenCalledTimes(1);
  });

  it('creates a sign-up link used once, lists it and takes it back', async () => {
    const link = await admin.createInvitation(me, 'For Ben');
    expect(link).toMatchObject({ kind: 'INSTANCE', recipient: 'For Ben' });
    expect(link.url).toMatch(
      /^https:\/\/train\.example\.com\/auth\/create-account\?invitation=inst_/,
    );
    const token = new URL(link.url!).searchParams.get('invitation')!;
    expect(await usableInstanceInvitation(prisma, token)).not.toBeNull();

    // The fixture's pending invitation of a coach shows next to it
    const open = await admin.listInvitations();
    expect(open.map((entry) => entry.kind)).toContain('INSTANCE');
    expect(
      open.some(
        (entry) =>
          entry.kind === 'ATHLETE' && entry.recipient === 'friend@example.com',
      ),
    ).toBe(true);

    await consumeInstanceInvitation(prisma, token, COACH_USER_ID);
    expect(await usableInstanceInvitation(prisma, token)).toBeNull();
    expect(
      (await admin.listInvitations()).some(
        (entry) => entry.id === link.id && entry.kind === 'INSTANCE',
      ),
    ).toBe(false);

    const other = await admin.createInvitation(me);
    await admin.revokeInvitation(me, 'INSTANCE', other.id);
    await expect(
      admin.revokeInvitation(me, 'INSTANCE', other.id),
    ).rejects.toThrow(NotFoundException);
  });

  it('says what the instance stores and what its queues have left', async () => {
    const system = await admin.system();
    expect(system.users).toBe(2);
    expect(system.activities).toBeGreaterThan(0);
    expect(system.databaseBytes).toBeGreaterThan(0);
    expect(system.queues).toEqual([
      { name: 'activity-import', waiting: 2, active: 1, delayed: 0, failed: 3 },
    ]);
  });
});
