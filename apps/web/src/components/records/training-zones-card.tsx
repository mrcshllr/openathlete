import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useTrainingZones } from '@/hooks/use-training-zones';
import { m } from '@/paraglide/messages';

import { SPORT_TYPE, TRAINING_ZONE_TYPE } from '@openathlete/shared';

interface P {
  type: TRAINING_ZONE_TYPE.POWER | TRAINING_ZONE_TYPE.HEARTRATE;
  sport: SPORT_TYPE;
  athleteId?: number;
}

/**
 * The athlete's power or heart rate zones for the sport, next to the records
 * of the same measure: what the bests are trained against.
 */
export function TrainingZonesCard({ type, sport, athleteId }: P) {
  const zones = useTrainingZones(type, sport, athleteId);
  const power = type === TRAINING_ZONE_TYPE.POWER;
  const unit = power ? m.watts() : m.bpm();
  // Negative ids are the default heart rate zones: the athlete set none
  const isDefault = zones.some((zone) => zone.id < 0);

  return (
    <Card data-training-zones={type}>
      <CardHeader>
        <CardTitle>
          {power ? m.records_power_zones() : m.records_heartrate_zones()}
        </CardTitle>
        {zones.length === 0 && (
          <CardDescription>{m.records_zones_empty()}</CardDescription>
        )}
      </CardHeader>
      {zones.length > 0 && (
        <CardContent className="flex flex-col gap-3">
          <table className="w-full text-sm">
            <tbody>
              {zones.map((zone) => (
                <tr key={zone.id} className="border-b last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-medium">
                    {zone.name}
                    {zone.description && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {zone.description}
                      </span>
                    )}
                  </th>
                  <td className="py-2 text-right tabular-nums whitespace-nowrap">
                    {Math.round(zone.min)} – {Math.round(zone.max)} {unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">
            {isDefault ? m.records_zones_default() : m.records_zones_help()}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
