import { ActivityEvent } from '@openathlete/shared';

import { activityFileName } from './activity-file-name';

/**
 * The name of the downloaded device file: the same day and name as the
 * GPX track, so both downloads of an activity sort together
 */
export function originalFileName(
  event: Pick<ActivityEvent, 'name' | 'startDate' | 'originalFile'>,
): string {
  const fileType = event.originalFile?.fileType ?? 'FIT';
  return activityFileName(event, 'gpx').replace(
    /\.gpx$/,
    `.${fileType.toLowerCase()}`,
  );
}
