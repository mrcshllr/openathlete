import { EventEmitter2 } from '@nestjs/event-emitter';

import { CaslAbilityFactory } from 'src/modules/auth';
import { AuthUser } from 'src/modules/auth/decorators/user.decorator';
import {
  DELETED_ATHLETE_ID,
  DELETED_USER_ID,
  accountFixtureSql,
} from 'src/modules/auth/services/account-deletion.fixture';
import { PrismaService } from 'src/modules/prisma/services/prisma.service';

import { EventService } from './event.service';

// An ESM package Jest cannot load, pulled in by the FIT import; unused here
jest.mock('@garmin/fitsdk', () => ({}));

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
if (!databaseUrl)
  throw new Error(
    'INTEGRATION_DATABASE_URL must point to a disposable test database',
  );

// The fixture's run (event 3002) keeps a device file
const RUN_EVENT_ID = 3002;

const user = (userId: number, coached: number[]) =>
  ({
    userId,
    email: `user${userId}@example.com`,
    athlete: undefined,
    coachAthletes: coached.map((athleteId) => ({ athleteId })),
  }) as unknown as AuthUser;

describe('the device file of an activity (PostgreSQL)', () => {
  let prisma: PrismaService;
  let events: EventService;
  const athlete = {
    userId: DELETED_USER_ID,
    email: 'athlete@example.com',
    athlete: { athleteId: DELETED_ATHLETE_ID },
    coachAthletes: [],
  } as unknown as AuthUser;
  const coach = user(9001, [DELETED_ATHLETE_ID]);
  const otherCoach = user(9002, [DELETED_ATHLETE_ID + 1]);

  beforeAll(async () => {
    prisma = new PrismaService({ datasourceUrl: databaseUrl });
    await prisma.$connect();
    events = new EventService(
      prisma,
      new CaslAbilityFactory(),
      new EventEmitter2(),
      {} as never,
      {} as never,
      {} as never,
      {} as never,
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
  });

  it.each([
    ['the athlete', athlete],
    ['their coach', coach],
  ])('%s sees the file on the activity and downloads it', async (_, who) => {
    const run = await events.getEventById(who, RUN_EVENT_ID);
    expect(run).toMatchObject({ originalFile: { fileType: 'FIT', size: 4 } });

    const file = await events.getEventOriginalFile(who, RUN_EVENT_ID);
    expect(file.content.toString('ascii')).toBe('.FIT');
    expect(file.fileName).toMatch(/\.fit$/);
  });

  it("refuses the file to a coach of someone else's athletes", async () => {
    await expect(
      events.getEventOriginalFile(otherCoach, RUN_EVENT_ID),
    ).rejects.toThrow('Event not found');
  });
});
