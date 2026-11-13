import type { PrismaService } from '../../prisma/services/prisma.service';

/** A FIT file starts with its header size, then ".FIT" at bytes 8 to 11 */
export function isFitFile(content: Buffer): boolean {
  return content.length >= 12 && content.toString('ascii', 8, 12) === '.FIT';
}

/**
 * Keeps the device file an activity was imported from. Imported again, the
 * activity keeps one file: the newest. Anything that is not a FIT file (an
 * error page a provider answered with) is left out.
 */
export async function saveActivityOriginalFile(
  prisma: Pick<PrismaService, 'eventActivityFile'>,
  eventActivityId: number,
  content: Buffer,
): Promise<boolean> {
  if (!isFitFile(content)) return false;
  const file = {
    fileType: 'FIT',
    size: content.length,
    // A copy on its own memory, as Prisma types its bytes
    content: new Uint8Array(content),
  };
  await prisma.eventActivityFile.upsert({
    where: { eventActivityId },
    create: { eventActivityId, ...file },
    update: file,
  });
  return true;
}

/** The name a downloaded file gets: the activity's date and name */
export function originalFileName(
  event: { name: string; startDate: Date },
  fileType: string,
): string {
  const name =
    event.name
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'activity';
  const date = event.startDate.toISOString().slice(0, 10);
  return `${date}-${name}.${fileType.toLowerCase()}`;
}
