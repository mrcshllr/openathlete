// @vitest-environment jsdom
import { act } from 'react';
import type { ReactNode } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityEvent, EVENT_TYPE } from '@openathlete/shared';

import { ActivityDownloadMenu } from './activity-download-menu';
import { originalFileName } from './original-file-name';

const state = vi.hoisted(() => ({
  stream: undefined as unknown,
  native: false,
  getEventGpx: vi.fn(),
  getEventOriginalFile: vi.fn(),
  getEventFit: vi.fn(),
  downloadFile: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('@/api/event', () => ({
  useGetEventStreamQuery: () => ({ data: state.stream }),
}));
vi.mock('@/api/event/event.api', () => ({
  EventAPI: {
    getEventGpx: state.getEventGpx,
    getEventOriginalFile: state.getEventOriginalFile,
    getEventFit: state.getEventFit,
  },
}));
vi.mock('@/utils/capacitor', () => ({ isCapacitor: () => state.native }));
vi.mock('@/utils/csv', () => ({ downloadFile: state.downloadFile }));
vi.mock('sonner', () => ({ toast: { error: state.toastError } }));
// Every message renders as its key
vi.mock('@/paraglide/messages', () => ({
  m: new Proxy({}, { get: (_target, key) => () => String(key) }),
}));
// The menu rendered open: Radix opens on pointer events jsdom lacks
vi.mock('../ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => (
    <>{children}</>
  ),
  DropdownMenuContent: ({ children }: { children: ReactNode }) => (
    <div role="menu">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    disabled,
    onClick,
    ...rest
  }: {
    children: ReactNode;
    disabled?: boolean;
    onClick?: () => void;
  }) => (
    <button type="button" disabled={disabled} onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const track = { time: [0, 1], latlng: [[47.5, 11.1], []] };
const indoor = { time: [0, 1] };
const activity = (extra: Partial<ActivityEvent> = {}) =>
  ({
    eventId: 7,
    type: EVENT_TYPE.ACTIVITY,
    name: 'Morning Run',
    startDate: new Date(2026, 9, 14, 7, 44),
    ...extra,
  }) as ActivityEvent;
const kept = { originalFile: { fileType: 'FIT', size: 1024 } };

describe('ActivityDownloadMenu', () => {
  let container: HTMLDivElement;
  let root: Root;
  const render = (event: ActivityEvent) =>
    act(() => root.render(<ActivityDownloadMenu event={event} />));
  const item = (kind: 'fit' | 'gpx') =>
    container.querySelector<HTMLButtonElement>(`[data-download-${kind}]`);

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    state.native = false;
    state.stream = undefined;
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('shows nothing without a file, a recording or a track', () => {
    render(activity());
    expect(container.querySelector('[data-activity-download]')).toBeNull();
  });

  it('offers both downloads when the file was kept and there is a track', () => {
    state.stream = track;
    render(activity(kept));
    expect(item('fit')?.disabled).toBe(false);
    expect(item('gpx')?.disabled).toBe(false);
  });

  it('writes the FIT file from the recording when the device file was not kept', async () => {
    state.stream = track;
    const written = new Blob(['written']);
    state.getEventFit.mockResolvedValue(written);
    render(activity());
    expect(item('fit')?.disabled).toBe(false);
    expect(item('fit')?.textContent).not.toContain(
      'activity_download_fit_missing',
    );

    await act(async () => item('fit')?.click());
    expect(state.getEventOriginalFile).not.toHaveBeenCalled();
    expect(state.getEventFit).toHaveBeenCalledWith(7);
    expect(state.downloadFile).toHaveBeenCalledWith(
      '2026-10-14-Morning-Run.fit',
      written,
    );
  });

  it('offers a FIT file without GPS, as for a treadmill run', () => {
    state.stream = indoor;
    render(activity());
    expect(item('fit')?.disabled).toBe(false);
    expect(item('gpx')?.disabled).toBe(true);
  });

  it('greys out the FIT file of an activity with no file and no recording', () => {
    state.stream = { latlng: [[47.5, 11.1]] };
    render(activity());
    expect(item('fit')?.disabled).toBe(true);
    expect(item('fit')?.textContent).toContain('activity_download_fit_missing');
    expect(item('gpx')?.disabled).toBe(false);
  });

  it('greys out the GPX track of an activity without GPS', () => {
    render(activity(kept));
    expect(item('gpx')?.disabled).toBe(true);
    expect(item('fit')?.disabled).toBe(false);
  });

  it('downloads each file under the activity day and name', async () => {
    state.stream = track;
    const fit = new Blob(['fit']);
    const gpx = new Blob(['gpx']);
    state.getEventOriginalFile.mockResolvedValue(fit);
    state.getEventGpx.mockResolvedValue(gpx);
    render(activity(kept));

    await act(async () => item('fit')?.click());
    await act(async () => item('gpx')?.click());

    expect(state.getEventOriginalFile).toHaveBeenCalledWith(7);
    expect(state.getEventFit).not.toHaveBeenCalled();
    expect(state.getEventGpx).toHaveBeenCalledWith(7);
    expect(state.downloadFile).toHaveBeenNthCalledWith(
      1,
      '2026-10-14-Morning-Run.fit',
      fit,
    );
    expect(state.downloadFile).toHaveBeenNthCalledWith(
      2,
      '2026-10-14-Morning-Run.gpx',
      gpx,
    );
  });

  it('says so when a download fails', async () => {
    state.stream = track;
    state.getEventOriginalFile.mockRejectedValue(new Error('404'));
    render(activity(kept));
    await act(async () => item('fit')?.click());
    expect(state.toastError).toHaveBeenCalledWith(
      'activity_original_file_failed',
    );
    expect(state.downloadFile).not.toHaveBeenCalled();
  });

  it('stays out of the native apps', () => {
    state.native = true;
    state.stream = track;
    render(activity(kept));
    expect(container.querySelector('[data-activity-download]')).toBeNull();
  });
});

describe('originalFileName', () => {
  it('takes the local day, like the GPX track', () => {
    expect(
      originalFileName({
        name: 'Trail – Heimgarten!',
        startDate: new Date(2026, 10, 18, 23, 30),
        originalFile: { fileType: 'FIT', size: 1 },
      }),
    ).toBe('2026-11-18-Trail-Heimgarten.fit');
  });
});
