import { useGetPerformanceModelsQuery } from '@/api/record';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { m } from '@/paraglide/messages';

import {
  CRITICAL_POWER_DURATIONS,
  D_PRIME_REFERENCE,
  formatDuration,
  modelValueAt,
} from '@openathlete/shared';

import { formatRecordDistance } from '../records/record-metrics';
import { formatCritical, formatPace, formatReserve } from './model-format';

/**
 * Selfhost: what the running models predict. Race times and the marathon
 * start from critical speed, and the power the critical power model holds
 * over its durations, with the bests each was read from.
 */
export function PerformanceModelCard({ athleteId }: { athleteId?: number }) {
  const { data } = useGetPerformanceModelsQuery(athleteId);
  if (!data) return null;
  const { pace, power, predictions, marathonStartSpeed } = data.running;
  const paceModel = pace.model?.reliable ? pace.model : null;
  const powerModel = power.model?.reliable ? power.model : null;
  if (!paceModel && !powerModel) return null;

  return (
    <Card data-performance-model>
      <CardHeader>
        <CardTitle>{m.performance_model_title()}</CardTitle>
        <CardDescription>
          {m.performance_based_on({ days: data.days })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {paceModel && (
          <div className="space-y-2">
            <div className="flex justify-between gap-3 font-medium">
              <span>{m.performance_critical_pace()}</span>
              <span>
                {formatCritical('pace', paceModel.critical)} ·{' '}
                {m.performance_reserve_pace()}{' '}
                {formatReserve('pace', paceModel.reserve)}
              </span>
            </div>
            {predictions.map(({ distance, seconds }) => (
              <div
                key={distance}
                className="flex justify-between gap-3 border-b pb-1.5"
              >
                <span className="text-muted-foreground">
                  {formatRecordDistance(distance)}
                </span>
                <span className="font-medium">
                  {formatDuration(Math.round(seconds))}
                </span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              {m.performance_reference({
                mean: D_PRIME_REFERENCE.mean,
                sd: D_PRIME_REFERENCE.sd,
              })}
            </p>
            {marathonStartSpeed && (
              <p className="text-xs text-muted-foreground">
                {m.performance_marathon_tip({
                  pace: formatPace(marathonStartSpeed),
                })}
              </p>
            )}
          </div>
        )}
        {powerModel && (
          <div className="space-y-2">
            <div className="flex justify-between gap-3 font-medium">
              <span>{m.performance_critical_power()}</span>
              <span>
                {formatCritical('power', powerModel.critical)} ·{' '}
                {m.performance_reserve_power()}{' '}
                {formatReserve('power', powerModel.reserve)}
              </span>
            </div>
            {CRITICAL_POWER_DURATIONS.map((seconds) => (
              <div
                key={seconds}
                className="flex justify-between gap-3 border-b pb-1.5"
              >
                <span className="text-muted-foreground">
                  {formatDuration(seconds)}
                </span>
                <span className="font-medium">
                  {formatCritical('power', modelValueAt(powerModel, seconds))}
                </span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          {m.performance_sources()}
        </p>
      </CardContent>
    </Card>
  );
}
