import { useGetLatestMetricsQuery } from '@/api/metric';
import {
  useGetModeledMetricsQuery,
  useGetRunningEconomyQuery,
} from '@/api/record';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { m } from '@/paraglide/messages';
import { metricTypeLabelMap } from '@/utils/label-map/core/metric-type.label-map';
import { cn } from '@/utils/shadcn';
import { Calculator } from 'lucide-react';
import { useState } from 'react';

import {
  METRIC_TYPE,
  TRAINING_ZONE_TYPE,
  powerToPace,
} from '@openathlete/shared';

import { thresholdZones } from './threshold-zones';
import {
  ZoneModelChoice,
  ZoneRole,
  mergedTable,
  zoneModelChoices,
} from './zone-models';
import { ZoneDraft, formatPace, parsePace } from './zone-profiles';

interface Source {
  id: string;
  label: string;
  /** Watts, bpm or minutes per km */
  value: number;
}

const round = (value: number) => Math.round(value);

const ROLE_LABEL: Record<ZoneRole, () => string> = {
  recovery: m.ui_active_recovery,
  endurance: m.endurance,
  tempo: m.tempo,
  subThreshold: m.zones_role_sub_threshold,
  threshold: m.threshold,
  vo2max: m.vo2_max,
  anaerobic: m.zones_role_anaerobic,
  neuromuscular: m.zones_role_neuromuscular,
};

const choiceId = ({ model, table }: ZoneModelChoice) =>
  `${model.id}-${table.sport ?? 'all'}`;

/**
 * Zones from a threshold the athlete picks (the modelled or the entered FTP,
 * a threshold heart rate, or a pace from a power threshold and the athlete's
 * own flat runs) by a published model: as many zones as the model has, or
 * merged into five, the count plans and templates are built on. Fills the
 * editor; saving keeps them.
 */
export function ThresholdZonesPanel({
  athleteId,
  type,
  sports,
  currentCount,
  onApply,
}: {
  athleteId: number;
  type: TRAINING_ZONE_TYPE;
  /** The sports of the zone set: they choose the models offered */
  sports: string[];
  /** Zones of the set now: a model with more or fewer changes them */
  currentCount: number;
  onApply: (zones: Omit<ZoneDraft, 'key'>[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const choices = zoneModelChoices(type, sports);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const choice =
    choices.find((item) => choiceId(item) === chosenId) ?? choices[0];
  const [original, setOriginal] = useState(false);
  const hasSubZones = !!choice && choice.table.zones.length !== 5;
  const table =
    choice && (original || !hasSubZones)
      ? choice.table
      : choice && mergedTable(choice.table);
  // Several sports of a mixed set: say which one a table is for
  const mixed = new Set(choices.map(({ table: t }) => t.sport)).size > 1;
  const isPace = type === TRAINING_ZONE_TYPE.PACE;
  const isPower = type === TRAINING_ZONE_TYPE.POWER;
  const usesPower = isPace || isPower;

  // Read only once the panel is open
  const { data: modeled } = useGetModeledMetricsQuery(athleteId, {
    enabled: open && usesPower,
  });
  const { data: metrics } = useGetLatestMetricsQuery(athleteId, {
    enabled: open && usesPower,
  });
  const { data: economy } = useGetRunningEconomyQuery(athleteId, {
    enabled: open && isPace,
  });

  const powers = [
    {
      type: METRIC_TYPE.FTP_RUNNING,
      modeled: modeled?.ftpRunning?.value,
      entered: metrics?.[METRIC_TYPE.FTP_RUNNING]?.value,
    },
    ...(isPower
      ? [
          {
            type: METRIC_TYPE.FTP_CYCLING,
            modeled: modeled?.ftpCycling?.value,
            entered: metrics?.[METRIC_TYPE.FTP_CYCLING]?.value,
          },
        ]
      : []),
  ];
  const sources: Source[] = powers.flatMap((power) =>
    (
      [
        ['modeled', power.modeled, m.zones_threshold_source_modeled],
        ['entered', power.entered, m.zones_threshold_source_entered],
      ] as const
    ).flatMap(([kind, watts, message]) => {
      if (!watts || !(watts > 0)) return [];
      const metric = metricTypeLabelMap[power.type];
      if (isPower) {
        return [
          {
            id: `${kind}-${power.type}`,
            label: message({ metric, value: `${round(watts)} W` }),
            value: round(watts),
          },
        ];
      }
      if (!economy) return [];
      const pace = powerToPace(watts, economy.value);
      return [
        {
          id: `${kind}-${power.type}`,
          label: message({
            metric,
            value: `${round(watts)} W → ${formatPace(pace)}/km`,
          }),
          value: pace,
        },
      ];
    }),
  );

  const threshold = isPace ? parsePace(input) : Number(input);
  const valid = threshold !== null && threshold > 0;

  const pick = (source: Source) => {
    setSourceId(source.id);
    setInput(isPace ? formatPace(source.value) : String(source.value));
  };

  const apply = () => {
    if (!valid || !table) return;
    const zones = thresholdZones(type, threshold, table, (zone) => ({
      name: m.zones_model_zone_name({ id: zone.id }),
      description: ROLE_LABEL[zone.role](),
    }));
    if (zones) {
      onApply(zones);
      setOpen(false);
    }
  };
  const count = table?.zones.length ?? 0;

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="max-md:h-11"
        onClick={() => setOpen(true)}
      >
        <Calculator className="size-4" />
        {m.zones_threshold_open()}
      </Button>
    );
  }

  const label = isPace
    ? m.zones_threshold_pace_label()
    : isPower
      ? m.zones_threshold_power_label()
      : m.zones_threshold_hr_label();

  return (
    <div
      className="space-y-3 rounded-2xl border bg-card p-4"
      data-testid="threshold-zones"
    >
      <div>
        <p className="text-sm font-medium">{m.zones_threshold_title()}</p>
        <p className="text-xs text-muted-foreground">
          {m.zones_threshold_help()}
        </p>
      </div>
      {choices.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium">{m.zones_model_label()}</p>
          <div className="flex flex-wrap gap-1.5" role="group">
            {choices.map((item) => {
              const id = choiceId(item);
              const active = choice && choiceId(choice) === id;
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={!!active}
                  onClick={() => setChosenId(id)}
                  className={cn(
                    'min-h-11 rounded-full border px-3 text-xs font-medium transition-colors md:min-h-8',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {mixed && item.table.sport
                    ? m.zones_model_for_sport({
                        author: item.model.author,
                        sport:
                          item.table.sport === 'run'
                            ? m.zones_model_sport_run()
                            : m.zones_model_sport_bike(),
                      })
                    : item.model.author}
                </button>
              );
            })}
          </div>
          {hasSubZones && (
            <div className="flex flex-wrap gap-1.5" role="group">
              {(
                [
                  [false, m.zones_model_merged()],
                  [
                    true,
                    m.zones_model_original({
                      count: choice.table.zones.length,
                    }),
                  ],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={String(value)}
                  type="button"
                  aria-pressed={original === value}
                  onClick={() => setOriginal(value)}
                  className={cn(
                    'min-h-11 rounded-full border px-3 text-xs font-medium transition-colors md:min-h-8',
                    original === value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {text}
                </button>
              ))}
            </div>
          )}
          {choice && (
            <p className="text-xs text-muted-foreground">
              {m.zones_model_source({ source: choice.model.source })}
            </p>
          )}
          {count > 0 && count !== currentCount && (
            <p role="status" className="text-xs text-oa-warning">
              {m.zones_model_count_change({
                from: currentCount,
                to: count,
                kept: Math.min(currentCount, count),
              })}
            </p>
          )}
        </div>
      )}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {sources.map((source) => (
            <button
              key={source.id}
              type="button"
              aria-pressed={sourceId === source.id}
              onClick={() => pick(source)}
              className={cn(
                'min-h-11 rounded-full border px-3 text-xs font-medium transition-colors md:min-h-8',
                sourceId === source.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {source.label}
            </button>
          ))}
        </div>
      )}
      {isPace && (
        <p className="text-xs text-muted-foreground">
          {economy
            ? m.zones_threshold_economy({
                value: economy.value,
                count: economy.activities,
                days: economy.days,
              })
            : m.zones_threshold_no_economy()}
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="zones-threshold">{label}</Label>
        <Input
          id="zones-threshold"
          inputMode={isPace ? 'text' : 'numeric'}
          type={isPace ? 'text' : 'number'}
          placeholder={isPace ? '4:10' : undefined}
          value={input}
          onChange={(event) => {
            setInput(event.target.value);
            setSourceId(null);
          }}
        />
        {type === TRAINING_ZONE_TYPE.HEARTRATE && (
          <p className="text-xs text-muted-foreground">
            {m.zones_threshold_hr_help()}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          {m.cancel()}
        </Button>
        <Button type="button" disabled={!valid || !table} onClick={apply}>
          {m.zones_threshold_apply()}
        </Button>
      </div>
    </div>
  );
}
