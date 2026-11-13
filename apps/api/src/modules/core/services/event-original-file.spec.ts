import { NotFoundException } from '@nestjs/common';

import { EventService } from './event.service';

jest.mock('@garmin/fitsdk', () => ({}));
jest.mock('src/modules/auth/services/casl-prisma', () => ({
  accessibleBy: () => ({ Event: { athleteId: { in: [1, 2] } } }),
}));

describe('EventService.getEventOriginalFile', () => {
  const setup = (event: unknown) => {
    const findFirst = jest.fn().mockResolvedValue(event);
    const service = Object.create(EventService.prototype) as EventService;
    Object.assign(service, {
      prisma: { event: { findFirst } },
      abilities: { getFor: jest.fn().mockResolvedValue({}) },
    });
    return { service, findFirst };
  };

  it('serves the file of an activity the user can read', async () => {
    const content = new Uint8Array([14, 16, 0, 0]);
    const { service, findFirst } = setup({
      name: 'Morning Run',
      startDate: new Date('2026-10-14T07:44:00Z'),
      activity: { file: { fileType: 'FIT', content } },
    });

    const file = await service.getEventOriginalFile({} as never, 7);

    // A coach reads their athletes' files through the same rules
    expect(findFirst.mock.calls[0][0].where.AND).toEqual([
      { eventId: 7 },
      { athleteId: { in: [1, 2] } },
    ]);
    expect(file.fileName).toBe('2026-10-14-Morning-Run.fit');
    expect([...file.content]).toEqual([14, 16, 0, 0]);
  });

  it('answers not found for an event the user cannot read', async () => {
    const { service } = setup(null);

    await expect(
      service.getEventOriginalFile({} as never, 7),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('answers not found for an activity whose file was not kept', async () => {
    const { service } = setup({
      name: 'Morning Run',
      startDate: new Date('2026-10-14T07:44:00Z'),
      activity: { file: null },
    });

    await expect(
      service.getEventOriginalFile({} as never, 7),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
