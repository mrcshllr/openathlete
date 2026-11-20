import { useCreateEventMutation } from '@/api/event';
import { useGetPerformanceModelsQuery } from '@/api/record';
import { m } from '@/paraglide/messages';
import { getPath } from '@/routes/paths';
import { cn } from '@/utils/shadcn';
import { Check, CircleDashed } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

import {
  DURABILITY_LIMIT,
  EVENT_TYPE,
  PERFORMANCE_MODEL_LONG,
  PERFORMANCE_MODEL_SHORT,
  PerformanceModelDto,
  PerformanceModelSlotDto,
  PerformanceModelsDto,
  SPORT_TYPE,
  WORKOUT_DURATION_TYPE,
  WORKOUT_STEP_TYPE,
} from '@openathlete/shared';

import { GarminAttribution } from '../garmin-attribution/garmin-attribution';
import { Button } from '../ui/button';
import { SectionLabel } from '../ui/section-label';
import { Skeleton } from '../ui/skeleton';
import {
  Measure,
  defaultMeasure,
  focusLabel,
  focusReason,
  formatCritical,
  formatPercent,
  formatReserve,
  runningSlot,
} from './model-format';

const DAY = 24 * 3600 * 1000;

function Row({
  label,
  hint,
  value,
  note,
}: {
  label: string;
  hint: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-muted-foreground">{hint}</div>
      </div>
      <div className="flex shrink-0 items-baseline gap-2">
        <span className="text-lg font-semibold">{value}</span>
        {note && <span className="text-xs text-muted-foreground">{note}</span>}
      </div>
    </div>
  );
}

function MeasureSwitch({
  measure,
  onChange,
}: {
  measure: Measure;
  onChange: (measure: Measure) => void;
}) {
  const options: { value: Measure; label: string }[] = [
    { value: 'pace', label: m.performance_measure_pace() },
    { value: 'power', label: m.performance_measure_power() },
  ];
  return (
    <div
      role="group"
      aria-label={m.performance_measure_label()}
      className="flex gap-1 rounded-md bg-muted p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={measure === option.value}
          data-measure={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'min-h-9 rounded px-3 text-sm font-medium',
            measure === option.value
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Profile({ model }: { model: PerformanceModelDto }) {
  // The scale reads speed on the left, endurance on the right
  const left = `${(1 - model.profilePosition) * 100}%`;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{m.performance_profile_speed()}</span>
        <span>{m.performance_profile_hybrid()}</span>
        <span>{m.performance_profile_endurance()}</span>
      </div>
      <div
        className="relative h-2 rounded-full bg-muted"
        data-profile={model.profile}
      >
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background"
          style={{ left, background: 'var(--chart-1)' }}
        />
      </div>
    </div>
  );
}

function Rows({
  data,
  measure,
  model,
}: {
  data: PerformanceModelsDto;
  measure: Measure;
  model: PerformanceModelDto;
}) {
  const pace = measure === 'pace';
  const { durability } = data.running;
  return (
    <div className="border-t">
      <Row
        label={
          pace ? m.performance_critical_pace() : m.performance_critical_power()
        }
        hint={
          pace
            ? m.performance_critical_pace_hint()
            : m.performance_critical_power_hint()
        }
        value={formatCritical(measure, model.critical)}
      />
      <Row
        label={
          pace ? m.performance_reserve_pace() : m.performance_reserve_power()
        }
        hint={
          pace
            ? m.performance_reserve_pace_hint()
            : m.performance_reserve_power_hint()
        }
        value={formatReserve(measure, model.reserve)}
      />
      <Row
        label={m.performance_durability()}
        hint={
          durability
            ? m.performance_durability_hint()
            : m.performance_durability_none()
        }
        value={durability ? formatPercent(durability.value) : '–'}
        note={
          durability
            ? durability.value > DURABILITY_LIMIT
              ? m.performance_durability_limited()
              : m.performance_durability_good()
            : undefined
        }
      />
    </div>
  );
}

/** A best the model needs, or the gap where one is missing */
function Bucket({
  label,
  slot,
  inBucket,
  now,
}: {
  label: string;
  slot: PerformanceModelSlotDto;
  inBucket: (duration: number) => boolean;
  now: number;
}) {
  const point = slot.points
    .filter((p) => inBucket(p.duration))
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  // Found, but not all out: the model has too little reserve
  const doubted = point && slot.model && !slot.model.reliable && inBucket(120);
  const found = point && !doubted;
  const days = point ? Math.floor((now - point.date.getTime()) / DAY) : 0;
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2.5 text-sm">
      <div className="flex items-center gap-2 font-medium">
        {found ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <CircleDashed className="size-4" aria-hidden="true" />
        )}
        {label}
      </div>
      <span className="text-xs text-muted-foreground">
        {found
          ? m.performance_point_age({ days })
          : doubted
            ? m.performance_bucket_doubted()
            : m.performance_bucket_missing()}
      </span>
    </div>
  );
}

function Missing({
  data,
  measure,
  athleteId,
}: {
  data: PerformanceModelsDto;
  measure: Measure;
  athleteId?: number;
}) {
  const slot = runningSlot(data, measure);
  const [now] = useState(() => Date.now());
  const createEvent = useCreateEventMutation();
  const [planned, setPlanned] = useState(false);
  // The short test first: it is the one most training lacks
  const short = slot.missing.includes('SHORT') || slot.missing.length === 0;
  const testSeconds = short ? 180 : 720;

  const planTest = () => {
    const start = new Date(now + DAY);
    start.setHours(9, 0, 0, 0);
    const warmup = 900;
    const cooldown = 600;
    const total = warmup + testSeconds + cooldown;
    const step = (stepType: WORKOUT_STEP_TYPE, durationValue: number) => ({
      stepType,
      durationType: WORKOUT_DURATION_TYPE.TIME,
      durationValue,
      targets: [],
    });
    createEvent.mutate(
      {
        type: EVENT_TYPE.TRAINING,
        sport: SPORT_TYPE.RUNNING,
        name: short
          ? m.performance_test_short_title()
          : m.performance_test_long_title(),
        description: m.performance_test_description(),
        startDate: start,
        endDate: new Date(start.getTime() + total * 1000),
        goalDuration: total,
        athleteId,
        workout: {
          steps: [
            step(WORKOUT_STEP_TYPE.WARMUP, warmup),
            step(WORKOUT_STEP_TYPE.INTERVAL_ACTIVE, testSeconds),
            step(WORKOUT_STEP_TYPE.COOLDOWN, cooldown),
          ],
        },
      },
      {
        onSuccess: () => {
          setPlanned(true);
          toast.success(m.performance_test_planned());
        },
        onError: () => toast.error(m.performance_test_failed()),
      },
    );
  };

  const unreliable = slot.model && !slot.model.reliable;
  return (
    <div className="space-y-3" data-focus-missing>
      <div className="space-y-1">
        <div className="text-base font-semibold">
          {slot.missing.length === 2
            ? m.performance_missing_title_both()
            : short
              ? m.performance_missing_title_short()
              : m.performance_missing_title_long()}
        </div>
        <p className="text-sm text-muted-foreground">
          {unreliable
            ? m.performance_unreliable_text()
            : m.performance_missing_text({ days: data.days })}
        </p>
      </div>
      <div className="border-t">
        <Bucket
          label={m.performance_bucket_long()}
          slot={slot}
          inBucket={(d) => d >= PERFORMANCE_MODEL_LONG}
          now={now}
        />
        <Bucket
          label={m.performance_bucket_short()}
          slot={slot}
          inBucket={(d) => d <= PERFORMANCE_MODEL_SHORT}
          now={now}
        />
      </div>
      {slot.model && (
        <p className="text-sm text-muted-foreground">
          {m.performance_provisional({
            name:
              measure === 'pace'
                ? m.performance_critical_pace()
                : m.performance_critical_power(),
            value: formatCritical(measure, slot.model.critical),
          })}
        </p>
      )}
      <div className="space-y-2 rounded-md bg-muted p-3">
        <div className="text-sm font-medium">
          {short
            ? m.performance_test_short_title()
            : m.performance_test_long_title()}
        </div>
        <p className="text-xs text-muted-foreground">
          {m.performance_test_text()}
        </p>
        <Button
          type="button"
          size="sm"
          data-plan-test
          disabled={createEvent.isPending || planned}
          onClick={planTest}
        >
          {planned ? m.performance_test_planned() : m.performance_test_plan()}
        </Button>
      </div>
    </div>
  );
}

/**
 * Selfhost: where running training should focus, from the critical speed or
 * critical power model of the last days. Says what is missing, and offers
 * the test that fills the gap, when the bests give no model.
 */
export function TrainingFocusCard({ athleteId }: { athleteId?: number }) {
  const { data, isLoading } = useGetPerformanceModelsQuery(athleteId);
  const [chosen, setChosen] = useState<Measure | null>(null);

  if (isLoading) return <Skeleton className="h-40 rounded-md" />;
  if (!data) return null;
  const measure = chosen ?? defaultMeasure(data);
  const { model } = runningSlot(data, measure);
  const recordsPath = `${getPath(['dashboard', 'records'])}${athleteId ? `/${athleteId}` : ''}`;

  return (
    <div className="space-y-3 rounded-md border p-3" data-training-focus>
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>{m.performance_focus_title()}</SectionLabel>
        <MeasureSwitch measure={measure} onChange={setChosen} />
      </div>
      {model?.reliable ? (
        <>
          <div className="space-y-1">
            <div className="text-xl font-semibold" data-focus={model.focus}>
              {focusLabel[model.focus]()}
            </div>
            <p className="text-sm text-muted-foreground">
              {focusReason[model.focus]()}
            </p>
          </div>
          <Profile model={model} />
          <Rows data={data} measure={measure} model={model} />
        </>
      ) : (
        <Missing data={data} measure={measure} athleteId={athleteId} />
      )}
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{m.performance_based_on({ days: data.days })}</span>
        <Link to={recordsPath} className="font-medium underline">
          {m.performance_details_link()}
        </Link>
      </div>
      {/* Derived from activities, which Garmin devices may record */}
      <GarminAttribution athleteId={athleteId} />
    </div>
  );
}
