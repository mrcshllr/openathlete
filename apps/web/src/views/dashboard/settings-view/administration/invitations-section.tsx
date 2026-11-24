import {
  useAdminInvitationsQuery,
  useCreateInvitationMutation,
  useRevokeInvitationMutation,
} from '@/api/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { m } from '@/paraglide/messages';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { AdminInvitationDto } from '@openathlete/shared';

import {
  SettingsPanel,
  SettingsRow,
  SettingsRowsSkeleton,
  SettingsSection,
} from '../settings-section';
import { dayFormat } from './admin-format';

const title = (invitation: AdminInvitationDto) =>
  invitation.kind === 'INSTANCE'
    ? invitation.recipient || m.admin_invitation_link()
    : (invitation.recipient ?? '');

const origin = (invitation: AdminInvitationDto) =>
  invitation.kind === 'INSTANCE'
    ? m.admin_invitation_from_admin()
    : invitation.kind === 'ATHLETE'
      ? m.admin_invitation_from_coach({ name: invitation.sender })
      : m.admin_invitation_from_athlete({ name: invitation.sender });

/**
 * Sign-up links the administrator hands out, and every invitation still
 * open on the instance, with a way to take each back.
 */
export function InvitationsSection() {
  const { data: invitations } = useAdminInvitationsQuery();
  const create = useCreateInvitationMutation();
  const revoke = useRevokeInvitationMutation();
  const [label, setLabel] = useState('');
  const dateFormat = useMemo(dayFormat, []);

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(m.admin_link_copied());
    } catch {
      toast.error(m.admin_link_copy_failed());
    }
  };
  const createLink = () =>
    create.mutate(label.trim() || undefined, {
      onSuccess: (invitation) => {
        setLabel('');
        if (invitation.url) void copy(invitation.url);
      },
      onError: () => toast.error(m.admin_invitation_failed()),
    });

  return (
    <SettingsSection
      title={m.admin_invitations_title()}
      description={m.admin_invitations_description()}
    >
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          createLink();
        }}
      >
        <Input
          data-invitation-label
          value={label}
          maxLength={80}
          placeholder={m.admin_invitation_label_placeholder()}
          onChange={(event) => setLabel(event.target.value)}
        />
        <Button
          type="submit"
          data-create-invitation
          disabled={create.isPending}
        >
          {m.admin_invitation_create()}
        </Button>
      </form>
      {!invitations ? (
        <SettingsRowsSkeleton count={1} />
      ) : invitations.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          {m.admin_invitations_empty()}
        </p>
      ) : (
        <SettingsPanel>
          {invitations.map((invitation) => (
            <SettingsRow
              key={`${invitation.kind}-${invitation.id}`}
              stacked
              data-invitation={`${invitation.kind}-${invitation.id}`}
              title={title(invitation)}
              description={`${origin(invitation)} · ${m.admin_invitation_expires(
                { date: dateFormat.format(invitation.expiresAt) },
              )}`}
            >
              {invitation.url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copy(invitation.url!)}
                >
                  {m.admin_link_copy()}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                data-revoke
                disabled={revoke.isPending}
                onClick={() =>
                  revoke.mutate(
                    { kind: invitation.kind, id: invitation.id },
                    {
                      onSuccess: () =>
                        toast.success(m.admin_invitation_revoked()),
                      onError: () => toast.error(m.admin_invitation_failed()),
                    },
                  )
                }
              >
                {m.admin_invitation_revoke()}
              </Button>
            </SettingsRow>
          ))}
        </SettingsPanel>
      )}
    </SettingsSection>
  );
}
