import { ProviderExportScheduler } from './scheduler.service';

jest.mock('./export.service', () => ({ ProviderExportService: class {} }));

describe('ProviderExportScheduler after a start', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const setup = (importEnabled: boolean) => {
    const scheduler = new ProviderExportScheduler(
      {} as never,
      {} as never,
      { get: () => importEnabled } as never,
    );
    const sync = jest
      .spyOn(scheduler, 'syncExportsForWindow')
      .mockResolvedValue(undefined);
    return { scheduler, sync };
  };

  it('syncs the week once, a minute after the worker starts', () => {
    const { scheduler, sync } = setup(true);
    scheduler.onApplicationBootstrap();

    jest.advanceTimersByTime(59_000);
    expect(sync).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1_000);
    expect(sync).toHaveBeenCalledTimes(1);
  });

  it('leaves the API container out, as the daily sync does', () => {
    const { scheduler, sync } = setup(false);
    scheduler.onApplicationBootstrap();

    jest.advanceTimersByTime(120_000);
    expect(sync).not.toHaveBeenCalled();
  });
});
