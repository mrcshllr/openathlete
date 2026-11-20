// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SPORT_TYPE, TRAINING_ZONE_TYPE } from '@openathlete/shared';

import { TrainingZonesCard } from './training-zones-card';

// Every message renders as its key
vi.mock('@/paraglide/messages', () => ({
  m: new Proxy({}, { get: (_target, key) => () => String(key) }),
}));

const state = vi.hoisted(() => ({
  zones: [] as { id: number; name: string; min: number; max: number }[],
  calls: [] as unknown[][],
}));
vi.mock('@/hooks/use-training-zones', () => ({
  useTrainingZones: (...args: unknown[]) => {
    state.calls.push(args);
    return state.zones;
  },
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe('TrainingZonesCard', () => {
  let container: HTMLDivElement;
  let root: Root;
  const render = (
    type: TRAINING_ZONE_TYPE.POWER | TRAINING_ZONE_TYPE.HEARTRATE,
  ) =>
    act(() =>
      root.render(
        <TrainingZonesCard
          type={type}
          sport={SPORT_TYPE.RUNNING}
          athleteId={7}
        />,
      ),
    );

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    state.calls = [];
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("lists the athlete's power zones for the sport, in watts", () => {
    state.zones = [
      { id: 1, name: 'Z1', min: 0, max: 248 },
      { id: 2, name: 'Z2', min: 249, max: 279.6 },
    ];
    render(TRAINING_ZONE_TYPE.POWER);
    expect(state.calls[0]).toEqual([
      TRAINING_ZONE_TYPE.POWER,
      SPORT_TYPE.RUNNING,
      7,
    ]);
    expect(container.textContent).toContain('records_power_zones');
    expect(container.textContent).toContain('249 – 280 watts');
    expect(container.textContent).toContain('records_zones_help');
  });

  it('says when the heart rate zones are the default ones', () => {
    state.zones = [{ id: -1, name: 'Z1', min: 0, max: 131 }];
    render(TRAINING_ZONE_TYPE.HEARTRATE);
    expect(container.textContent).toContain('records_heartrate_zones');
    expect(container.textContent).toContain('0 – 131 bpm');
    expect(container.textContent).toContain('records_zones_default');
  });

  it('says when there are no zones of that kind', () => {
    state.zones = [];
    render(TRAINING_ZONE_TYPE.POWER);
    expect(container.textContent).toContain('records_zones_empty');
    expect(container.querySelector('table')).toBeNull();
  });
});
