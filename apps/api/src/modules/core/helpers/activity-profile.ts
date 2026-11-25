import { ActivityProfileKind } from '@openathlete/database';
import {
  ActivityStream,
  SPORT_TYPE,
  smoothAltitude,
} from '@openathlete/shared';

export interface ProfileBin {
  kind: ActivityProfileKind;
  bin: number;
  seconds: number;
  value: number;
}

const RUNNING = new Set<string>([SPORT_TYPE.RUNNING, SPORT_TYPE.TRAIL_RUNNING]);
const CYCLING = new Set<string>([
  SPORT_TYPE.CYCLING,
  SPORT_TYPE.GRAVEL_RIDE,
  SPORT_TYPE.MOUNTAIN_BIKE_RIDE,
]);
/** Sports where slope decides the pace, on top of running and cycling */
const CLIMBING = new Set<string>([
  SPORT_TYPE.HIKING,
  SPORT_TYPE.BACKCOUNTRY_SKI,
  SPORT_TYPE.NORDIC_SKI,
  SPORT_TYPE.ROLLER_SKI,
  SPORT_TYPE.SNOWSHOE,
]);

/** Slope is read over this distance: shorter, it is altitude noise */
const GRADE_SEGMENT_M = 50;
const MAX_GRADE_PERCENT = 25;
const MIN_MOVING_SPEED = 0.3;
/** Heart rate lags behind the first minutes of an effort */
const HEART_RATE_WARMUP_S = 5 * 60;
const SPEED_BANDS_PER_KMH = 2;
const POWER_BAND_W = 10;
/** Shorter outings say nothing of how an effort holds */
const DRIFT_MIN_SECONDS = 60 * 60;

/** Vertical speed by slope, over stretches of about 50 m in motion */
function gradeBins(stream: ActivityStream): ProfileBin[] {
  const { time, distance, altitude } = stream;
  if (!time?.length || !distance?.length || !altitude?.length) return [];
  const n = Math.min(time.length, distance.length, altitude.length);
  const smooth = smoothAltitude(altitude.slice(0, n), distance.slice(0, n));

  const bins = new Map<number, { seconds: number; vertical: number }>();
  let start = 0;
  for (let i = 1; i < n; i++) {
    const metres = distance[i] - distance[start];
    if (metres < GRADE_SEGMENT_M) continue;
    const seconds = time[i] - time[start];
    const climbed = smooth[i] - smooth[start];
    if (seconds > 0 && metres / seconds >= MIN_MOVING_SPEED) {
      const percent = Math.round((climbed / metres) * 100);
      if (percent !== 0 && Math.abs(percent) <= MAX_GRADE_PERCENT) {
        const bin = bins.get(percent) ?? { seconds: 0, vertical: 0 };
        bin.seconds += seconds;
        bin.vertical += Math.abs(climbed);
        bins.set(percent, bin);
      }
    }
    start = i;
  }
  return [...bins].map(([bin, { seconds, vertical }]) => ({
    kind: 'GRADE',
    bin,
    seconds,
    value: (vertical / seconds) * 3600,
  }));
}

/** Mean heart rate at each output: speed adjusted for slope, or power */
function outputBins(
  stream: ActivityStream,
  kind: 'SPEED' | 'POWER',
  output: number[],
  band: (value: number) => number,
): ProfileBin[] {
  const { time, heartrate } = stream;
  if (!time?.length || !heartrate?.length) return [];
  const bins = new Map<number, { seconds: number; beats: number }>();
  const n = Math.min(time.length, heartrate.length, output.length);
  for (let i = 0; i < n - 1; i++) {
    const seconds = time[i + 1] - time[i];
    if (
      time[i] - time[0] < HEART_RATE_WARMUP_S ||
      !(seconds > 0) ||
      !(heartrate[i] > 0) ||
      !(output[i] > 0)
    ) {
      continue;
    }
    const key = band(output[i]);
    const bin = bins.get(key) ?? { seconds: 0, beats: 0 };
    bin.seconds += seconds;
    bin.beats += heartrate[i] * seconds;
    bins.set(key, bin);
  }
  return [...bins].map(([bin, { seconds, beats }]) => ({
    kind,
    bin,
    seconds,
    value: beats / seconds,
  }));
}

/** A band counts in a half of the outing with this much time */
const MATCHED_BAND_SECONDS = 60;
/** Time the two halves need at the same outputs */
const MATCHED_MIN_SECONDS = 10 * 60;
/**
 * Bands below this share of the outing's brisk output (its 90th percentile
 * by time) are walking or standing: heart rate there follows what came
 * before, not the output
 */
const MATCHED_FLOOR_SHARE = 0.5;

/**
 * How much heart rate rose at the same output from the first half of a long
 * outing to the second, in percent. Whole-outing decoupling compares a climb
 * with the descent that follows it on a mountain run; matching the bands of
 * output keeps the terrain out of the comparison.
 */
function matchedDrift(
  stream: ActivityStream,
  output: number[],
  band: (value: number) => number,
): ProfileBin[] {
  const { time, heartrate } = stream;
  if (!time?.length || !heartrate?.length) return [];
  const n = Math.min(time.length, heartrate.length, output.length);
  const start = time[0] + HEART_RATE_WARMUP_S;
  const end = time[n - 1];
  if (end - time[0] < DRIFT_MIN_SECONDS) return [];
  const middle = (start + end) / 2;

  type Half = { seconds: number; beats: number };
  const bands = new Map<number, [Half, Half]>();
  for (let i = 0; i < n - 1; i++) {
    const seconds = time[i + 1] - time[i];
    if (
      time[i] < start ||
      !(seconds > 0) ||
      !(heartrate[i] > 0) ||
      !(output[i] > 0)
    ) {
      continue;
    }
    const key = band(output[i]);
    const halves = bands.get(key) ?? [
      { seconds: 0, beats: 0 },
      { seconds: 0, beats: 0 },
    ];
    const half = halves[time[i] < middle ? 0 : 1];
    half.seconds += seconds;
    half.beats += heartrate[i] * seconds;
    bands.set(key, halves);
  }

  const sorted = [...bands].sort(([a], [b]) => a - b);
  const total = sorted.reduce(
    (sum, [, [first, second]]) => sum + first.seconds + second.seconds,
    0,
  );
  let passed = 0;
  let brisk = 0;
  for (const [key, [first, second]] of sorted) {
    passed += first.seconds + second.seconds;
    brisk = key;
    if (passed >= total * 0.9) break;
  }

  let weight = 0;
  let rise = 0;
  let base = 0;
  for (const [key, [first, second]] of sorted) {
    if (
      key < brisk * MATCHED_FLOOR_SHARE ||
      first.seconds < MATCHED_BAND_SECONDS ||
      second.seconds < MATCHED_BAND_SECONDS
    ) {
      continue;
    }
    const shared = Math.min(first.seconds, second.seconds);
    const early = first.beats / first.seconds;
    weight += shared;
    base += shared * early;
    rise += shared * (second.beats / second.seconds - early);
  }
  if (weight < MATCHED_MIN_SECONDS || base <= 0) return [];
  return [
    {
      kind: 'DRIFT_MATCHED',
      bin: 0,
      seconds: weight,
      value: (rise / base) * 100,
    },
  ];
}

/** Time-weighted mean of a series between two moments */
function meanBetween(
  values: number[],
  time: number[],
  from: number,
  to: number,
): number | null {
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < Math.min(values.length, time.length) - 1; i++) {
    if (time[i] < from || time[i] >= to || !(values[i] > 0)) continue;
    const seconds = time[i + 1] - time[i];
    if (!(seconds > 0)) continue;
    sum += values[i] * seconds;
    weight += seconds;
  }
  return weight > 0 ? sum / weight : null;
}

/** How much a series moved from the first third of an outing to the last */
function drift(
  kind: ActivityProfileKind,
  values: number[] | undefined,
  time: number[],
  /** -1 when a drop is what degrades, as for speed */
  sign: 1 | -1,
): ProfileBin[] {
  if (!values?.length) return [];
  const start = time[0];
  const seconds = time[time.length - 1] - start;
  if (seconds < DRIFT_MIN_SECONDS) return [];
  const first = meanBetween(values, time, start, start + seconds / 3);
  const last = meanBetween(values, time, start + (seconds * 2) / 3, Infinity);
  if (!first || !last) return [];
  return [
    { kind, bin: 0, seconds, value: sign * ((last - first) / first) * 100 },
  ];
}

/** Summarises a recording. Slope stays out of a sport it does not shape. */
export function activityProfile(
  stream: ActivityStream,
  sport: string,
): ProfileBin[] {
  const { time, gap, watts, heartrate } = stream;
  const running = RUNNING.has(sport);
  const cycling = CYCLING.has(sport);
  if (!running && !cycling && !CLIMBING.has(sport)) return [];
  const riding = cycling && !!watts?.some((value) => value > 0);
  // Running power already includes climbing: heart rate against it reads
  // on trails, where grade-adjusted speed is at its weakest
  const powered = running && !!watts?.some((value) => value > 0);
  return [
    ...gradeBins(stream),
    ...(running && gap
      ? outputBins(stream, 'SPEED', gap, (speed) =>
          Math.floor(speed * 3.6 * SPEED_BANDS_PER_KMH),
        )
      : []),
    ...(riding || powered
      ? outputBins(stream, 'POWER', watts!, (power) =>
          Math.floor(power / POWER_BAND_W),
        )
      : []),
    ...(time?.length && (running || cycling)
      ? [
          ...(running ? drift('DRIFT_PACE', gap, time, -1) : []),
          ...(riding ? drift('DRIFT_POWER', watts, time, -1) : []),
          ...drift('DRIFT_HEARTRATE', heartrate, time, 1),
        ]
      : []),
    // On power where there is some, as for the bands: it holds on slopes
    ...(riding || powered
      ? matchedDrift(stream, watts!, (power) =>
          Math.floor(power / POWER_BAND_W),
        )
      : running && gap
        ? matchedDrift(stream, gap, (speed) =>
            Math.floor(speed * 3.6 * SPEED_BANDS_PER_KMH),
          )
        : []),
  ];
}
