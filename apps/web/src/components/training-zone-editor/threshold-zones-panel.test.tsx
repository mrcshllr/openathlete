// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TRAINING_ZONE_TYPE } from '@openathlete/shared';

import { ThresholdZonesPanel } from './threshold-zones-panel';
import { formatPace } from './zone-profiles';

const data = vi.hoisted(() => ({
  modeled: { ftpRunning: { value: 318 }, ftpCycling: null } as unknown,
  metrics: { FTP_RUNNING: { value: 310 } } as unknown,
  economy: { value: 80, activities: 7, days: 90 } as unknown,
}));
vi.mock('@/api/record', () => ({
  useGetModeledMetricsQuery: () => ({ data: data.modeled }),
  useGetRunningEconomyQuery: () => ({ data: data.economy }),
}));
vi.mock('@/api/metric', () => ({
  useGetLatestMetricsQuery: () => ({ data: data.metrics }),
}));
vi.mock('@/utils/label-map/core/metric-type.label-map', () => ({
  metricTypeLabelMap: { FTP_RUNNING: 'FTP run', FTP_CYCLING: 'FTP bike' },
}));
// Every message renders as its key, followed by its parameters
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

describe('ThresholdZonesPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const button = (text: string) =>
    [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes(text),
    )!;

  it('sets power zones from the modelled FTP', () => {
    const onApply = vi.fn();
    act(() =>
      root.render(
        <ThresholdZonesPanel
          athleteId={1}
          type={TRAINING_ZONE_TYPE.POWER}
          sports={['RUNNING']}
          currentCount={5}
          onApply={onApply}
        />,
      ),
    );
    act(() => button('zones_threshold_open').click());
    expect(
      button('zones_threshold_source_entered FTP run 310 W'),
    ).toBeDefined();
    act(() => button('zones_threshold_source_modeled FTP run 318 W').click());
    act(() => button('zones_threshold_apply').click());

    const zones = onApply.mock.calls[0][0];
    expect(zones).toHaveLength(5);
    expect(zones[3]).toMatchObject({ min: 305, max: 323 });
  });

  it('turns the entered FTP into a threshold pace with the flat runs', () => {
    const onApply = vi.fn();
    act(() =>
      root.render(
        <ThresholdZonesPanel
          athleteId={1}
          type={TRAINING_ZONE_TYPE.PACE}
          sports={['RUNNING']}
          currentCount={5}
          onApply={onApply}
        />,
      ),
    );
    act(() => button('zones_threshold_open').click());
    expect(container.textContent).toContain('zones_threshold_economy 80 7 90');
    // 310 W at 80 J/m: 3.875 m/s, 4:18/km
    act(() =>
      button('zones_threshold_source_entered FTP run 310 W → 4:18/km').click(),
    );
    act(() => button('zones_threshold_apply').click());

    const zones = onApply.mock.calls[0][0];
    expect(formatPace(zones[3].min)).toBe('4:18');
  });

  it('waits for a threshold heart rate', () => {
    const onApply = vi.fn();
    act(() =>
      root.render(
        <ThresholdZonesPanel
          athleteId={1}
          type={TRAINING_ZONE_TYPE.HEARTRATE}
          sports={['RUNNING']}
          currentCount={5}
          onApply={onApply}
        />,
      ),
    );
    act(() => button('zones_threshold_open').click());
    expect(button('zones_threshold_apply').disabled).toBe(true);
    expect(container.textContent).toContain('zones_threshold_hr_help');
  });

  it('offers the running power models, merged into five by default', () => {
    const onApply = vi.fn();
    act(() =>
      root.render(
        <ThresholdZonesPanel
          athleteId={1}
          type={TRAINING_ZONE_TYPE.POWER}
          sports={['RUNNING']}
          currentCount={5}
          onApply={onApply}
        />,
      ),
    );
    act(() => button('zones_threshold_open').click());
    expect(button('Steve Palladino')).toBeDefined();
    expect(button('Jim Vance')).toBeDefined();
    expect(button('Andrew Coggan')).toBeUndefined();
    act(() => button('Steve Palladino').click());
    act(() => button('zones_threshold_source_modeled FTP run 318 W').click());
    act(() => button('zones_threshold_apply').click());
    const zones = onApply.mock.calls[0][0];
    expect(zones).toHaveLength(5);
    // Zone 5 from 106 % of 318 W
    expect(zones[4].min).toBe(337);
  });

  it('keeps the original zones on request, and says the count changes', () => {
    const onApply = vi.fn();
    act(() =>
      root.render(
        <ThresholdZonesPanel
          athleteId={1}
          type={TRAINING_ZONE_TYPE.POWER}
          sports={['RUNNING']}
          currentCount={5}
          onApply={onApply}
        />,
      ),
    );
    act(() => button('zones_threshold_open').click());
    act(() => button('Steve Palladino').click());
    expect(container.textContent).not.toContain('zones_model_count_change');
    act(() => button('zones_model_original 10').click());
    expect(container.textContent).toContain('zones_model_count_change 5 10 5');
    act(() => button('zones_threshold_source_modeled FTP run 318 W').click());
    act(() => button('zones_threshold_apply').click());
    const zones = onApply.mock.calls[0][0];
    expect(zones).toHaveLength(10);
    expect(zones.map((zone: { name: string }) => zone.name)[1]).toBe(
      'zones_model_zone_name 1B',
    );
  });
});
