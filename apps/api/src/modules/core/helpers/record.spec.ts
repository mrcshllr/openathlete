import { computeRecords } from './record';

// Metres per degree of latitude on the sphere used by the haversine formula
const METRES_PER_DEGREE = (2 * Math.PI * 6371000) / 360;

/** A straight route north, one point per (seconds, metres) step. */
function route(steps: Step[]) {
  const time = [0];
  const latlng = [[45, 5]];
  let t = 0;
  let d = 0;
  for (const [seconds, metres] of steps) {
    t += seconds;
    d += metres;
    time.push(t);
    latlng.push([45 + d / METRES_PER_DEGREE, 5]);
  }
  return { time, latlng };
}

type Step = [seconds: number, metres: number];
const repeat = (count: number, step: Step): Step[] =>
  Array.from({ length: count }, () => step);

function speedRecords(stream: ReturnType<typeof route>) {
  return new Map(
    computeRecords(stream)
      .filter((record) => record.type === 'SPEED')
      .map((record) => [record.distance!, record.value]),
  );
}

describe('speed records', () => {
  test('finds every distance on a sparse recording', () => {
    // One point every 20 s at 5 m/s, as smart recording on a bike does
    const records = speedRecords(route(repeat(201, [20, 100])));
    expect(records.get(1000)).toBeCloseTo(200, 0);
    expect(records.get(1500)).toBeCloseTo(300, 0);
    expect(records.get(20000)).toBeCloseTo(4000, 0);
    expect(records.has(21097.5)).toBe(false);
  });

  test('does not depend on where the points fall', () => {
    // A steady 4 m/s, recorded every 1, 3 or 9 seconds
    const pattern: Step[] = [
      [3, 12],
      [9, 36],
      [1, 4],
    ];
    const records = speedRecords(
      route(repeat(400, pattern[0]).map((_, i) => pattern[i % 3])),
    );
    expect(records.size).toBeGreaterThan(5);
    for (const [distance, time] of records) {
      expect(time).toBeCloseTo(distance / 4, 3);
    }
  });

  test('finds a fast kilometre between points that miss its ends', () => {
    // 5 m/s, one point every 35 m, inside running at 3 m/s
    const records = speedRecords(
      route([
        ...repeat(100, [9, 27]),
        ...repeat(40, [7, 35]),
        ...repeat(100, [9, 27]),
      ]),
    );
    expect(records.get(1000)).toBeCloseTo(200, 3);
  });

  test('can rank a longer distance faster when a stop splits the shorter ones', () => {
    // Any 800 m includes the stop, the full 1000 m spreads it further
    const records = speedRecords(
      route([...repeat(10, [10, 50]), [120, 0], ...repeat(10, [10, 50])]),
    );
    expect(records.get(800)).toBeCloseTo(280, 3);
    expect(records.get(1000)).toBeCloseTo(320, 3);
  });
});

describe('duration records', () => {
  const durationRecords = (
    records: ReturnType<typeof computeRecords>,
    type: string,
  ) =>
    new Map(
      records
        .filter((record) => record.type === type)
        .map((record) => [record.duration!, record.value]),
    );

  test('finds the best power over each duration, without a GPS route', () => {
    // One sample per second for 10 minutes: 400 W from 60 s to 359 s
    const time = Array.from({ length: 601 }, (_, i) => i);
    const watts = time.map((t) => (t >= 60 && t < 360 ? 400 : 200));
    const power = durationRecords(computeRecords({ time, watts }), 'POWER');
    expect(power.get(5)).toBe(400);
    expect(power.get(300)).toBe(400);
    expect(power.get(600)).toBeCloseTo(300, 0);
    expect(power.has(1200)).toBe(false);
    expect(
      computeRecords({ time, watts }).every((r) => r.distance === null),
    ).toBe(true);
  });

  test('weighs samples by the time they cover', () => {
    // 300 bpm for one second, then 150 bpm sampled every 5 s
    const time = [0, 1, 6, 11, 16, 21, 26, 31];
    const heartrate = [300, 150, 150, 150, 150, 150, 150, 150];
    const records = durationRecords(
      computeRecords({ time, heartrate }),
      'HEARTRATE',
    );
    expect(records.get(30)).toBeCloseTo((300 + 150 * 29) / 30, 5);
  });

  test('counts a long gap in the samples as zero', () => {
    // 20 s at 300 W, a 10 minute dropout, then 20 s at 300 W
    const time = [
      ...Array.from({ length: 21 }, (_, i) => i),
      ...Array.from({ length: 21 }, (_, i) => 620 + i),
    ];
    const watts = time.map(() => 300);
    const power = durationRecords(computeRecords({ time, watts }), 'POWER');
    expect(power.get(15)).toBe(300);
    // At most 15 s of the dropout borrow the last sample
    expect(power.get(600)).toBeLessThan(300 * (55 / 600) + 1e-9);
  });
});

describe('grade-adjusted pace records', () => {
  // 30 minutes north at 3 m/s, the first 10 up a 10% slope: worth 1.658
  // times the speed on the flat (Minetti), so 4.97 m/s
  const time = Array.from({ length: 1801 }, (_, i) => i);
  const latlng = time.map(
    (t) => [45 + (t * 3) / 111_195, 6] as [number, number],
  );
  const altitude = time.map((t) => 500 + Math.min(t, 600) * 0.3);
  const gapTimes = (stream: object, sport = 'TRAIL_RUNNING') =>
    new Map(
      computeRecords({ time, latlng, altitude, ...stream }, sport)
        .filter((record) => record.type === 'GAP_SPEED')
        .map((record) => [record.distance!, record]),
    );

  test('times the distances of critical speed as if run on the flat', () => {
    const records = gapTimes({});
    expect([...records.keys()]).toEqual([400, 800, 5000]);
    // 400 m of ground on the climb: 133 s, worth 80 s on the flat
    expect(records.get(400)?.value).toBeGreaterThan(79.5);
    expect(records.get(400)?.value).toBeLessThan(81.5);
    expect(records.get(800)?.value).toBeGreaterThan(159);
    expect(records.get(800)?.value).toBeLessThan(163);
    // 1800 m of climb, then 3200 m of flat at 3 m/s
    expect(records.get(5000)?.value).toBeGreaterThan(1420);
    expect(records.get(5000)?.value).toBeLessThan(1440);
    // Where it happened is read in real time: on the climb
    expect(records.get(400)?.endDuration).toBeLessThanOrEqual(620);
  });

  test('is the pace itself on the flat, on runs only', () => {
    const flat = gapTimes({ altitude: time.map(() => 500) });
    expect(flat.get(400)?.value).toBeCloseTo(400 / 3, 0);
    expect(flat.get(5000)?.value).toBeCloseTo(5000 / 3, 0);
    expect(gapTimes({}, 'CYCLING').size).toBe(0);
    expect(gapTimes({ altitude: undefined }).size).toBe(0);
  });
});
