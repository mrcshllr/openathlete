import {
  useAdminUsersQuery,
  useDeleteUserMutation,
  useResetPasswordMutation,
  useSetUserDisabledMutation,
} from '@/api/admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { m } from '@/paraglide/messages';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { AdminUserDto } from '@openathlete/shared';

import {
  SettingsPanel,
  SettingsRow,
  SettingsRowsSkeleton,
  SettingsSection,
} from '../settings-section';
import { dayFormat, formatBytes } from './admin-format';

const fullName = (user: AdminUserDto) =>
  `${user.firstName} ${user.lastName}`.trim() || user.email;

type Pending =
  | { kind: 'lock' | 'delete'; user: AdminUserDto }
  | { kind: 'link'; user: AdminUserDto; url: string }
  | null;

/** The accounts of the instance, and what the administrator can do to each */
export function UsersSection() {
  const { data: users } = useAdminUsersQuery();
  const setDisabled = useSetUserDisabledMutation();
  const deleteUser = useDeleteUserMutation();
  const resetPassword = useResetPasswordMutation();
  const [pending, setPending] = useState<Pending>(null);
  // Deleting is for good: the account's email has to be typed
  const [typed, setTyped] = useState('');
  const dateFormat = useMemo(dayFormat, []);
  const busy =
    setDisabled.isPending || deleteUser.isPending || resetPassword.isPending;
  const close = () => {
    setPending(null);
    setTyped('');
  };

  const lock = (user: AdminUserDto, disabled: boolean) =>
    setDisabled.mutate(
      { userId: user.userId, disabled },
      {
        onSuccess: () =>
          toast.success(
            disabled
              ? m.admin_user_locked_toast()
              : m.admin_user_unlocked_toast(),
          ),
        onError: () => toast.error(m.admin_user_action_failed()),
        onSettled: close,
      },
    );
  const remove = (user: AdminUserDto) =>
    deleteUser.mutate(user.userId, {
      onSuccess: () => toast.success(m.admin_user_deleted_toast()),
      onError: () => toast.error(m.admin_user_action_failed()),
      onSettled: close,
    });
  const reset = (user: AdminUserDto) =>
    resetPassword.mutate(user.userId, {
      onSuccess: ({ sent, url }) => {
        if (sent || !url) toast.success(m.admin_user_reset_sent());
        // No email on this server: the administrator passes the link on
        else setPending({ kind: 'link', user, url });
      },
      onError: () => toast.error(m.admin_user_action_failed()),
    });
  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(m.admin_link_copied());
    } catch {
      toast.error(m.admin_link_copy_failed());
    }
  };

  return (
    <SettingsSection
      title={
        users
          ? `${m.admin_users_title()} (${users.length})`
          : m.admin_users_title()
      }
      description={m.admin_users_description()}
    >
      {!users ? (
        <SettingsRowsSkeleton count={3} />
      ) : (
        <SettingsPanel>
          {users.map((user) => (
            <SettingsRow
              key={user.userId}
              stacked
              data-admin-user={user.userId}
              title={
                <span className="flex flex-wrap items-center gap-1.5">
                  {fullName(user)}
                  {user.admin && (
                    <Badge variant="secondary">
                      {m.admin_user_administrator()}
                    </Badge>
                  )}
                  {user.roles.includes('COACH') && (
                    <Badge variant="outline">{m.coach()}</Badge>
                  )}
                  {user.disabledAt && (
                    <Badge variant="destructive">{m.admin_user_locked()}</Badge>
                  )}
                </span>
              }
              description={
                <>
                  <span className="block">{user.email}</span>
                  <span className="block">
                    {[
                      m.admin_user_registered({
                        date: dateFormat.format(user.createdAt),
                      }),
                      user.lastSeenAt
                        ? m.admin_user_last_seen({
                            date: dateFormat.format(user.lastSeenAt),
                          })
                        : m.admin_user_never_seen(),
                      m.admin_user_activities({ count: user.activities }),
                      formatBytes(user.storageBytes),
                      ...user.providers,
                    ].join(' · ')}
                  </span>
                </>
              }
            >
              <Button
                variant="ghost"
                size="sm"
                data-action="reset"
                disabled={busy}
                onClick={() => reset(user)}
              >
                {m.admin_user_reset()}
              </Button>
              {/* An administrator always stays able to undo what was done */}
              {!user.admin &&
                (user.disabledAt ? (
                  <Button
                    variant="outline"
                    size="sm"
                    data-action="unlock"
                    disabled={busy}
                    onClick={() => lock(user, false)}
                  >
                    {m.admin_user_unlock()}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    data-action="lock"
                    disabled={busy}
                    onClick={() => setPending({ kind: 'lock', user })}
                  >
                    {m.admin_user_lock()}
                  </Button>
                ))}
              {!user.admin && (
                <Button
                  variant="ghost"
                  size="sm"
                  data-action="delete"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => setPending({ kind: 'delete', user })}
                >
                  {m.admin_user_delete()}
                </Button>
              )}
            </SettingsRow>
          ))}
        </SettingsPanel>
      )}
      <Dialog open={pending !== null} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          {pending?.kind === 'lock' && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {m.admin_user_lock_title({ name: fullName(pending.user) })}
                </DialogTitle>
                <DialogDescription>
                  {m.admin_user_lock_text()}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={close}>
                  {m.cancel()}
                </Button>
                <Button
                  variant="destructive"
                  data-confirm-lock
                  disabled={busy}
                  onClick={() => lock(pending.user, true)}
                >
                  {m.admin_user_lock()}
                </Button>
              </DialogFooter>
            </>
          )}
          {pending?.kind === 'delete' && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {m.admin_user_delete_title({ name: fullName(pending.user) })}
                </DialogTitle>
                <DialogDescription>
                  {m.admin_user_delete_text({ email: pending.user.email })}
                </DialogDescription>
              </DialogHeader>
              <Input
                data-confirm-email
                autoComplete="off"
                value={typed}
                placeholder={pending.user.email}
                onChange={(event) => setTyped(event.target.value)}
              />
              <DialogFooter>
                <Button variant="outline" onClick={close}>
                  {m.cancel()}
                </Button>
                <Button
                  variant="destructive"
                  data-confirm-delete
                  disabled={
                    busy ||
                    typed.trim().toLowerCase() !==
                      pending.user.email.toLowerCase()
                  }
                  onClick={() => remove(pending.user)}
                >
                  {m.admin_user_delete_confirm()}
                </Button>
              </DialogFooter>
            </>
          )}
          {pending?.kind === 'link' && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {m.admin_user_reset_link_title({
                    name: fullName(pending.user),
                  })}
                </DialogTitle>
                <DialogDescription>
                  {m.admin_user_reset_link_text()}
                </DialogDescription>
              </DialogHeader>
              <Input readOnly data-reset-link value={pending.url} />
              <DialogFooter>
                <Button variant="outline" onClick={close}>
                  {m.ui_close()}
                </Button>
                <Button onClick={() => copy(pending.url)}>
                  {m.admin_link_copy()}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}
