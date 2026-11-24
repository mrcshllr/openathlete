import { useAdminSettingsQuery, useSetSignupModeMutation } from '@/api/admin';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';
import { cn } from '@/utils/shadcn';
import { Check } from 'lucide-react';
import { toast } from 'sonner';

import { SignupMode } from '@openathlete/shared';

import {
  SettingsPanel,
  SettingsRowsSkeleton,
  SettingsSection,
} from '../settings-section';
import { ActionsSection } from './actions-section';
import { InvitationsSection } from './invitations-section';
import { SystemSection } from './system-section';
import { UsersSection } from './users-section';

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

/** The instance's administration, for its administrators only. */
export function AdministrationTab() {
  return (
    <div className="space-y-8">
      <SignupSection />
      <InvitationsSection />
      <UsersSection />
      <SystemSection />
      <ActionsSection />
    </div>
  );
}
