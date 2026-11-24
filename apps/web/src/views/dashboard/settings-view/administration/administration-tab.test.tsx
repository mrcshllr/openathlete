// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AdminActionDto,
  AdminInvitationDto,
  AdminSettingsDto,
  AdminSystemDto,
  AdminUserDto,
} from '@openathlete/shared';

import { AdministrationTab } from './administration-tab';

// Every message renders as its key
vi.mock('@/paraglide/messages', () => ({
  m: new Proxy({}, { get: (_target, key) => () => String(key) }),
}));
vi.mock('@/paraglide/runtime', () => ({ getLocale: () => 'en' }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const state = vi.hoisted(() => ({
  settings: undefined as AdminSettingsDto | undefined,
  users: undefined as AdminUserDto[] | undefined,
  invitations: [] as AdminInvitationDto[],
  system: undefined as AdminSystemDto | undefined,
  actions: [] as AdminActionDto[],
  setMode: vi.fn(),
  setDisabled: vi.fn(),
  deleteUser: vi.fn(),
  resetPassword: vi.fn(),
  createInvitation: vi.fn(),
  revokeInvitation: vi.fn(),
}));
vi.mock('@/api/admin', () => ({
  useAdminSettingsQuery: () => ({ data: state.settings }),
  useAdminUsersQuery: () => ({ data: state.users }),
  useSetSignupModeMutation: () => ({ mutate: state.setMode, isPending: false }),
  useSetUserDisabledMutation: () => ({
    mutate: state.setDisabled,
    isPending: false,
  }),
  useDeleteUserMutation: () => ({ mutate: state.deleteUser, isPending: false }),
  useResetPasswordMutation: () => ({
    mutate: state.resetPassword,
    isPending: false,
  }),
  useAdminInvitationsQuery: () => ({ data: state.invitations }),
  useCreateInvitationMutation: () => ({
    mutate: state.createInvitation,
    isPending: false,
  }),
  useRevokeInvitationMutation: () => ({
    mutate: state.revokeInvitation,
    isPending: false,
  }),
  useAdminSystemQuery: () => ({ data: state.system }),
  useAdminActionsQuery: () => ({ data: state.actions }),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const user = (overrides: Partial<AdminUserDto>): AdminUserDto => ({
  userId: 1,
  firstName: 'Ana',
  lastName: 'Admin',
  email: 'ana@example.com',
  roles: ['ATHLETE'],
  admin: false,
  createdAt: new Date('2026-01-05'),
  lastSeenAt: null,
  disabledAt: null,
  activities: 12,
  lastActivityAt: null,
  providers: [],
  athletes: 0,
  coaches: 0,
  storageBytes: 12_400_000,
  ...overrides,
});

describe('AdministrationTab', () => {
  let container: HTMLDivElement;
  let root: Root;
  const render = () => act(() => root.render(<AdministrationTab />));
  const click = (selector: string) =>
    act(() =>
      document
        .querySelector<HTMLElement>(selector)!
        .dispatchEvent(new MouseEvent('click', { bubbles: true })),
    );

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.clearAllMocks();
    state.settings = {
      signupMode: 'closed',
      signupModeDefault: 'closed',
      signupModeOverridden: false,
    };
    state.invitations = [
      {
        kind: 'INSTANCE',
        id: 5,
        recipient: 'For Ben',
        sender: 'Ana Admin',
        createdAt: new Date('2026-11-24'),
        expiresAt: new Date('2026-12-01'),
        url: 'https://train.example.com/auth/create-account?invitation=inst_x',
      },
      {
        kind: 'ATHLETE',
        id: 9,
        recipient: 'friend@example.com',
        sender: 'Ben Runner',
        createdAt: new Date('2026-11-23'),
        expiresAt: new Date('2026-11-30'),
        url: null,
      },
    ];
    state.system = {
      users: 3,
      activities: 3303,
      databaseBytes: 2_400_000_000,
      activityBytes: 1_100_000_000,
      queues: [
        {
          name: 'activity-import',
          waiting: 2,
          active: 1,
          delayed: 0,
          failed: 3,
        },
        { name: 'coros-sync', waiting: 0, active: 0, delayed: 0, failed: 0 },
      ],
    };
    state.actions = [
      {
        adminActionId: 2,
        admin: 'Ana Admin',
        action: 'USER_LOCKED',
        target: 'c***@example.com',
        detail: null,
        createdAt: new Date('2026-11-24T10:00:00Z'),
      },
    ];
    state.users = [
      user({ admin: true }),
      user({
        userId: 2,
        firstName: 'Ben',
        lastName: 'Runner',
        email: 'ben@example.com',
        roles: ['ATHLETE', 'COACH'],
        providers: ['SUUNTO'],
      }),
      user({
        userId: 3,
        firstName: 'Cleo',
        lastName: 'Locked',
        disabledAt: new Date('2026-11-20'),
      }),
    ];
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('marks the sign-up mode in effect and says where it comes from', () => {
    render();
    const checked = container.querySelector('[aria-checked="true"]');
    expect(checked?.getAttribute('data-signup-mode')).toBe('closed');
    expect(container.textContent).toContain('admin_signup_from_env');
    expect(container.textContent).not.toContain('admin_signup_reset');
  });

  it('chooses another mode, and goes back to the configuration', () => {
    render();
    click('[data-signup-mode="invite"]');
    expect(state.setMode).toHaveBeenCalledWith('invite', expect.anything());

    state.settings = {
      signupMode: 'invite',
      signupModeDefault: 'closed',
      signupModeOverridden: true,
    };
    render();
    expect(container.textContent).toContain('admin_signup_overridden');
    const reset = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'admin_signup_reset',
    )!;
    act(() => reset.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(state.setMode).toHaveBeenLastCalledWith(null, expect.anything());
  });

  it('lists the accounts, and offers no lock on an administrator', () => {
    render();
    const rows = container.querySelectorAll('[data-admin-user]');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('admin_user_administrator');
    // An administrator can be handed a password link, nothing more
    expect(
      [...rows[0].querySelectorAll('button')].map((button) =>
        button.getAttribute('data-action'),
      ),
    ).toEqual(['reset']);
    expect(rows[1].textContent).toContain('12 MB');
    expect(rows[1].textContent).toContain('ben@example.com');
    expect(rows[1].textContent).toContain('SUUNTO');
    expect(rows[1].textContent).toContain('admin_user_lock');
    expect(rows[2].textContent).toContain('admin_user_locked');
  });

  it('asks before locking, and unlocks at once', () => {
    render();
    click('[data-admin-user="2"] [data-action="lock"]');
    expect(state.setDisabled).not.toHaveBeenCalled();
    click('[data-confirm-lock]');
    expect(state.setDisabled).toHaveBeenCalledWith(
      { userId: 2, disabled: true },
      expect.anything(),
    );

    click('[data-admin-user="3"] [data-action="unlock"]');
    expect(state.setDisabled).toHaveBeenLastCalledWith(
      { userId: 3, disabled: false },
      expect.anything(),
    );
  });

  it('deletes an account only once its email is typed', () => {
    render();
    click('[data-admin-user="2"] [data-action="delete"]');
    const confirm = () =>
      document.querySelector<HTMLButtonElement>('[data-confirm-delete]')!;
    expect(confirm().disabled).toBe(true);

    const input = document.querySelector<HTMLInputElement>(
      '[data-confirm-email]',
    )!;
    const setValue = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!;
    act(() => {
      setValue.call(input, ' Ben@Example.com ');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(confirm().disabled).toBe(false);
    click('[data-confirm-delete]');
    expect(state.deleteUser).toHaveBeenCalledWith(2, expect.anything());
  });

  it('shows the password link to pass on when the server sends no email', () => {
    state.resetPassword.mockImplementation(
      (_userId: number, options: { onSuccess: (result: object) => void }) =>
        options.onSuccess({
          sent: false,
          url: 'https://train.example.com/auth/password-reset?token=abc',
        }),
    );
    render();
    click('[data-admin-user="2"] [data-action="reset"]');
    expect(
      document.querySelector<HTMLInputElement>('[data-reset-link]')?.value,
    ).toBe('https://train.example.com/auth/password-reset?token=abc');
  });

  it('creates a sign-up link, lists the open invitations and takes one back', () => {
    render();
    click('[data-create-invitation]');
    expect(state.createInvitation).toHaveBeenCalledWith(
      undefined,
      expect.anything(),
    );

    const rows = container.querySelectorAll('[data-invitation]');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('For Ben');
    expect(rows[0].textContent).toContain('admin_link_copy');
    expect(rows[1].textContent).toContain('friend@example.com');
    expect(rows[1].textContent).not.toContain('admin_link_copy');

    click('[data-invitation="ATHLETE-9"] [data-revoke]');
    expect(state.revokeInvitation).toHaveBeenCalledWith(
      { kind: 'ATHLETE', id: 9 },
      expect.anything(),
    );
  });

  it('says what the server stores, its busy queues and what was done', () => {
    render();
    const system = container.querySelector('[data-admin-system]')!;
    expect(system.textContent).toContain('3303');
    expect(system.textContent).toContain('2.4 GB');
    const queues = container.querySelector('[data-admin-queues]')!;
    expect(queues.textContent).toContain('activity-import');
    expect(queues.textContent).not.toContain('coros-sync');
    const log = container.querySelector('[data-admin-actions]')!;
    expect(log.textContent).toContain('admin_action_user_locked');
    expect(log.textContent).toContain('c***@example.com');
  });
});
