import { ProviderOAuthController } from './provider-oauth.controller';

// The provider services load ESM-only SDKs
jest.mock('../providers', () => ({
  CorosProviderService: class {},
  SuuntoProviderService: class {},
}));
jest.mock('../providers/garmin.provider.service', () => ({
  GarminProviderService: class {},
}));
jest.mock('../providers/polar.provider.service', () => ({
  PolarProviderService: class {},
}));
jest.mock('../providers/strava.provider.service', () => ({
  StravaProviderService: class {},
  hasStravaWriteScope: () => true,
}));

function setup(account: Record<string, unknown>) {
  const update = jest.fn();
  const addFullImportJob = jest.fn();
  const controller = Object.create(
    ProviderOAuthController.prototype,
  ) as ProviderOAuthController;
  Object.assign(controller, {
    prisma: { providerAccount: { update } },
    queueService: { addFullImportJob },
    getProviderAccountForUser: jest.fn().mockResolvedValue({
      account: {
        providerAccountId: 7,
        importActivitiesEnabled: true,
        fullImportRequestedAt: null,
        fullImportCompletedAt: null,
        ...account,
      },
    }),
  });
  return { controller, update, addFullImportJob };
}

const completed = {
  fullImportRequestedAt: new Date('2026-11-13T15:45:00Z'),
  fullImportCompletedAt: new Date('2026-11-13T15:46:00Z'),
};

describe('ProviderOAuthController.importAllActivities', () => {
  it('leaves a completed import alone', async () => {
    const { controller, addFullImportJob } = setup(completed);

    await expect(
      controller.importAllActivities({} as never, 'suunto', {}),
    ).resolves.toEqual({
      success: true,
      message: 'Full import already completed',
    });
    expect(addFullImportJob).not.toHaveBeenCalled();
  });

  it('runs a completed import again when asked', async () => {
    const { controller, update, addFullImportJob } = setup(completed);

    await expect(
      controller.importAllActivities({} as never, 'suunto', { again: true }),
    ).resolves.toEqual({ success: true, queued: true });

    expect(update.mock.calls[0][0].data.fullImportCompletedAt).toBeNull();
    expect(addFullImportJob).toHaveBeenCalledWith(7, { since: undefined });
  });
});
