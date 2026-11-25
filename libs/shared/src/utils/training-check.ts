/**
 * The training check: does the training work? A few questions, each answered
 * by comparing the last weeks with the weeks before, and left open rather
 * than answered on too little.
 *
 * Sources:
 * - Heart rate at a given submaximal output falls as endurance improves, and
 *   follows it from one's usual runs, without a test: Buchheit M (2014),
 *   Front Physiol 5:73, doi:10.3389/fphys.2014.00073; Vesterinen V et al.
 *   (2014), J Strength Cond Res 28(4):902-908,
 *   doi:10.1519/JSC.0000000000000349; Shushan T et al. (2023), Sports Med
 *   Open 9:21, doi:10.1186/s40798-023-00564-w.
 * - A change counts once it is larger than the noise of the measure:
 *   Hopkins WG (2004), Sportscience 8:1-7; Buchheit (2014) above. Half the
 *   athlete's own spread between runs is our reading of it, not a figure
 *   of theirs.
 * - Smallest worthwhile changes of performance run from about 0.3 to 1 % of
 *   power (Hopkins 2004): a critical speed or power read from training moves
 *   by more than 1 % before it counts here.
 * - Drift of heart rate against output on long runs as durability: Maunder E
 *   et al. (2021), Sports Med 51:1619-1628; Smyth B et al. (2022), Sports
 *   Med 52:2283-2295, doi:10.1007/s40279-022-01680-5. They read it on
 *   marathons, on the flat. Comparing heart rate at the same output between
 *   the two halves of a run is our way to carry it to mountain runs, where
 *   a climb followed by its descent would otherwise read as drift.
 */

/** Each window: the last six weeks, and the six before */
export const CHECK_WINDOW_DAYS = 42;
/** Runs a window needs before it is compared */
export const CHECK_MIN_RUNS = 4;
/** Long runs are rarer: two a window */
export const CHECK_MIN_LONG_RUNS = 2;
/** A change counts beyond this share of the spread between runs */
export const CHECK_NOISE_SHARE = 0.5;
/** A critical speed or power counts as moved beyond this share */
export const CHECK_MODEL_CHANGE = 0.01;
/** A long run: an hour or more */
export const CHECK_LONG_RUN_SECONDS = 60 * 60;

/** A band of output counts with these runs in each window */
const MIN_BAND_RUNS = 2;
/** Time a run needs in such bands */
const MIN_RUN_SECONDS = 10 * 60;
/**
 * Bands below this share of the athlete's brisk output (the 90th percentile
 * of the bands by time) are walking or standing: heart rate there follows
 * what came before, not the output
 */
const FLOOR_SHARE = 0.5;

export type CheckStatus = 'BETTER' | 'SAME' | 'WORSE' | 'OPEN';

export interface CheckComparison {
  status: CheckStatus;
  /** Mean of the last window, null without a value */
  current: number | null;
  previous: number | null;
  /** Spread between single values, both windows pooled */
  noise: number | null;
  /** Values in the last window, and in the one before */
  counts: [number, number];
}

const mean = (values: number[]) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

const squares = (values: number[], centre: number) =>
  values.reduce((sum, value) => sum + (value - centre) ** 2, 0);

/**
 * Compares the values of two windows. Open with too few of them; the same
 * when the means differ by less than a share of the spread between single
 * values, so that noise is not read as progress.
 */
export function compareWindows(
  current: number[],
  previous: number[],
  {
    higherIsBetter,
    minCount = CHECK_MIN_RUNS,
  }: { higherIsBetter: boolean; minCount?: number },
): CheckComparison {
  const now = mean(current);
  const before = mean(previous);
  const counts: [number, number] = [current.length, previous.length];
  if (
    now === null ||
    before === null ||
    current.length < minCount ||
    previous.length < minCount
  ) {
    return {
      status: 'OPEN',
      current: now,
      previous: before,
      noise: null,
      counts,
    };
  }
  const freedom = current.length + previous.length - 2;
  const noise =
    freedom > 0
      ? Math.sqrt((squares(current, now) + squares(previous, before)) / freedom)
      : 0;
  const change = now - before;
  const status: CheckStatus =
    change === 0 || Math.abs(change) <= CHECK_NOISE_SHARE * noise
      ? 'SAME'
      : change > 0 === higherIsBetter
        ? 'BETTER'
        : 'WORSE';
  return { status, current: now, previous: before, noise, counts };
}

/** Compares a critical speed or power with the one of six weeks before */
export function compareModels(
  current: number | null,
  previous: number | null,
): CheckStatus {
  if (!current || !previous) return 'OPEN';
  const change = current / previous - 1;
  if (Math.abs(change) <= CHECK_MODEL_CHANGE) return 'SAME';
  return change > 0 ? 'BETTER' : 'WORSE';
}

export interface CardiacBand {
  activityId: number;
  /** In the last window, or the one before */
  current: boolean;
  /** Band of output: a slice of speed or of power */
  band: number;
  seconds: number;
  /** Mean heart rate of the run in the band */
  heartrate: number;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** The band below which 90 % of the time was spent; bands start at zero */
function briskBand(bands: CardiacBand[]): number {
  const seconds = new Map<number, number>();
  let total = 0;
  for (const row of bands) {
    seconds.set(row.band, (seconds.get(row.band) ?? 0) + row.seconds);
    total += row.seconds;
  }
  let passed = 0;
  for (const [band, time] of [...seconds].sort(([a], [b]) => a - b)) {
    passed += time;
    if (passed >= total * 0.9) return band;
  }
  return 0;
}

/**
 * Heart rate of each run against the athlete's usual one at the same output,
 * in beats a minute: negative when the heart beat slower than usual. Bands
 * are compared one by one, since heart rate rises with output and an easy
 * week would otherwise read as fitness. Only bands run in both windows
 * count, above walking pace, and runs with enough time in them.
 */
export function cardiacScores(bands: CardiacBand[]): {
  current: number[];
  previous: number[];
  /** The band with the most time, to name the output the answer is about */
  referenceBand: number | null;
} {
  const floor = briskBand(bands) * FLOOR_SHARE;
  const byBand = new Map<number, CardiacBand[]>();
  for (const row of bands) {
    if (row.band < floor) continue;
    byBand.set(row.band, [...(byBand.get(row.band) ?? []), row]);
  }
  const usual = new Map<number, number>();
  let referenceBand: number | null = null;
  let most = 0;
  for (const [band, rows] of byBand) {
    const now = rows.filter((row) => row.current).length;
    if (now < MIN_BAND_RUNS || rows.length - now < MIN_BAND_RUNS) continue;
    usual.set(band, median(rows.map((row) => row.heartrate)));
    const seconds = rows.reduce((sum, row) => sum + row.seconds, 0);
    if (seconds > most) {
      most = seconds;
      referenceBand = band;
    }
  }

  const runs = new Map<
    number,
    { current: boolean; seconds: number; beats: number }
  >();
  for (const row of bands) {
    const reference = usual.get(row.band);
    if (reference === undefined) continue;
    const run = runs.get(row.activityId) ?? {
      current: row.current,
      seconds: 0,
      beats: 0,
    };
    run.seconds += row.seconds;
    run.beats += (row.heartrate - reference) * row.seconds;
    runs.set(row.activityId, run);
  }
  const scores = { current: [] as number[], previous: [] as number[] };
  for (const run of runs.values()) {
    if (run.seconds < MIN_RUN_SECONDS) continue;
    scores[run.current ? 'current' : 'previous'].push(run.beats / run.seconds);
  }
  return { ...scores, referenceBand };
}
