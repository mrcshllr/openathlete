import {
  isFitFile,
  originalFileName,
  saveActivityOriginalFile,
} from './activity-original-file';

function fitFile(): Buffer {
  const file = Buffer.alloc(14);
  file.writeUInt8(14, 0);
  file.write('.FIT', 8, 'ascii');
  return file;
}

describe('activity original file', () => {
  it('recognises a FIT file by its header', () => {
    expect(isFitFile(fitFile())).toBe(true);
    expect(isFitFile(Buffer.from('<html>Too many requests</html>'))).toBe(
      false,
    );
    expect(isFitFile(Buffer.alloc(4))).toBe(false);
  });

  it('keeps one file per activity, the newest', async () => {
    const upsert = jest.fn();
    const content = fitFile();

    const saved = await saveActivityOriginalFile(
      { eventActivityFile: { upsert } } as never,
      31,
      content,
    );

    expect(saved).toBe(true);
    const file = {
      fileType: 'FIT',
      size: 14,
      content: new Uint8Array(content),
    };
    expect(upsert).toHaveBeenCalledWith({
      where: { eventActivityId: 31 },
      create: { eventActivityId: 31, ...file },
      update: file,
    });
  });

  it('keeps nothing that is not a FIT file', async () => {
    const upsert = jest.fn();

    const saved = await saveActivityOriginalFile(
      { eventActivityFile: { upsert } } as never,
      31,
      Buffer.from('not a fit file at all'),
    );

    expect(saved).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('names the download after the date and the activity', () => {
    expect(
      originalFileName(
        {
          name: 'Länger Lauf / Zürich!',
          startDate: new Date('2026-01-06T23:30:00Z'),
        },
        'FIT',
      ),
    ).toBe('2026-01-06-Langer-Lauf-Zurich.fit');
    expect(
      originalFileName(
        { name: '🏃', startDate: new Date('2026-01-06T07:00:00Z') },
        'FIT',
      ),
    ).toBe('2026-01-06-activity.fit');
  });
});
