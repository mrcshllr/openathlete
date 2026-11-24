import {
  useAdminSettingsQuery,
  useAdminUsersQuery,
  useSetSignupModeMutation,
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
import { m } from '@/paraglide/messages';
import { getLocale } from '@/paraglide/runtime';
import { getDateLocale } from '@/utils/locales';
import { cn } from '@/utils/shadcn';
import { Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

import { AdminUserDto, SignupMode } from '@openathlete/shared';

import {
  SettingsPanel,
  SettingsRow,
  SettingsRowsSkeleton,
  SettingsSection,
} from '../settings-section';

const SIGNUP_MODES: {
  mode: SignupMode;
  label: () => string;
  description: () => string;
}[] = [
  {
    mode: 'open',
    label: m.admin_signup_open,
    description: m.admin_signup_open_description,
  },
  {
    mode: 'invite',
    label: m.admin_signup_invite,
    description: m.admin_signup_invite_description,
  },
  {
    mode: 'closed',
    label: m.admin_signup_closed,
    description: m.admin_signup_closed_description,
  },
];

const modeLabel = (mode: SignupMode) =>
  SIGNUP_MODES.find((option) => option.mode === mode)!.label();

/** Who may create an account: the administrator's choice over SIGNUP_MODE */
function SignupSection() {
  const { data: settings } = useAdminSettingsQuery();
  const setMode = useSetSignupModeMutation();

  const choose = (mode: SignupMode | null) =>
    setMode.mutate(mode, {
      onSuccess: () => toast.success(m.admin_signup_saved()),
      onError: () => toast.error(m.admin_signup_failed()),
    });

  return (
    <SettingsSection
      title={m.admin_signup_title()}
      description={m.admin_signup_description()}
    >
      {!settings ? (
        <SettingsRowsSkeleton count={3} />
      ) : (
        <>
          <SettingsPanel role="radiogroup" aria-label={m.admin_signup_title()}>
            {SIGNUP_MODES.map(({ mode, label, description }) => {
              const active = settings.signupMode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-signup-mode={mode}
                  disabled={setMode.isPending}
                  onClick={() => !active && choose(mode)}
                  className={cn(
                    'flex min-h-14 w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left',
                    active ? 'bg-accent/60' : 'hover:bg-accent/30',
                  )}
                >
                  <span className="min-w-0 space-y-0.5">
                    <span className="block text-sm font-medium">{label()}</span>
                    <span className="block text-sm text-muted-foreground">
                      {description()}
                    </span>
                  </span>
                  <Check
                    className={cn(
                      'size-4 shrink-0',
                      active ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                </button>
              );
            })}
          </SettingsPanel>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-muted-foreground">
            <span>
              {settings.signupModeOverridden
                ? m.admin_signup_overridden({
                    mode: modeLabel(settings.signupModeDefault),
                  })
                : m.admin_signup_from_env()}
            </span>
            {settings.signupModeOverridden && (
              <Button
                variant="ghost"
                size="sm"
                disabled={setMode.isPending}
                onClick={() => choose(null)}
              >
                {m.admin_signup_reset()}
              </Button>
            )}
          </div>
        </>
      )}
    </SettingsSection>
  );
}

const fullName = (user: AdminUserDto) =>
  `${user.firstName} ${user.lastName}`.trim() || user.email;

/** The accounts of the instance, and the lock on each */
function UsersSection() {
  const { data: users } = useAdminUsersQuery();
  const setDisabled = useSetUserDisabledMutation();
  const [locking, setLocking] = useState<AdminUserDto | null>(null);
  const dateFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(getDateLocale(getLocale()), {
        dateStyle: 'medium',
      }),
    [],
  );

  const change = (user: AdminUserDto, disabled: boolean) =>
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
        onSettled: () => setLocking(null),
      },
    );

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
                      ...user.providers,
                    ].join(' · ')}
                  </span>
                </>
              }
            >
              {/* An administrator always stays able to undo a lock */}
              {!user.admin &&
                (user.disabledAt ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={setDisabled.isPending}
                    onClick={() => change(user, false)}
                  >
                    {m.admin_user_unlock()}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={setDisabled.isPending}
                    onClick={() => setLocking(user)}
                  >
                    {m.admin_user_lock()}
                  </Button>
                ))}
            </SettingsRow>
          ))}
        </SettingsPanel>
      )}
      <Dialog
        open={locking !== null}
        onOpenChange={(open) => !open && setLocking(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {m.admin_user_lock_title({
                name: locking ? fullName(locking) : '',
              })}
            </DialogTitle>
            <DialogDescription>{m.admin_user_lock_text()}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLocking(null)}>
              {m.cancel()}
            </Button>
            <Button
              variant="destructive"
              data-confirm-lock
              disabled={setDisabled.isPending}
              onClick={() => locking && change(locking, true)}
            >
              {m.admin_user_lock()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsSection>
  );
}

/** The instance's administration: who may sign up, and its accounts. */
export function AdministrationTab() {
  return (
    <div className="space-y-8">
      <SignupSection />
      <UsersSection />
    </div>
  );
}
