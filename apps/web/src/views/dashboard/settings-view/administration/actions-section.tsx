import { useAdminActionsQuery } from '@/api/admin';
import { m } from '@/paraglide/messages';
import { useMemo } from 'react';

import {
  SettingsPanel,
  SettingsRow,
  SettingsRowsSkeleton,
  SettingsSection,
} from '../settings-section';
import { momentFormat } from './admin-format';

const ACTION_LABELS: Record<string, () => string> = {
  USER_LOCKED: m.admin_action_user_locked,
  USER_UNLOCKED: m.admin_action_user_unlocked,
  USER_DELETED: m.admin_action_user_deleted,
  PASSWORD_RESET: m.admin_action_password_reset,
  SIGNUP_MODE_SET: m.admin_action_signup_mode_set,
  INVITATION_CREATED: m.admin_action_invitation_created,
  INVITATION_REVOKED: m.admin_action_invitation_revoked,
};

/** What administrators did, the latest first: nothing here can be changed */
export function ActionsSection() {
  const { data: actions } = useAdminActionsQuery();
  const dateFormat = useMemo(momentFormat, []);

  return (
    <SettingsSection
      title={m.admin_actions_title()}
      description={m.admin_actions_description()}
    >
      {!actions ? (
        <SettingsRowsSkeleton count={2} />
      ) : actions.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          {m.admin_actions_empty()}
        </p>
      ) : (
        <SettingsPanel data-admin-actions>
          {actions.map((action) => (
            <SettingsRow
              key={action.adminActionId}
              title={[
                (ACTION_LABELS[action.action] ?? (() => action.action))(),
                action.target,
                action.detail,
              ]
                .filter(Boolean)
                .join(' · ')}
              description={`${dateFormat.format(action.createdAt)} · ${action.admin}`}
            />
          ))}
        </SettingsPanel>
      )}
    </SettingsSection>
  );
}
