import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ApiEnvSchemaType,
  SignupMode,
  signupModeSchema,
} from '@openathlete/shared';

import { PrismaService } from 'src/modules/prisma/services/prisma.service';

const SIGNUP_MODE_KEY = 'signup_mode';

/** The administrator's choice of sign-up mode, if any */
async function chosenSignupMode(
  prisma: Pick<PrismaService, 'instanceSetting'>,
): Promise<SignupMode | null> {
  const setting = await prisma.instanceSetting.findUnique({
    where: { key: SIGNUP_MODE_KEY },
  });
  const parsed = signupModeSchema.safeParse(setting?.value);
  return parsed.success ? parsed.data : null;
}

/**
 * Who may create an account: what the administrator chose, else SIGNUP_MODE.
 * A function, for the services that sign users up without this one.
 */
export async function currentSignupMode(
  prisma: Pick<PrismaService, 'instanceSetting'>,
  config: ConfigService<ApiEnvSchemaType, true>,
): Promise<SignupMode> {
  return (
    (await chosenSignupMode(prisma)) ?? config.get('SIGNUP_MODE') ?? 'open'
  );
}

/**
 * Who administers the instance, and what they set for it over its
 * environment. The administrators themselves stay in the environment: a
 * mistake in the app can then neither lock the last one out nor make one.
 */
@Injectable()
export class InstanceSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ApiEnvSchemaType, true>,
  ) {}

  /** SIGNUP_MODE: what holds until the administrator chooses */
  signupModeDefault(): SignupMode {
    return this.config.get('SIGNUP_MODE') ?? 'open';
  }

  signupMode(): Promise<SignupMode> {
    return currentSignupMode(this.prisma, this.config);
  }

  async signupSettings() {
    const chosen = await chosenSignupMode(this.prisma);
    const signupModeDefault = this.signupModeDefault();
    return {
      signupMode: chosen ?? signupModeDefault,
      signupModeDefault,
      signupModeOverridden: chosen !== null,
    };
  }

  /** null goes back to SIGNUP_MODE */
  async setSignupMode(mode: SignupMode | null) {
    if (mode === null) {
      await this.prisma.instanceSetting.deleteMany({
        where: { key: SIGNUP_MODE_KEY },
      });
    } else {
      await this.prisma.instanceSetting.upsert({
        where: { key: SIGNUP_MODE_KEY },
        create: { key: SIGNUP_MODE_KEY, value: mode },
        update: { value: mode },
      });
    }
    return this.signupSettings();
  }

  private adminEmails(): string[] {
    const emails: string = this.config.get('ADMIN_EMAILS') ?? '';
    return emails
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
  }

  /**
   * The ids of the administrators: the accounts of ADMIN_EMAILS, or without
   * it the first account of the instance, the one that set it up.
   */
  async adminUserIds(): Promise<number[]> {
    const emails = this.adminEmails();
    if (emails.length > 0) {
      const users = await this.prisma.user.findMany({
        where: { email: { in: emails } },
        select: { userId: true },
      });
      return users.map((user) => user.userId);
    }
    const first = await this.prisma.user.findFirst({
      orderBy: { userId: 'asc' },
      select: { userId: true },
    });
    return first ? [first.userId] : [];
  }

  async isAdmin(userId: number): Promise<boolean> {
    return (await this.adminUserIds()).includes(userId);
  }
}
