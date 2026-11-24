// @vitest-environment jsdom
import { act } from 'react';
import { type Root, createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminSettingsDto, AdminUserDto } from '@openathlete/shared';

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
  setMode: vi.fn(),
  setDisabled: vi.fn(),
}));
vi.mock('@/api/admin', () => ({
  useAdminSettingsQuery: () => ({ data: state.settings }),
  useAdminUsersQuery: () => ({ data: state.users }),
  useSetSignupModeMutation: () => ({ mutate: state.setMode, isPending: false }),
  useSetUserDisabledMutation: () => ({
    mutate: state.setDisabled,
    isPending: false,
  }),
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
    expect(rows[0].querySelector('button')).toBeNull();
    expect(rows[1].textContent).toContain('ben@example.com');
    expect(rows[1].textContent).toContain('SUUNTO');
    expect(rows[1].textContent).toContain('admin_user_lock');
    expect(rows[2].textContent).toContain('admin_user_locked');
  });

  it('asks before locking, and unlocks at once', () => {
    render();
    click('[data-admin-user="2"] button');
    expect(state.setDisabled).not.toHaveBeenCalled();
    click('[data-confirm-lock]');
    expect(state.setDisabled).toHaveBeenCalledWith(
      { userId: 2, disabled: true },
      expect.anything(),
    );

    click('[data-admin-user="3"] button');
    expect(state.setDisabled).toHaveBeenLastCalledWith(
      { userId: 3, disabled: false },
      expect.anything(),
    );
  });
});
