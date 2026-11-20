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

const point = (distance: number | null, duration: number | null) => ({
  distance,
  duration,
  value: 100,
  date: new Date('2026-11-01'),
  eventId: 1,
  activityName: 'Run',
});
const slot = (
  model: { critical: number; reserve: number; reliable: boolean } | null,
  missing: ('SHORT' | 'LONG')[] = [],
  pace = true,
) => ({
  model: model && { ...model, margin: 0 },
  points: model
    ? pace
      ? [point(800, null), point(5000, null)]
      : [point(null, 300), point(null, 1200)]
    : [],
  missing,
});
const models = (
  pace: ReturnType<typeof slot>,
  power: ReturnType<typeof slot>,
  focus: TrainingFocus | null,
): PerformanceModelsDto => ({
  from: new Date('2026-07-27'),
  days: 112,
  running: {
    pace,
    power,
    profile: focus ? { type: 'SPEED', position: 0.8 } : null,
    focus,
    durability: { value: 4.1, activities: 3 },
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

  it('names the focus, and shows the model on pace or on power', () => {
    state.data = models(
      slot({ critical: 4, reserve: 180, reliable: true }),
      slot({ critical: 300, reserve: 9000, reliable: true }, [], false),
      'THRESHOLD',
    );
    render();
    expect(container.querySelector('[data-focus]')?.textContent).toBe(
      'performance_focus_threshold',
    );
    expect(container.textContent).toContain('performance_critical_pace');
    expect(container.textContent).toContain('180 m');

    act(() =>
      container
        .querySelector<HTMLButtonElement>('[data-measure="power"]')
        ?.click(),
    );
    // The focus stays: critical speed names it
    expect(container.querySelector('[data-focus]')?.textContent).toBe(
      'performance_focus_threshold',
    );
    expect(container.textContent).toContain('300 W');
    expect(container.textContent).toContain('9 kJ');
  });

  it('says what is missing and plans the short test', () => {
    state.data = models(
      slot({ critical: 4, reserve: 20, reliable: false }, ['SHORT']),
      slot(null, ['SHORT', 'LONG']),
      null,
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

  it('plans the 5 km when that is what is missing', () => {
    state.data = models(
      slot(null, ['LONG']),
      slot(null, ['SHORT', 'LONG']),
      null,
    );
    render();
    expect(container.textContent).toContain('performance_missing_title_long');
    act(() =>
      container.querySelector<HTMLButtonElement>('[data-plan-test]')?.click(),
    );
    const [event] = state.mutate.mock.calls[0];
    expect(event.workout.steps[1]).toMatchObject({
      durationType: 'DISTANCE',
      durationValue: 5000,
    });
  });
});
