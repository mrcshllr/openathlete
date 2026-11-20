// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  RECORD_TYPE,
  RecordExclusionDto,
  SPORT_TYPE,
} from '@openathlete/shared';

import { RecordExclusionsCard } from './records-side-cards';

// Every message renders as its key
vi.mock('@/paraglide/messages', () => ({
  m: new Proxy({}, { get: (_target, key) => () => String(key) }),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const exclusion = {
  recordExclusionId: 1,
  eventId: 10,
  activityName: 'Track session',
  date: new Date('2026-10-20T07:00:00Z'),
  type: RECORD_TYPE.SPEED,
  distance: 1000,
  duration: null,
} as unknown as RecordExclusionDto;
const dateFormat = new Intl.DateTimeFormat('en', { timeZone: 'UTC' });

let container: HTMLDivElement;
let root: Root;
const onRestore = vi.fn();

function render(exclusions: RecordExclusionDto[]) {
  root = createRoot(container);
  act(() =>
    root.render(
      <RecordExclusionsCard
        exclusions={exclusions}
        sport={SPORT_TYPE.RUNNING}
        dateFormat={dateFormat}
        onRestore={onRestore}
      />,
    ),
  );
}
const trigger = () =>
  container.querySelector<HTMLButtonElement>('button[aria-expanded]');
const listed = () => container.textContent?.includes('Track session') ?? false;

beforeEach(() => {
  localStorage.clear();
  onRestore.mockClear();
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('RecordExclusionsCard', () => {
  it('lists the exclusions until it is folded, and says how many', () => {
    render([exclusion]);
    expect(listed()).toBe(true);
    expect(trigger()?.textContent).toContain('records_exclusions 1');

    act(() => trigger()?.click());
    expect(trigger()?.getAttribute('aria-expanded')).toBe('false');
    expect(listed()).toBe(false);

    act(() => trigger()?.click());
    expect(listed()).toBe(true);
  });

  it('stays folded on the next visit', () => {
    render([exclusion]);
    act(() => trigger()?.click());
    act(() => root.unmount());

    render([exclusion]);
    expect(trigger()?.getAttribute('aria-expanded')).toBe('false');
    expect(listed()).toBe(false);
  });

  it('restores from the open list', () => {
    render([exclusion]);
    const restore = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'records_restore',
    );
    act(() => restore?.click());
    expect(onRestore).toHaveBeenCalledWith(exclusion);
  });

  it('has nothing to fold when nothing is excluded', () => {
    render([]);
    expect(trigger()).toBeNull();
    expect(container.textContent).toContain('records_exclusions_empty');
  });
});
