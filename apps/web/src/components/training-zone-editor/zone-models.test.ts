import { describe, expect, it } from 'vitest';

import { SPORT_TYPE, TRAINING_ZONE_TYPE } from '@openathlete/shared';

import { zoneModelChoices, zoneModelSport } from './zone-models';

const authors = (type: TRAINING_ZONE_TYPE, sports: string[]) =>
  zoneModelChoices(type, sports).map(
    ({ model, table }) => `${model.id}${table.sport ? `-${table.sport}` : ''}`,
  );

describe('zoneModelChoices', () => {
  it('offers running power the models made for it', () => {
    expect(authors(TRAINING_ZONE_TYPE.POWER, [SPORT_TYPE.RUNNING])).toEqual([
      'arend',
      'palladino-run',
      'vance-run',
      'stryd-run',
    ]);
  });

  it("offers cycling power Friel's and Coggan's zones", () => {
    expect(authors(TRAINING_ZONE_TYPE.POWER, [SPORT_TYPE.GRAVEL_RIDE])).toEqual(
      ['arend', 'friel-bike', 'coggan-bike'],
    );
  });

  it('offers heart rate by sport, and everything for a mixed set', () => {
    expect(
      authors(TRAINING_ZONE_TYPE.HEARTRATE, [SPORT_TYPE.TRAIL_RUNNING]),
    ).toEqual(['arend', 'friel-run']);
    expect(
      authors(TRAINING_ZONE_TYPE.HEARTRATE, [
        SPORT_TYPE.RUNNING,
        SPORT_TYPE.CYCLING,
      ]),
    ).toEqual(['arend', 'friel-run', 'friel-bike', 'coggan-bike']);
  });

  it('offers pace the running models', () => {
    expect(authors(TRAINING_ZONE_TYPE.PACE, [SPORT_TYPE.RUNNING])).toEqual([
      'arend',
      'friel-run',
    ]);
  });
});

describe('zoneModelSport', () => {
  it('reads a set of sports as running, cycling or both', () => {
    expect(zoneModelSport([SPORT_TYPE.RUNNING, SPORT_TYPE.VIRTUAL_RUN])).toBe(
      'run',
    );
    expect(zoneModelSport([SPORT_TYPE.MOUNTAIN_BIKE_RIDE])).toBe('bike');
    expect(zoneModelSport([SPORT_TYPE.RUNNING, SPORT_TYPE.CYCLING])).toBeNull();
    expect(zoneModelSport([SPORT_TYPE.SWIMMING])).toBeNull();
  });
});
