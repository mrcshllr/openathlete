import { ActivityEvent } from '@openathlete/shared';

import { gpxFileName } from './gpx-file-name';

/**
 * The name of the downloaded device file: the same day and name as the
 * GPX track, so both downloads of an activity sort together
 */
export function originalFileName(
  event: Pick<ActivityEvent, 'name' | 'startDate' | 'originalFile'>,
): string {
  const fileType = event.originalFile?.fileType ?? 'FIT';
  return gpxFileName(event).replace(/\.gpx$/, `.${fileType.toLowerCase()}`);
}
