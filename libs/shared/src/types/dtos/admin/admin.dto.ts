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
  /** Bytes its activities take in the database: streams and original files */
  storageBytes: z.number(),
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

export const adminPasswordResetSchema = z.object({
  /** Whether the link went to the account by email */
  sent: z.boolean(),
  /** Without email on the instance: the link, for the administrator to pass on */
  url: z.string().nullable(),
});
export type AdminPasswordResetDto = z.infer<typeof adminPasswordResetSchema>;

export const createInstanceInvitationSchema = z.object({
  /** For whom it is: only the administrator reads it */
  label: z.string().trim().max(80).optional(),
});
export type CreateInstanceInvitationDto = z.infer<
  typeof createInstanceInvitationSchema
>;

/** An invitation still open on the instance, whoever sent it */
export const adminInvitationSchema = z.object({
  /** INSTANCE: the administrator's link; ATHLETE, COACH: sent by a user */
  kind: z.enum(['INSTANCE', 'ATHLETE', 'COACH']),
  id: z.number(),
  /** Who it is for: the label of a link, the email of an invitation */
  recipient: z.string().nullable(),
  /** Who sent it */
  sender: z.string(),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date(),
  /** The link to hand over: the administrator's own links only */
  url: z.string().nullable(),
});
export type AdminInvitationDto = z.infer<typeof adminInvitationSchema>;

export const adminQueueSchema = z.object({
  name: z.string(),
  waiting: z.number(),
  active: z.number(),
  delayed: z.number(),
  failed: z.number(),
});

/** How the instance is doing: what it stores and what it still has to do */
export const adminSystemSchema = z.object({
  users: z.number(),
  activities: z.number(),
  /** Bytes of the whole database */
  databaseBytes: z.number(),
  /** Bytes of the activities: streams and original files */
  activityBytes: z.number(),
  queues: z.array(adminQueueSchema),
});
export type AdminSystemDto = z.infer<typeof adminSystemSchema>;

export const ADMIN_ACTIONS = [
  'USER_LOCKED',
  'USER_UNLOCKED',
  'USER_DELETED',
  'PASSWORD_RESET',
  'SIGNUP_MODE_SET',
  'INVITATION_CREATED',
  'INVITATION_REVOKED',
] as const;
export type AdminActionType = (typeof ADMIN_ACTIONS)[number];

export const adminActionSchema = z.object({
  adminActionId: z.number(),
  /** The administrator, by name */
  admin: z.string(),
  action: z.string(),
  /** The account it was done to: its masked email */
  target: z.string().nullable(),
  detail: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type AdminActionDto = z.infer<typeof adminActionSchema>;
