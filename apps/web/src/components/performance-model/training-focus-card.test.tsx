// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PerformanceModelsDto, TrainingFocus } from '@openathlete/shared';

import { TrainingFocusCard } from './training-focus-card';

const state = vi.hoisted(() => ({
  data: undefined as unknown,
  mutate: vi.fn(),
}));
vi.mock('@/api/record', () => ({
  useGetPerformanceModelsQuery: () => ({ data: state.data, isLoading: false }),
}));
vi.mock('@/api/event', () => ({
  useCreateEventMutation: () => ({ mutate: state.mutate, isPending: false }),
}));
vi.mock('../garmin-attribution/garmin-attribution', () => ({
  GarminAttribution: () => null,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// Every message renders as its key
vi.mock('@/paraglide/messages', () => ({
  m: new Proxy({}, { get: (_target, key) => () => String(key) }),
}));
vi.mock('@/paraglide/runtime', () => ({ getLocale: () => 'en' }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const point = (duration: number, value: number) => ({
  duration,
  value,
  date: new Date('2026-11-01'),
  eventId: 1,
  activityName: 'Run',
});
const model = (critical: number, reserve: number, reliable = true) => ({
  critical,
  reserve,
  reserveSeconds: reserve / critical,
  reliable,
  profile: 'SPEED' as const,
  profilePosition: 0.2,
  focus: 'THRESHOLD' as TrainingFocus,
  points: [point(300, critical + reserve / 300), point(1200, critical)],
});
const slot = (
  value: ReturnType<typeof model> | null,
  missing: ('SHORT' | 'LONG')[] = [],
) => ({
  model: value,
  points: value?.points ?? [],
  missing,
});
const models = (
  pace: ReturnType<typeof slot>,
  power: ReturnType<typeof slot>,
): PerformanceModelsDto => ({
  from: new Date('2026-08-18'),
  days: 90,
  running: {
    pace,
    power,
    durability: { value: 4.1, activities: 3 },
    predictions: [],
    marathonStartSpeed: null,
  },
  cycling: { power: slot(null, ['SHORT', 'LONG']) },
});

describe('TrainingFocusCard', () => {
  let container: HTMLDivElement;
  let root: Root;
  const render = () =>
    act(() =>
      root.render(
        <MemoryRouter>
          <TrainingFocusCard />
        </MemoryRouter>,
      ),
    );

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('names the focus from the pace model, and from power on request', () => {
    state.data = models(
      slot(model(4, 320)),
      slot({ ...model(300, 9000), focus: 'SHORT_INTERVALS' }),
    );
    render();
    expect(container.querySelector('[data-focus]')?.textContent).toBe(
      'performance_focus_threshold',
    );
    expect(container.textContent).toContain('performance_critical_pace');
    expect(container.textContent).toContain('320 m');

    act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-measure="power"]')
        ?.click(),
    );
    expect(container.querySelector('[data-focus]')?.textContent).toBe(
      'performance_focus_short_intervals',
    );
    expect(container.textContent).toContain('300 W');
    expect(container.textContent).toContain('9 kJ');
  });

  it('starts on power for an athlete with no pace bests', () => {
    state.data = models(slot(null, ['SHORT', 'LONG']), slot(model(300, 18000)));
    render();
    expect(
      container
        .querySelector('[data-measure="power"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('says what is missing and plans the short test', () => {
    state.data = models(
      slot(model(4, 20, false), ['SHORT']),
      slot(null, ['SHORT', 'LONG']),
    );
    render();
    expect(container.querySelector('[data-focus]')).toBeNull();
    expect(container.textContent).toContain('performance_missing_title_short');
    expect(container.textContent).toContain('performance_unreliable_text');
    expect(container.textContent).toContain('performance_bucket_doubted');

    act(() =>
      container.querySelector<HTMLButtonElement>('[data-plan-test]')?.click(),
    );
    const [event] = state.mutate.mock.calls[0];
    expect(event).toMatchObject({
      type: 'TRAINING',
      sport: 'RUNNING',
      goalDuration: 900 + 180 + 600,
    });
    expect(
      event.workout.steps.map(
        (s: { durationValue: number }) => s.durationValue,
      ),
    ).toEqual([900, 180, 600]);
  });
});
