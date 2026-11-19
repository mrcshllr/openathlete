import { useGetEventStreamQuery } from '@/api/event';
import { EventAPI } from '@/api/event/event.api';
import { m } from '@/paraglide/messages';
import { isCapacitor } from '@/utils/capacitor';
import { downloadFile } from '@/utils/csv';
import { Download, FileDown, Route } from 'lucide-react';
import { toast } from 'sonner';

import { ActivityEvent } from '@openathlete/shared';

import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  ACTIVITY_STREAM_KEYS,
  ACTIVITY_STREAM_RESOLUTION,
} from './activity-stream-keys';
import { gpxFileName } from './gpx-file-name';
import { originalFileName } from './original-file-name';

/**
 * The downloads of an activity in one place: the device file (FIT) when it
 * was kept, and the GPS track (GPX) when the activity has one. The athlete
 * and their coach both get it, as both may read the activity. Hidden in the
 * iOS and Android apps, whose web view has no download folder.
 */
export function ActivityDownloadMenu({
  event,
  className,
}: {
  event: ActivityEvent;
  className?: string;
}) {
  const native = isCapacitor();
  // The stream the details read already: no extra request
  const { data: stream } = useGetEventStreamQuery(
    event.eventId,
    ACTIVITY_STREAM_RESOLUTION,
    ACTIVITY_STREAM_KEYS,
    !native,
  );
  const hasTrack = Boolean(stream?.latlng?.some((point) => point.length === 2));
  const hasFile = Boolean(event.originalFile);
  if (native || (!hasTrack && !hasFile)) return null;

  const download = async (
    fileName: string,
    fetch: () => Promise<Blob>,
    failed: () => string,
  ) => {
    try {
      downloadFile(fileName, await fetch());
    } catch {
      toast.error(failed());
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={className}
          aria-label={m.activity_download()}
          title={m.activity_download()}
          data-activity-download
        >
          <Download className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={!hasFile}
          data-download-fit
          onClick={() =>
            download(
              originalFileName(event),
              () => EventAPI.getEventOriginalFile(event.eventId),
              m.activity_original_file_failed,
            )
          }
        >
          <FileDown className="size-4" />
          <div className="flex flex-col">
            <span>{m.activity_download_fit()}</span>
            {!hasFile && (
              <span className="text-xs text-muted-foreground">
                {m.activity_download_fit_missing()}
              </span>
            )}
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasTrack}
          data-download-gpx
          onClick={() =>
            download(
              gpxFileName(event),
              () => EventAPI.getEventGpx(event.eventId),
              m.activity_gpx_download_failed,
            )
          }
        >
          <Route className="size-4" />
          <div className="flex flex-col">
            <span>{m.activity_download_gpx()}</span>
            {!hasTrack && (
              <span className="text-xs text-muted-foreground">
                {m.activity_download_gpx_missing()}
              </span>
            )}
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
