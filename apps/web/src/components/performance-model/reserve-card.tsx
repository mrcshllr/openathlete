import { useGetPerformanceModelsQuery } from '@/api/record';
import { m } from '@/paraglide/messages';
import { useMemo } from 'react';

import {
  ActivityStream,
  CriticalModel,
  SPORT_TYPE,
  formatDuration,
  reserveBalance,
} from '@openathlete/shared';

import { MetricInfo } from '../statistics/metric-info';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Measure, formatCritical, formatPercent } from './model-format';

const RUNNING = new Set<string>([SPORT_TYPE.RUNNING, SPORT_TYPE.TRAIL_RUNNING]);
const CYCLING = new Set<string>([
  SPORT_TYPE.CYCLING,
  SPORT_TYPE.VIRTUAL_RIDE,
  SPORT_TYPE.GRAVEL_RIDE,
  SPORT_TYPE.MOUNTAIN_BIKE_RIDE,
]);
/** An effort that never used a tenth of the reserve has nothing to show */
const WORTH_SHOWING = 0.9;
const WIDTH = 600;
const HEIGHT = 120;

interface P {
  stream: ActivityStream;
  sport: SPORT_TYPE;
  athleteId?: number;
}

/**
 * How far the effort emptied the reserve above critical power or
 * critical speed, and how it came back in the recoveries (W'bal, Skiba
 * 2015), with the athlete's model of today.
 */
export function ReserveCard({ stream, sport, athleteId }: P) {
  const { data } = useGetPerformanceModelsQuery(athleteId);

  const result = useMemo(() => {
    if (!data || !stream.time?.length) return null;
    const pick = (): {
      measure: Measure;
      model: CriticalModel;
      values: number[];
    } | null => {
      const usable = (slot: {
        model: (CriticalModel & { reliable: boolean }) | null;
      }) => (slot.model?.reliable ? slot.model : null);
      if (CYCLING.has(sport)) {
        const model = usable(data.cycling.power);
        return model && stream.watts?.length
          ? { measure: 'power', model, values: stream.watts }
          : null;
      }
      if (!RUNNING.has(sport)) return null;
      const power = usable(data.running.power);
      if (power && stream.watts?.length)
        return { measure: 'power', model: power, values: stream.watts };
      const pace = usable(data.running.pace);
      return pace && stream.gap?.length
        ? { measure: 'pace', model: pace, values: stream.gap }
        : null;
    };
    const picked = pick();
    if (!picked) return null;
    const { time } = stream;
    const balance = reserveBalance(time, picked.values, picked.model);
    let lowest = 1;
    let above = 0;
    for (let i = 0; i < balance.length; i++) {
      if (balance[i] < lowest) lowest = balance[i];
      const dt = i + 1 < balance.length ? time[i + 1] - time[i] : 0;
      if (dt > 0 && dt <= 15 && picked.values[i] > picked.model.critical)
        above += dt;
    }
    if (lowest > WORTH_SHOWING) return null;
    const start = time[0];
    const span = Math.max(1, time[balance.length - 1] - start);
    // One point per pixel at most
    const stride = Math.max(1, Math.ceil(balance.length / WIDTH));
    const points: string[] = [];
    for (let i = 0; i < balance.length; i += stride) {
      const x = ((time[i] - start) / span) * WIDTH;
      const y = (1 - balance[i]) * HEIGHT;
      points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return { ...picked, lowest, above, points: points.join(' ') };
  }, [data, stream, sport]);

  if (!result) return null;
  const name =
    result.measure === 'pace'
      ? m.performance_critical_pace()
      : m.performance_critical_power();
  const summary =
    result.lowest < 0.25
      ? m.performance_reserve_summary_deep()
      : result.lowest < 0.6
        ? m.performance_reserve_summary_half()
        : m.performance_reserve_summary_light();

  return (
    <Card data-reserve-card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>
          {result.measure === 'pace'
            ? m.performance_reserve_card_pace()
            : m.performance_reserve_card_power()}
        </CardTitle>
        <MetricInfo metric="reserveBalance" />
      </CardHeader>
      <CardContent className="space-y-3">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-32 w-full"
          preserveAspectRatio="none"
          role="img"
          aria-label={summary}
        >
          {[0, 0.5, 1].map((share) => (
            <line
              key={share}
              x1={0}
              x2={WIDTH}
              y1={share * HEIGHT}
              y2={share * HEIGHT}
              stroke="var(--border)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polyline
            points={result.points}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-md bg-muted p-3">
            <div className="text-xs text-muted-foreground">
              {m.performance_reserve_lowest()}
            </div>
            <div className="text-lg font-semibold" data-reserve-lowest>
              {formatPercent(result.lowest * 100, 0)}
            </div>
          </div>
          <div className="rounded-md bg-muted p-3">
            <div className="text-xs text-muted-foreground">
              {m.performance_reserve_above({ name })}
            </div>
            <div className="text-lg font-semibold">
              {formatDuration(Math.round(result.above))}
            </div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{summary}</p>
        <p className="text-xs text-muted-foreground">
          {m.performance_reserve_caption({
            name,
            value: formatCritical(result.measure, result.model.critical),
          })}
        </p>
      </CardContent>
    </Card>
  );
}
