import { z } from 'zod';

/** Who may create an account on the instance */
export const signupModeSchema = z.enum(['open', 'invite', 'closed']);
export type SignupMode = z.infer<typeof signupModeSchema>;

export const adminAccessSchema = z.object({
  /** Whether the signed-in user administers the instance */
  admin: z.boolean(),
});
export type AdminAccessDto = z.infer<typeof adminAccessSchema>;

/**
 * An account as the administrator sees it: who it is and how it is used,
 * never what was trained
 */
export const adminUserSchema = z.object({
  userId: z.number(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  roles: z.array(z.string()),
  admin: z.boolean(),
  createdAt: z.coerce.date(),
  /** The last sign-in or session renewal; null before this was recorded */
  lastSeenAt: z.coerce.date().nullable(),
  /** Set while the account is locked out */
  disabledAt: z.coerce.date().nullable(),
  activities: z.number(),
  lastActivityAt: z.coerce.date().nullable(),
  /** Connected services, by name (STRAVA, SUUNTO…) */
  providers: z.array(z.string()),
  /** Athletes this user coaches, and coaches of this user */
  athletes: z.number(),
  coaches: z.number(),
});
export type AdminUserDto = z.infer<typeof adminUserSchema>;

export const adminSettingsSchema = z.object({
  signupMode: signupModeSchema,
  /** What SIGNUP_MODE says: used until the administrator chooses */
  signupModeDefault: signupModeSchema,
  /** Whether the administrator's choice is in effect */
  signupModeOverridden: z.boolean(),
});
export type AdminSettingsDto = z.infer<typeof adminSettingsSchema>;

export const updateSignupModeSchema = z.object({
  /** null goes back to SIGNUP_MODE */
  mode: signupModeSchema.nullable(),
});
export type UpdateSignupModeDto = z.infer<typeof updateSignupModeSchema>;
