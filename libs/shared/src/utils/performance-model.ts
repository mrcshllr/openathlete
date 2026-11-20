/**
 * The critical speed and critical power models, read from an athlete's best
 * efforts, and what they say about where running training should focus.
 * Every figure shown from them (statistics, dashboard, activity) is computed
 * here, and has its entry in the metric registry.
 *
 * Sources:
 * - Monod H, Scherrer J. The work capacity of a synergic muscular group.
 *   Ergonomics 1965;8(3):329-338: work done to exhaustion grows linearly with
 *   time, W = W' + CP x t. CP is the power that can be held for long, W' the
 *   work available above it.
 * - Smyth B, Muniz-Pumares D. Calculation of critical speed from raw training
 *   data in recreational marathon runners. Med Sci Sports Exerc
 *   2020;52(12):2637-2645, doi:10.1249/MSS.0000000000002412. 25,000 runners,
 *   16 weeks of training: the same line, distance against time, fitted to
 *   the fastest grade-adjusted (Minetti 2002) efforts over set distances.
 *   Their best model reads 400, 800 and 5,000 m: CS 3.69 +/- 0.57 m/s,
 *   D' 136 +/- 39 m, marathon time predicted with R2 = 0.695 and an error
 *   of 7.67%. Marathons were run at 84.8% of CS on average, and a first half
 *   above 94% of CS went with slowing down by over 25% in the second.
 * - Skiba PF, Fulford J, Clarke DC, Vanhatalo A, Jones AM. Intramuscular
 *   determinants of the ability to recover work capacity above critical
 *   power. Eur J Appl Physiol 2015;115(4):703-713: the balance of W' during
 *   an effort (W'bal), spent above CP and recovered below it.
 * - Sandford GN, Laursen PB, Buchheit M. Anaerobic speed/power reserve and
 *   sport performance. Sports Med 2021;51(10):2017-2028: profile athletes
 *   between speed and endurance, and tailor the training to the profile.
 * - Friel J. Aerobic endurance and decoupling (TrainingPeaks): heart rate
 *   drifting under 5% against pace on a steady run shows aerobic endurance
 *   (decouplingLevel).
 */
import { decouplingLevel } from './activity-decoupling';

/** Days of training the models read, the 16 weeks of Smyth & Muniz-Pumares */
export const PERFORMANCE_MODEL_DAYS = 112;
/** The distances of their best critical speed model, in metres */
export const CRITICAL_SPEED_DISTANCES = [400, 800, 5000] as const;
/** Critical power holds between about 2 and 20 minutes: the bests it reads */
export const CRITICAL_POWER_DURATIONS = [120, 300, 600, 1200] as const;
export const CRITICAL_POWER_SHORT = 300;
export const CRITICAL_POWER_LONG = 600;

/** Efforts a fit needs: with fewer, nothing says how well they agree */
export const CRITICAL_MODEL_MIN_EFFORTS = 3;

/** Two-sided 95% Student's t, by degrees of freedom */
const T_95 = [12.71, 4.3, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26, 2.23];

export interface CriticalModel {
  /** CP in watts, or CS in metres per second */
  critical: number;
  /** Half width of its 95% interval, same unit */
  margin: number;
  /** W' in joules, or D' in metres */
  reserve: number;
}

export type ModelGap = 'SHORT' | 'LONG';

/**
 * Least squares of work (joules, or metres) against seconds. The efforts are
 * bests from training, not maximal tests: the result is at most what they
 * show, and the interval says how well they agree.
 */
function fitLine(
  points: { seconds: number; work: number }[],
): CriticalModel | null {
  const n = points.length;
  if (n < CRITICAL_MODEL_MIN_EFFORTS) return null;
  const meanT = points.reduce((sum, p) => sum + p.seconds, 0) / n;
  const meanW = points.reduce((sum, p) => sum + p.work, 0) / n;
  let covariance = 0;
  let variance = 0;
  for (const point of points) {
    covariance += (point.seconds - meanT) * (point.work - meanW);
    variance += (point.seconds - meanT) ** 2;
  }
  if (variance === 0) return null;
  const critical = covariance / variance;
  const reserve = meanW - critical * meanT;
  // A long effort stronger than a short one: the short one was not all out
  if (critical <= 0 || reserve <= 0) return null;
  const residual = points.reduce(
    (sum, p) => sum + (p.work - reserve - critical * p.seconds) ** 2,
    0,
  );
  const standardError = Math.sqrt(residual / (n - 2) / variance);
  const t = T_95[Math.min(n - 3, T_95.length - 1)];
  return { critical, margin: t * standardError, reserve };
}

export interface PowerEffortPoint {
  /** Seconds */
  duration: number;
  /** Average watts */
  value: number;
}

/** The best of each duration critical power is read from */
export function criticalPowerEfforts<T extends PowerEffortPoint>(
  efforts: T[],
): T[] {
  return CRITICAL_POWER_DURATIONS.flatMap((duration) => {
    const best = efforts
      .filter((effort) => effort.duration === duration && effort.value > 0)
      .sort((a, b) => b.value - a.value)[0];
    return best ? [best] : [];
  });
}

export function missingPowerEfforts(efforts: PowerEffortPoint[]): ModelGap[] {
  const used = criticalPowerEfforts(efforts);
  const gaps: ModelGap[] = [];
  if (!used.some((effort) => effort.duration <= CRITICAL_POWER_SHORT))
    gaps.push('SHORT');
  if (!used.some((effort) => effort.duration >= CRITICAL_POWER_LONG))
    gaps.push('LONG');
  if (gaps.length === 0 && used.length < CRITICAL_MODEL_MIN_EFFORTS)
    gaps.push('LONG');
  return gaps;
}

/** CP and W' from the bests of 2 to 20 minutes, three of them at least */
export function fitCriticalPower(
  efforts: PowerEffortPoint[],
): CriticalModel | null {
  if (missingPowerEfforts(efforts).length > 0) return null;
  return fitLine(
    criticalPowerEfforts(efforts).map((effort) => ({
      seconds: effort.duration,
      work: effort.value * effort.duration,
    })),
  );
}

export interface SpeedEffortPoint {
  /** Metres */
  distance: number;
  /** Grade-adjusted seconds over that distance */
  value: number;
}

/** The fastest of each distance critical speed is read from */
export function criticalSpeedEfforts<T extends SpeedEffortPoint>(
  efforts: T[],
): T[] {
  return CRITICAL_SPEED_DISTANCES.flatMap((distance) => {
    const best = efforts
      .filter((effort) => effort.distance === distance && effort.value > 0)
      .sort((a, b) => a.value - b.value)[0];
    return best ? [best] : [];
  });
}

/** SHORT without the 400 or the 800 m, LONG without the 5,000 m */
export function missingSpeedEfforts(efforts: SpeedEffortPoint[]): ModelGap[] {
  const used = criticalSpeedEfforts(efforts);
  const gaps: ModelGap[] = [];
  if (used.filter((effort) => effort.distance < 5000).length < 2)
    gaps.push('SHORT');
  if (!used.some((effort) => effort.distance === 5000)) gaps.push('LONG');
  return gaps;
}

/** CS and D' from the fastest 400, 800 and 5,000 m: distance against time */
export function fitCriticalSpeed(
  efforts: SpeedEffortPoint[],
): CriticalModel | null {
  if (missingSpeedEfforts(efforts).length > 0) return null;
  return fitLine(
    criticalSpeedEfforts(efforts).map((effort) => ({
      seconds: effort.value,
      work: effort.distance,
    })),
  );
}

/** Power or speed the model holds for a duration within its range */
export function modelValueAt(model: CriticalModel, seconds: number): number {
  return model.critical + model.reserve / seconds;
}

/** D' of the runners of Smyth & Muniz-Pumares, best model, in metres */
export const D_PRIME_REFERENCE = { mean: 136, sd: 39 };

export const ATHLETE_PROFILE = ['SPEED', 'HYBRID', 'ENDURANCE'] as const;
export type AthleteProfile = (typeof ATHLETE_PROFILE)[number];

const dPrimeScore = (model: CriticalModel) =>
  (model.reserve - D_PRIME_REFERENCE.mean) / D_PRIME_REFERENCE.sd;

/**
 * A D' more than two standard deviations under those runners' says the
 * short bests were not all out: the line is too flat to place the athlete.
 */
export function isReliableSpeedModel(model: CriticalModel): boolean {
  return dPrimeScore(model) >= -2;
}

/**
 * Where D' places a runner among those runners: more than one standard
 * deviation above their mean is a large reserve (a speed profile), more
 * than one below a small one (an endurance profile).
 */
export function athleteProfile(model: CriticalModel): AthleteProfile {
  const score = dPrimeScore(model);
  if (score > 1) return 'SPEED';
  if (score < -1) return 'ENDURANCE';
  return 'HYBRID';
}

/** 0 at the endurance end of the scale, 1 at the speed end: +/- 2 SD */
export function profilePosition(model: CriticalModel): number {
  return Math.min(1, Math.max(0, (dPrimeScore(model) + 2) / 4));
}

export const TRAINING_FOCUS = [
  'LONG_RUNS',
  'THRESHOLD',
  'SHORT_INTERVALS',
  'BALANCED',
] as const;
export type TrainingFocus = (typeof TRAINING_FOCUS)[number];

/**
 * What the profile is short of, following Sandford et al.'s advice to fit
 * the training to it: aerobic endurance first when heart rate drifts on
 * steady runs (Friel), else the threshold for a large reserve over a
 * comparatively low critical speed, and the reserve for a small one.
 */
export function trainingFocusOf(
  model: CriticalModel,
  decouplingPercent: number | null,
): TrainingFocus {
  if (
    decouplingPercent !== null &&
    decouplingLevel(decouplingPercent) !== 'steady'
  )
    return 'LONG_RUNS';
  const profile = athleteProfile(model);
  if (profile === 'SPEED') return 'THRESHOLD';
  if (profile === 'ENDURANCE') return 'SHORT_INTERVALS';
  return 'BALANCED';
}

/** The share of critical speed a marathon should not start above (Smyth) */
export const MARATHON_START_SHARE = 0.94;

/**
 * The reserve left at each sample of an effort, as a share of the whole
 * (1 full, 0 empty): spent above the critical value, recovered below it the
 * faster the further below and the emptier the reserve (Skiba 2015). A
 * sample stands for the time to the next one, pauses of over 15 s as rest.
 */
export function reserveBalance(
  time: number[],
  values: (number | null | undefined)[],
  model: CriticalModel,
): number[] {
  const n = Math.min(time.length, values.length);
  const balance: number[] = [];
  let left = model.reserve;
  for (let i = 0; i < n; i++) {
    balance.push(Math.max(0, left) / model.reserve);
    if (i + 1 >= n) break;
    const dt = time[i + 1] - time[i];
    if (!(dt > 0)) continue;
    const raw = values[i];
    // A long gap is a pause: nothing was produced
    const value = dt > 15 || !Number.isFinite(raw) ? 0 : (raw as number);
    const over = value - model.critical;
    left =
      over > 0
        ? left - over * dt
        : left + -over * dt * (1 - Math.max(0, left) / model.reserve);
    left = Math.min(model.reserve, Math.max(0, left));
  }
  return balance;
}
