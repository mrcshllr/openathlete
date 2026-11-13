import axios from 'axios';

import { ConfigService } from '@nestjs/config';

import type { ProviderAccount } from '@openathlete/database';
import type { ApiEnvSchemaType } from '@openathlete/shared';

import { ActivityFileParserService } from '../../core/helpers/activity-file-parser.service';
import { PrismaService } from '../../prisma/services/prisma.service';
import { QueueService } from '../../queue/queue.service';
import { ProviderRateLimitError } from '../errors/provider-rate-limit.error';
import { SuuntoProviderService } from './suunto.provider.service';

// The FIT SDK is ESM, which Jest cannot load
jest.mock('../../core/helpers/activity-file-parser.service', () => ({
  ActivityFileParserService: class {},
}));
jest.mock('axios', () => {
  const actual = jest.requireActual<typeof import('axios')>('axios');
  return {
    __esModule: true,
    ...actual,
    default: { ...actual.default, get: jest.fn() },
  };
});

const get = axios.get as jest.Mock;

const account = {
  providerAccountId: 7,
  athleteId: 3,
  provider: 'SUUNTO',
  status: 'active',
  accessToken: 'token',
  // Far from expiring: no refresh
  expiresAt: new Date(Date.now() + 3600_000),
  importMetricsEnabled: false,
} as unknown as ProviderAccount;

function workout(key: string, startTime: number) {
  return { workoutKey: key, startTime, totalTime: 600, activityId: 1 };
}

function setup(saved: unknown[] = []) {
  const prisma = {
    providerAccount: { findUnique: jest.fn().mockResolvedValue(account) },
    eventActivity: { findMany: jest.fn().mockResolvedValue(saved) },
    event: { update: jest.fn() },
  };
  const queue = {
    addActivityImportJobs: jest.fn(),
    addSuuntoMetricsJob: jest.fn(),
  };
  const service = new SuuntoProviderService(
    prisma as unknown as PrismaService,
    { get: () => 'key' } as unknown as ConfigService<ApiEnvSchemaType, true>,
    queue as unknown as QueueService,
    {} as ActivityFileParserService,
  );
  return { service, queue, prisma };
}

function quotaError() {
  return Object.assign(new Error('Too Many Requests'), {
    isAxiosError: true,
    response: { status: 429, headers: { 'retry-after': '120' } },
  });
}

describe('SuuntoProviderService history import', () => {
  beforeEach(() => get.mockReset());

  it('lists the whole history, with no date to start from', async () => {
    const { service, queue } = setup();
    const tenYearsAgo = Date.now() - 10 * 365 * 24 * 3600_000;
    get.mockResolvedValueOnce({
      data: { error: null, payload: [workout('old', tenYearsAgo)] },
    });

    const result = await service.queueFullImport(account);

    expect(get.mock.calls[0][1].params).not.toHaveProperty('since');
    expect(queue.addActivityImportJobs).toHaveBeenCalledWith(
      account,
      [expect.objectContaining({ externalId: 'old' })],
      true,
    );
    expect(result).toEqual({ queuedActivities: 1, backfillRequested: false });
  });

  it('lists the last months only when asked, and says the rest is left', async () => {
    const { service } = setup();
    const since = new Date(Date.now() - 90 * 24 * 3600_000);
    get.mockResolvedValueOnce({ data: { error: null, payload: [] } });

    const result = await service.queueFullImport(account, { since });

    expect(get.mock.calls[0][1].params.since).toBe(since.getTime());
    expect(result).toEqual({ queuedActivities: 0, partial: true });
  });

  it('reads every page of the history', async () => {
    const { service, queue } = setup();
    const page = Array.from({ length: 50 }, (_, i) =>
      workout(`w${i}`, Date.now() - i * 24 * 3600_000),
    );
    get
      .mockResolvedValueOnce({ data: { error: null, payload: page } })
      .mockResolvedValueOnce({
        data: { error: null, payload: [workout('last', 1_000_000)] },
      });

    await service.queueFullImport(account);

    expect(get.mock.calls.map((call) => call[1].params.offset)).toEqual([
      0, 50,
    ]);
    expect(queue.addActivityImportJobs.mock.calls[0][1]).toHaveLength(51);
  });

  it('waits for the quota instead of ending with a part of the history', async () => {
    const { service, queue } = setup();
    get.mockRejectedValueOnce(quotaError());

    const error = await service.queueFullImport(account).catch((e) => e);

    expect(error).toBeInstanceOf(ProviderRateLimitError);
    expect((error as ProviderRateLimitError).retryAfterMs).toBe(120_000);
    expect(queue.addActivityImportJobs).not.toHaveBeenCalled();
  });

  it('names an activity after the title written in the Suunto app', async () => {
    const { service, queue } = setup();
    get.mockResolvedValueOnce({
      data: {
        error: null,
        payload: [
          {
            ...workout('titled', Date.now()),
            workoutName: 'Trail running',
            description: '  Zugspitze über Höllental \n zweite Zeile',
          },
          { ...workout('plain', Date.now()), workoutName: 'Running' },
        ],
      },
    });

    await service.queueFullImport(account);

    expect(
      queue.addActivityImportJobs.mock.calls[0][1].map(
        (activity: { name: string }) => activity.name,
      ),
    ).toEqual(['Zugspitze über Höllental', 'Running']);
  });

  it('gives the title to an activity saved under the name of Suunto, not to a renamed one', async () => {
    const { service, prisma } = setup([
      { externalId: 'generic', eventId: 11, event: { name: 'Trail running' } },
      { externalId: 'renamed', eventId: 12, event: { name: 'Mein Lauf' } },
    ]);
    const titled = (key: string) => ({
      ...workout(key, Date.now()),
      workoutName: 'Trail running',
      description: 'Zugspitze über Höllental',
    });
    get.mockResolvedValueOnce({
      data: { error: null, payload: [titled('generic'), titled('renamed')] },
    });

    await service.queueFullImport(account);

    expect(prisma.event.update.mock.calls).toEqual([
      [{ where: { eventId: 11 }, data: { name: 'Zugspitze über Höllental' } }],
    ]);
  });
});
