import { randomBytes } from 'node:crypto';

import { PrismaService } from 'src/modules/prisma/services/prisma.service';

/**
 * Selfhost: the administrator's sign-up links. They travel as an invitation
 * token, like a coach's invitation, and are told apart by their prefix: they
 * let an account be created and tie it to nobody.
 */
const PREFIX = 'inst_';
export const INSTANCE_INVITATION_DAYS = 7;
const VALIDITY_MS = INSTANCE_INVITATION_DAYS * 24 * 3600 * 1000;

type Db = Pick<PrismaService, 'instanceInvitation'>;

export const isInstanceInvitationToken = (token?: string | null): boolean =>
  !!token?.startsWith(PREFIX);

export const newInstanceInvitationToken = (): string =>
  `${PREFIX}${randomBytes(24).toString('hex')}`;

export const instanceInvitationExpiry = (createdAt: Date): Date =>
  new Date(createdAt.getTime() + VALIDITY_MS);

/** The page the link opens: the sign-up form, as for any invitation */
export const instanceInvitationUrl = (appUrl: string, token: string): string =>
  `${appUrl.replace(/\/+$/, '')}/auth/create-account?invitation=${encodeURIComponent(token)}`;

/** The link's invitation while it can still be used: unused, and recent */
export async function usableInstanceInvitation(
  prisma: Db,
  token: string,
  now = new Date(),
) {
  if (!isInstanceInvitationToken(token)) return null;
  const invitation = await prisma.instanceInvitation.findUnique({
    where: { token },
  });
  if (!invitation || invitation.usedAt) return null;
  return instanceInvitationExpiry(invitation.createdAt) > now
    ? invitation
    : null;
}

/** Spends the link: the account it let in is the only one it ever will */
export async function consumeInstanceInvitation(
  prisma: Db,
  token: string,
  userId: number,
) {
  await prisma.instanceInvitation.updateMany({
    where: { token, usedAt: null },
    data: { usedAt: new Date(), usedByUserId: userId },
  });
}
