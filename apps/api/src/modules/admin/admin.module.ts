import { Module } from '@nestjs/common';

import { AuthModule } from '../auth';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';

/** The instance's administration: its accounts and its sign-up mode */
@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
