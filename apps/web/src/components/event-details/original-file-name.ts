import { ActivityEvent } from '@openathlete/shared';

/** The name of the downloaded file: the activity's day and name */
export function originalFileName(
  event: Pick<ActivityEvent, 'name' | 'startDate' | 'originalFile'>,
  /** GPX for the track; the kept file's format otherwise */
  fileType = event.originalFile?.fileType ?? 'FIT',
): string {
  const name =
    event.name
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'activity';
  const day = new Date(event.startDate).toISOString().slice(0, 10);
  return `${day}-${name}.${fileType.toLowerCase()}`;
}
