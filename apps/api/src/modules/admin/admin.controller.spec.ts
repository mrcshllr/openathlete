import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';

import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';

describe('AdminController', () => {
  const prototype = AdminController.prototype as unknown as Record<
    string,
    object
  >;
  const routes = Object.getOwnPropertyNames(prototype).filter(
    (name) =>
      name !== 'constructor' &&
      Reflect.getMetadata(PATH_METADATA, prototype[name]) !== undefined,
  );
  const guards = (name: string): unknown[] =>
    Reflect.getMetadata(GUARDS_METADATA, prototype[name]) ?? [];

  it('asks every route for a signed-in user', () => {
    expect(routes.length).toBeGreaterThan(4);
    expect(routes.filter((name) => guards(name).length === 0)).toEqual([]);
  });

  // "access" only says whether the user is one: the app asks it for everyone
  it('opens everything but "access" to administrators only', () => {
    expect(routes.filter((name) => !guards(name).includes(AdminGuard))).toEqual(
      ['access'],
    );
  });
});
