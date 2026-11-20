import { describe, expect, it } from 'vitest';

import {
  athleteProfile,
  fitCriticalPower,
  fitCriticalSpeed,
  isReliableSpeedModel,
  missingPowerEfforts,
  missingSpeedEfforts,
  modelValueAt,
  profilePosition,
  reserveBalance,
  trainingFocusOf,
} from './performance-model';

const powerLine = (cp: number, w: number, durations = [120, 300, 600, 1200]) =>
  durations.map((duration) => ({ duration, value: cp + w / duration }));
const speedLine = (cs: number, d: number, distances = [400, 800, 5000]) =>
  distances.map((distance) => ({ distance, value: (distance - d) / cs }));

describe('fitCriticalPower', () => {
  it('finds the line the bests lie on', () => {
    const model = fitCriticalPower(powerLine(300, 18000));
    expect(model?.critical).toBeCloseTo(300, 6);
    expect(model?.reserve).toBeCloseTo(18000, 3);
    expect(modelValueAt(model!, 600)).toBeCloseTo(330, 6);
  });

  it('keeps the best of each duration and ignores the others', () => {
    const model = fitCriticalPower([
      ...powerLine(300, 18000),
      { duration: 300, value: 200 },
      { duration: 3600, value: 900 },
    ]);
    expect(model?.critical).toBeCloseTo(300, 6);
  });

  it('needs a best on each side of the range', () => {
    expect(fitCriticalPower(powerLine(300, 18000, [600, 1200]))).toBeNull();
    expect(missingPowerEfforts(powerLine(300, 18000, [600, 1200]))).toEqual([
      'SHORT',
    ]);
    expect(missingPowerEfforts(powerLine(300, 18000, [120]))).toEqual(['LONG']);
    expect(missingPowerEfforts([])).toEqual(['SHORT', 'LONG']);
  });

  it('gives no model when the long effort beats the short one', () => {
    expect(
      fitCriticalPower([
        { duration: 120, value: 270 },
        { duration: 300, value: 280 },
        { duration: 1200, value: 300 },
      ]),
    ).toBeNull();
  });

  it('needs three bests, and says how well they agree', () => {
    expect(fitCriticalPower(powerLine(300, 18000, [120, 1200]))).toBeNull();
    expect(missingPowerEfforts(powerLine(300, 18000, [120, 1200]))).toEqual([
      'LONG',
    ]);
    expect(fitCriticalPower(powerLine(300, 18000))?.margin).toBeCloseTo(0, 6);
    const [short, ...rest] = powerLine(300, 18000);
    const scattered = fitCriticalPower([
      { ...short, value: short.value + 40 },
      ...rest,
    ]);
    expect(scattered?.margin).toBeGreaterThan(5);
  });
});

describe('fitCriticalSpeed', () => {
  it("reads CS and D' from the fastest 400 m, 800 m and 5 km", () => {
    const model = fitCriticalSpeed([
      ...speedLine(4, 136),
      // A slower 800 m, and a distance the model does not read
      { distance: 800, value: 400 },
      { distance: 1000, value: 100 },
    ]);
    expect(model?.critical).toBeCloseTo(4, 6);
    expect(model?.reserve).toBeCloseTo(136, 4);
  });

  it('needs the three distances', () => {
    expect(fitCriticalSpeed(speedLine(4, 136, [400, 5000]))).toBeNull();
    expect(missingSpeedEfforts(speedLine(4, 136, [400, 5000]))).toEqual([
      'SHORT',
    ]);
    expect(fitCriticalSpeed(speedLine(4, 136, [400, 800]))).toBeNull();
    expect(missingSpeedEfforts(speedLine(4, 136, [400, 800]))).toEqual([
      'LONG',
    ]);
    expect(missingSpeedEfforts(speedLine(4, 136, [5000]))).toEqual(['SHORT']);
  });
});

describe('profile and focus', () => {
  const model = (reserve: number) => ({ critical: 4, margin: 0, reserve });

  it("places D' among the runners of the reference: 136 m, give or take 39", () => {
    expect(athleteProfile(model(90))).toBe('ENDURANCE');
    expect(athleteProfile(model(136))).toBe('HYBRID');
    expect(athleteProfile(model(180))).toBe('SPEED');
    expect(profilePosition(model(136))).toBe(0.5);
    expect(profilePosition(model(300))).toBe(1);
    expect(profilePosition(model(10))).toBe(0);
  });

  it("doubts a D' two standard deviations under theirs", () => {
    expect(isReliableSpeedModel(model(50))).toBe(false);
    expect(isReliableSpeedModel(model(60))).toBe(true);
  });

  it('trains the short side, and endurance first when heart rate drifts', () => {
    expect(trainingFocusOf(model(180), 3)).toBe('THRESHOLD');
    expect(trainingFocusOf(model(90), null)).toBe('SHORT_INTERVALS');
    expect(trainingFocusOf(model(136), 4.9)).toBe('BALANCED');
    expect(trainingFocusOf(model(180), 5)).toBe('LONG_RUNS');
  });
});

describe('reserveBalance', () => {
  const model = { critical: 300, margin: 0, reserve: 18000 };
  const time = Array.from({ length: 241 }, (_, i) => i);

  it('empties above the critical value, by the work done over it', () => {
    const balance = reserveBalance(
      time,
      time.map(() => 400),
      model,
    );
    expect(balance[0]).toBe(1);
    // 100 W over for 90 s is half the reserve; all of it after 180 s
    expect(balance[90]).toBeCloseTo(0.5, 6);
    expect(balance[180]).toBe(0);
    expect(balance[240]).toBe(0);
  });

  it('recovers below it, the slower the fuller it is', () => {
    const watts = time.map((t) => (t < 90 ? 400 : 100));
    const balance = reserveBalance(time, watts, model);
    const first = balance[100] - balance[90];
    const later = balance[240] - balance[230];
    expect(first).toBeGreaterThan(later);
    expect(balance[240]).toBeGreaterThan(0.5);
    expect(balance[240]).toBeLessThan(1);
  });

  it('stays full below the critical value, and rests over a pause', () => {
    expect(
      reserveBalance(
        time,
        time.map(() => 250),
        model,
      ).every((b) => b === 1),
    ).toBe(true);
    // 400 W written before a 10-minute pause: not held through it
    expect(
      reserveBalance([0, 1, 601, 602], [400, 400, 400, 400], model)[2],
    ).toBeGreaterThan(0.99);
  });
});
