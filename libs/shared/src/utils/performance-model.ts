/**
 * The critical power model, read from an athlete's best efforts, and what it
 * says about where training should focus. Selfhost only for now.
 *
 * Sources:
 * - Monod H, Scherrer J. The work capacity of a synergic muscular group.
 *   Ergonomics 1965;8(3):329-338: work done to exhaustion grows linearly with
 *   time, W = W' + CP x t. CP is the power that can be held for long, W' the
 *   work available above it.
 * - Smyth B, Muniz-Pumares D. Calculation of critical speed from raw training
 *   data in recreational marathon runners. Med Sci Sports Exerc
 *   2020;52(12):2637-2645, doi:10.1249/MSS.0000000000002412: the same line
 *   fitted to the fastest grade-adjusted efforts found in ordinary training
 *   gives a critical speed (CS, with D' in metres) that predicts marathon
 *   pace; starting above 94% of CS goes with slowing down later.
 * - Skiba PF, Fulford J, Clarke DC, Vanhatalo A, Jones AM. Intramuscular
 *   determinants of the ability to recover work capacity above critical
 *   power. Eur J Appl Physiol 2015;115(4):703-713: the balance of W' during
 *   an effort (W'bal), spent above CP and recovered below it.
 * - Riegel PS. Athletic records and human endurance. American Scientist
 *   1981;69(3):285-290: t2 = t1 x (d2 / d1)^1.06, for races longer than the
 *   model's 20 minutes.
 */

/** The model holds between about 2 and 20 minutes: the bests it is read from */
export const PERFORMANCE_MODEL_DURATIONS = [120, 300, 600, 1200] as const;
/** One best at most this long and one at least this long, or no model */
export const PERFORMANCE_MODEL_SHORT = 300;
export const PERFORMANCE_MODEL_LONG = 600;

export interface ModelEffort {
  /** Seconds */
  duration: number;
  /** Average watts, or metres per second */
  value: number;
}

export interface CriticalModel {
  /** CP in watts, or CS in metres per second */
  critical: number;
  /** W' in joules, or D' in metres */
  reserve: number;
}

export type ModelGap = 'SHORT' | 'LONG';

/** The efforts the model is read from: the best of each of its durations */
export function modelEfforts<T extends ModelEffort>(efforts: T[]): T[] {
  return PERFORMANCE_MODEL_DURATIONS.flatMap((duration) => {
    const best = efforts
      .filter((effort) => effort.duration === duration && effort.value > 0)
      .sort((a, b) => b.value - a.value)[0];
    return best ? [best] : [];
  });
}

/** Which end of the range has no best: short, long, or none missing */
export function missingModelEfforts(efforts: ModelEffort[]): ModelGap[] {
  const used = modelEfforts(efforts);
  const gaps: ModelGap[] = [];
  if (!used.some((effort) => effort.duration <= PERFORMANCE_MODEL_SHORT))
    gaps.push('SHORT');
  if (!used.some((effort) => effort.duration >= PERFORMANCE_MODEL_LONG))
    gaps.push('LONG');
  return gaps;
}

/**
 * CP and W' (or CS and D') by least squares on work against time. Null
 * without a best on each side of the range, or when the bests give no
 * sensible line: a long effort stronger than a short one says the short one
 * was not all out.
 */
export function fitCriticalModel(efforts: ModelEffort[]): CriticalModel | null {
  const used = modelEfforts(efforts);
  if (used.length < 2 || missingModelEfforts(efforts).length > 0) return null;
  const n = used.length;
  const meanT = used.reduce((sum, e) => sum + e.duration, 0) / n;
  const meanW = used.reduce((sum, e) => sum + e.value * e.duration, 0) / n;
  let covariance = 0;
  let variance = 0;
  for (const effort of used) {
    const dt = effort.duration - meanT;
    covariance += dt * (effort.value * effort.duration - meanW);
    variance += dt * dt;
  }
  if (variance === 0) return null;
  const critical = covariance / variance;
  const reserve = meanW - critical * meanT;
  if (!(critical > 0) || !(reserve > 0)) return null;
  return { critical, reserve };
}

/** Power or speed the model holds for a duration within its range */
export function modelValueAt(model: CriticalModel, seconds: number): number {
  return model.critical + model.reserve / seconds;
}

/**
 * Seconds the reserve lasts at twice the critical value: W' / CP, the same
 * for power and pace, so one scale places both.
 */
export function reserveSeconds(model: CriticalModel): number {
  return model.reserve / model.critical;
}

export const ATHLETE_PROFILE = ['SPEED', 'HYBRID', 'ENDURANCE'] as const;
export type AthleteProfile = (typeof ATHLETE_PROFILE)[number];

/**
 * Where the reserve in seconds places an athlete between an endurance and a
 * speed profile. The idea follows the speed reserve of Sandford, Laursen &
 * Buchheit (Sports Med 2021;51:2017-2028); these two limits are NOT from a
 * study: they are a working assumption for this instance, to be replaced by
 * published reference values before the feature is proposed upstream.
 */
export const PROFILE_LIMITS = { endurance: 40, speed: 70 };
/** The ends of the scale the web draws */
export const PROFILE_SCALE = { min: 15, max: 100 };

/**
 * A reserve shorter than this says the short bests were not all out: the
 * line is then too flat to place the athlete. A working assumption, like
 * the limits above.
 */
export const MIN_RESERVE_SECONDS = 15;

export function isReliableModel(model: CriticalModel): boolean {
  return reserveSeconds(model) >= MIN_RESERVE_SECONDS;
}

export function athleteProfile(model: CriticalModel): AthleteProfile {
  const seconds = reserveSeconds(model);
  if (seconds < PROFILE_LIMITS.endurance) return 'ENDURANCE';
  if (seconds > PROFILE_LIMITS.speed) return 'SPEED';
  return 'HYBRID';
}

/** 0 at the endurance end of the scale, 1 at the speed end */
export function profilePosition(model: CriticalModel): number {
  const { min, max } = PROFILE_SCALE;
  return Math.min(1, Math.max(0, (max - reserveSeconds(model)) / (max - min)));
}

export const TRAINING_FOCUS = [
  'LONG_RUNS',
  'THRESHOLD',
  'SHORT_INTERVALS',
  'BALANCED',
] as const;
export type TrainingFocus = (typeof TRAINING_FOCUS)[number];

/**
 * Heart rate drifting more than this against pace or power on steady runs
 * marks limited aerobic endurance: Friel's 5% (TrainingPeaks, "Aerobic
 * endurance and decoupling").
 */
export const DURABILITY_LIMIT = 5;

/**
 * What to train: endurance first when heart rate drifts on long steady
 * runs, else the side of the profile that is short. A large reserve over a
 * low threshold asks for threshold work and volume; a small reserve for
 * short, fast intervals.
 */
export function trainingFocusOf(
  model: CriticalModel,
  durability: number | null,
): TrainingFocus {
  if (durability !== null && durability > DURABILITY_LIMIT) return 'LONG_RUNS';
  const profile = athleteProfile(model);
  if (profile === 'SPEED') return 'THRESHOLD';
  if (profile === 'ENDURANCE') return 'SHORT_INTERVALS';
  return 'BALANCED';
}

export const RIEGEL_RACE_EXPONENT = 1.06;
/** The share of critical speed a marathon should not start above (Smyth) */
export const MARATHON_START_SHARE = 0.94;
export const RACE_DISTANCES = [5000, 10000, 21097.5, 42195] as const;

/**
 * Race times from a critical speed model. 5 km straight from the model when
 * it takes at most its 20 minutes, else from the model's 20 minutes; the
 * longer races from the 5 km by Riegel's formula.
 */
export function racePredictions(
  model: CriticalModel,
): { distance: number; seconds: number }[] {
  const longest = PERFORMANCE_MODEL_DURATIONS[3];
  const direct = (5000 - model.reserve) / model.critical;
  const anchor =
    direct <= longest
      ? { distance: 5000, seconds: direct }
      : {
          distance: modelValueAt(model, longest) * longest,
          seconds: longest,
        };
  return RACE_DISTANCES.map((distance) => ({
    distance,
    seconds:
      anchor.seconds * (distance / anchor.distance) ** RIEGEL_RACE_EXPONENT,
  }));
}

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
