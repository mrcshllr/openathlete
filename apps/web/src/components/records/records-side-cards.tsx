import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { m } from '@/paraglide/messages';
import { RECORD_EXCLUSIONS_COLLAPSED } from '@/utils/local-storage';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import {
  RecordEffortDto,
  RecordExclusionDto,
  SPORT_TYPE,
} from '@openathlete/shared';

import {
  RECORD_METRICS,
  RecordMetric,
  formatRecordPosition,
  formatRecordValue,
  recordPosition,
} from './record-metrics';

const LATEST_SHOWN = 5;

interface LatestP {
  records: RecordEffortDto[];
  sport: SPORT_TYPE;
  year: number;
  dateFormat: Intl.DateTimeFormat;
  onSelect: (metric: RecordMetric, position: number) => void;
}

/** Records set this year, so that a new one does not go unnoticed. */
export function LatestRecordsCard({
  records,
  sport,
  year,
  dateFormat,
  onSelect,
}: LatestP) {
  return (
    <Card data-latest-records>
      <CardHeader>
        <CardTitle>{m.records_latest_title({ year })}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col">
        {records.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {m.records_latest_empty()}
          </p>
        )}
        {records.slice(0, LATEST_SHOWN).map((record) => {
          const metric = RECORD_METRICS.find((x) => x.type === record.type);
          const position = recordPosition(record);
          if (!metric || position === null) return null;
          const { value, unit } = formatRecordValue(metric, record, sport);
          return (
            <button
              key={record.recordId}
              type="button"
              className="min-h-11 border-b py-2 text-left text-sm last:border-0 cursor-pointer group"
              onClick={() => onSelect(metric, position)}
            >
              <span className="font-medium group-hover:underline">
                {metric.title(sport)} {formatRecordPosition(metric, position)}
              </span>{' '}
              <span className="tabular-nums">{value}</span>{' '}
              <span className="text-xs text-muted-foreground tabular-nums">
                {unit}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {dateFormat.format(new Date(record.date))}
                {record.activityName && <> · {record.activityName}</>}
              </span>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** What an exclusion covers, in words. */
function exclusionScope(
  exclusion: RecordExclusionDto,
  sport: SPORT_TYPE,
): string {
  const metric = RECORD_METRICS.find((x) => x.type === exclusion.type);
  if (!metric) return m.records_exclusion_activity();
  const position = exclusion.distance ?? exclusion.duration;
  return position === null
    ? metric.title(sport)
    : `${metric.title(sport)} ${formatRecordPosition(metric, position)}`;
}

interface ExclusionsP {
  exclusions: RecordExclusionDto[];
  sport: SPORT_TYPE;
  dateFormat: Intl.DateTimeFormat;
  onRestore: (exclusion: RecordExclusionDto) => void;
}

/** Whether the athlete folded the exclusions away on this device. */
function readCollapsed(): boolean {
  try {
    return localStorage.getItem(RECORD_EXCLUSIONS_COLLAPSED) === 'true';
  } catch {
    // No storage (private mode): the card opens as it always did
    return false;
  }
}

/**
 * Everything set aside, to get it back at any time. The list folds away: a
 * long one pushes the rest of the column down, and it is rarely needed.
 */
export function RecordExclusionsCard({
  exclusions,
  sport,
  dateFormat,
  onRestore,
}: ExclusionsP) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const toggle = (open: boolean) => {
    setCollapsed(!open);
    try {
      localStorage.setItem(RECORD_EXCLUSIONS_COLLAPSED, String(!open));
    } catch {
      // Not remembered, still folded for this visit
    }
  };

  if (exclusions.length === 0) {
    return (
      <Card data-record-exclusions>
        <CardHeader>
          <CardTitle>{m.records_exclusions()}</CardTitle>
          <CardDescription>{m.records_exclusions_empty()}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card data-record-exclusions>
      <Collapsible open={!collapsed} onOpenChange={toggle}>
        <CardHeader>
          <CardTitle>
            <CollapsibleTrigger className="group flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 text-left">
              <span>
                {m.records_exclusions()}{' '}
                <span className="text-sm font-normal text-muted-foreground tabular-nums">
                  {exclusions.length}
                </span>
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
          </CardTitle>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="flex flex-col">
            {exclusions.map((exclusion) => (
              <div
                key={exclusion.recordExclusionId}
                className="flex items-center justify-between gap-2 border-b py-2 last:border-0"
              >
                <span className="min-w-0 text-sm">
                  <span className="block truncate font-medium">
                    {exclusion.activityName}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {exclusionScope(exclusion, sport)} ·{' '}
                    {dateFormat.format(new Date(exclusion.date))}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRestore(exclusion)}
                >
                  {m.records_restore()}
                </Button>
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
