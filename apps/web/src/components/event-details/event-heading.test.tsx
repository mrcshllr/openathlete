// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityEvent, EVENT_TYPE } from '@openathlete/shared';

import { EventHeading } from './event-heading';
import { originalFileName } from './original-file-name';

const api = vi.hoisted(() => ({ getEventOriginalFile: vi.fn() }));
vi.mock('@/api/event/event.api', () => ({ EventAPI: api }));
vi.mock('../sport-icon/sport-icon', () => ({ SportIcon: () => null }));
// Every message renders as its key, followed by its parameters.
vi.mock('@/paraglide/messages', () => ({
  m: new Proxy(
    {},
    {
      get: (_target, key) => (params?: Record<string, unknown>) =>
        [String(key), ...Object.values(params ?? {})].join(' '),
    },
  ),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const activity = (overrides: Partial<ActivityEvent> = {}) =>
  ({
    eventId: 7,
    type: EVENT_TYPE.ACTIVITY,
    name: 'Morning Run',
    startDate: new Date('2026-10-14T07:44:00Z'),
    provider: 'SUUNTO',
    externalId: 'abc',
    ...overrides,
  }) as ActivityEvent;

describe('EventHeading original file', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    api.getEventOriginalFile.mockReset();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const downloadButton = () =>
    [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('activity_original_file_download'),
    );

  it('offers the download only for an activity whose file was kept', () => {
    act(() => root.render(<EventHeading event={activity()} />));
    expect(downloadButton()).toBeUndefined();

    act(() =>
      root.render(
        <EventHeading
          event={activity({ originalFile: { fileType: 'FIT', size: 1024 } })}
        />,
      ),
    );
    expect(downloadButton()).toBeDefined();
  });

  it('downloads the file of the activity', async () => {
    api.getEventOriginalFile.mockResolvedValue(new Blob(['fit']));
    URL.createObjectURL = vi.fn(() => 'blob:fit');
    URL.revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});
    act(() =>
      root.render(
        <EventHeading
          event={activity({ originalFile: { fileType: 'FIT', size: 1024 } })}
        />,
      ),
    );

    await act(async () => downloadButton()!.click());

    expect(api.getEventOriginalFile).toHaveBeenCalledWith(7);
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it('names the file after the day and the activity', () => {
    expect(
      originalFileName({
        name: 'Länger Lauf / Zürich!',
        startDate: new Date('2026-01-06T07:00:00Z'),
        originalFile: { fileType: 'FIT', size: 1 },
      }),
    ).toBe('2026-01-06-Langer-Lauf-Zurich.fit');
  });
});
