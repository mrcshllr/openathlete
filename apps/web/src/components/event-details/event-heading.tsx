import { EventAPI } from '@/api/event/event.api';
import { m } from '@/paraglide/messages';
import { getConnectorProviderActivityLink } from '@/utils/connector-provider';
import {
  connectorProviderLabelMap,
  eventTypeLabelMap,
} from '@/utils/label-map/core';
import { Download, Trophy } from 'lucide-react';
import { toast } from 'sonner';

import { ActivityEvent, EVENT_TYPE, Event } from '@openathlete/shared';

import { SportIcon } from '../sport-icon/sport-icon';
import { Badge } from '../ui/badge';
import { originalFileName } from './original-file-name';

/** Saves the activity's device file under its date and name */
async function downloadOriginalFile(event: ActivityEvent) {
  try {
    const file = await EventAPI.getEventOriginalFile(event.eventId);
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = originalFileName(event);
    link.click();
    URL.revokeObjectURL(url);
  } catch {
    toast.error(m.activity_original_file_failed());
  }
}

/** The sport, name and badges of an event, as its dialog and page title */
export function EventHeading({
  event,
  hideName,
}: {
  event: Event;
  /** When the app bar already shows it */
  hideName?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 grow text-sm md:text-base">
      {event.type !== EVENT_TYPE.NOTE && event.sport && (
        <SportIcon sport={event.sport} />
      )}
      {!hideName && <span className="break-words">{event.name}</span>}
      <Badge className="text-xs">{eventTypeLabelMap[event.type]}</Badge>
      {event.type === EVENT_TYPE.ACTIVITY && event.isRace && (
        <Badge variant="outline" className="text-xs" data-race-badge>
          <Trophy className="h-3 w-3" />
          {m.activity_race_badge()}
        </Badge>
      )}
      {event.type === EVENT_TYPE.ACTIVITY &&
        !event.provider &&
        event.externalId?.startsWith('fit-manual:') && (
          <Badge variant="outline">{m.fit_import_source()}</Badge>
        )}
      {event.type === EVENT_TYPE.ACTIVITY &&
        !event.provider &&
        event.externalId?.startsWith('gpx-manual:') && (
          <Badge variant="outline">{m.gpx_import_source()}</Badge>
        )}
      {event.type === EVENT_TYPE.ACTIVITY &&
        !event.provider &&
        event.externalId?.startsWith('tcx-manual:') && (
          <Badge variant="outline">{m.tcx_import_source()}</Badge>
        )}
      {event.type === EVENT_TYPE.ACTIVITY &&
        event.externalId &&
        event.provider &&
        getConnectorProviderActivityLink(event.provider, event.externalId) && (
          <Badge
            variant="outline"
            className="cursor-pointer hover:underline text-xs"
            onClick={() => {
              const link = getConnectorProviderActivityLink(
                event.provider!,
                event.externalId,
              );
              if (!link) return;
              window.open(link, '_blank');
            }}
          >
            {m.imported_from({
              provider: connectorProviderLabelMap[event.provider],
            })}
          </Badge>
        )}
      {event.type === EVENT_TYPE.ACTIVITY && event.originalFile && (
        <Badge asChild variant="outline" className="text-xs">
          <button
            type="button"
            className="cursor-pointer hover:underline"
            onClick={() => downloadOriginalFile(event)}
          >
            <Download className="h-3 w-3" />
            {m.activity_original_file_download()}
          </button>
        </Badge>
      )}
    </div>
  );
}
