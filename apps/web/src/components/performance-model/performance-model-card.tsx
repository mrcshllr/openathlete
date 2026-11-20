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

import { MetricInfo } from '../statistics/metric-info';
import { formatCritical, formatPace, formatReserve } from './model-format';

/**
 * The running models in figures: critical speed with its reserve and the
 * pace a marathon should not start above, and the power the critical power
 * model holds over its durations. Race times stay with the statistics.
 */
export function PerformanceModelCard({ athleteId }: { athleteId?: number }) {
  const { data } = useGetPerformanceModelsQuery(athleteId);
  if (!data) return null;
  const { pace, power, marathonStartSpeed } = data.running;
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
            <div className="flex items-center justify-between gap-3 font-medium">
              <span className="flex items-center gap-1">
                {m.performance_critical_pace()}
                <MetricInfo metric="criticalSpeed" />
              </span>
              <span>
                {formatCritical('pace', paceModel.critical)} ·{' '}
                {m.performance_reserve_pace()}{' '}
                {formatReserve('pace', paceModel.reserve)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">
              {m.statistics_critical_range({
                range: `${formatPace(paceModel.critical + paceModel.margin)} – ${formatPace(Math.max(paceModel.critical - paceModel.margin, 0.1))}`,
              })}
            </p>
            <p className="text-xs text-muted-foreground">
              {m.performance_reference({
                mean: D_PRIME_REFERENCE.mean,
                sd: D_PRIME_REFERENCE.sd,
              })}
            </p>
            {marathonStartSpeed && (
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {m.performance_marathon_tip({
                    pace: formatPace(marathonStartSpeed),
                  })}
                </p>
                <MetricInfo metric="marathonStart" />
              </div>
            )}
          </div>
        )}
        {powerModel && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3 font-medium">
              <span className="flex items-center gap-1">
                {m.performance_critical_power()}
                <MetricInfo metric="criticalPower" />
              </span>
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
      </CardContent>
    </Card>
  );
}
