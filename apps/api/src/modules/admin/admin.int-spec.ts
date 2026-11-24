import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ApiEnvSchemaType } from '@openathlete/shared';

import { AuthUser } from 'src/modules/auth/decorators/user.decorator';
import {
  COACH_USER_ID,
  DELETED_USER_ID,
  accountFixtureSql,
} from 'src/modules/auth/services/account-deletion.fixture';
import { InstanceSettingsService } from 'src/modules/auth/services/instance-settings.service';
import { PrismaService } from 'src/modules/prisma/services/prisma.service';

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
  let settings: InstanceSettingsService;
  let admin: AdminService;
  const me = { userId: DELETED_USER_ID } as AuthUser;

  beforeAll(async () => {
    prisma = new PrismaService({ datasourceUrl: databaseUrl });
    await prisma.$connect();
    settings = new InstanceSettingsService(prisma, config);
    admin = new AdminService(prisma, settings);
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
});
