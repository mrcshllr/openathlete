import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { RecordController } from './record.controller';

describe('RecordController', () => {
  // Every route reads the signed-in user: one without its guards answers
  // with an error instead of the records
  it('guards every route', () => {
    const prototype = RecordController.prototype as unknown as Record<
      string,
      object
    >;
    const routes = Object.getOwnPropertyNames(prototype).filter(
      (name) =>
        name !== 'constructor' &&
        Reflect.getMetadata(PATH_METADATA, prototype[name]) !== undefined,
    );
    expect(routes.length).toBeGreaterThan(5);
    const unguarded = routes.filter(
      (name) =>
        !Reflect.getMetadata(GUARDS_METADATA, prototype[name]) &&
        !Reflect.getMetadata(GUARDS_METADATA, RecordController),
    );
    expect(unguarded).toEqual([]);
  });
});
