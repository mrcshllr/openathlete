import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';

import { AccountDeletionService } from '../auth/services/account-deletion.service';
import { InstanceSettingsService } from '../auth/services/instance-settings.service';
import { TokenService } from '../auth/services/token.service';
import { PrismaService } from '../prisma/services/prisma.service';
import { QueueService } from '../queue/queue.service';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

describe('administration wiring', () => {
  // What the module's own classes ask for is what its imports provide:
  // AuthModule (settings, deletion, tokens), QueueModule and the globals
  it('resolves the controller from the providers its module imports', async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        AdminService,
        AdminGuard,
        ...[
          PrismaService,
          InstanceSettingsService,
          ConfigService,
          AccountDeletionService,
          TokenService,
          EventEmitter2,
          QueueService,
        ].map((provide) => ({ provide, useValue: {} })),
      ],
    }).compile();

    expect(module.get(AdminController)).toBeInstanceOf(AdminController);
  });
});
