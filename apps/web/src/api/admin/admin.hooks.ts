import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { instanceKeys } from '../instance';
import { AdminAPI } from './admin.api';

export const adminKeys = {
  getAccess: 'AdminAPI.getAccess',
  getUsers: 'AdminAPI.getUsers',
  getSettings: 'AdminAPI.getSettings',
  getInvitations: 'AdminAPI.getInvitations',
  getSystem: 'AdminAPI.getSystem',
  getActions: 'AdminAPI.getActions',
} as const;

/** Whether the signed-in user administers the instance */
export const useAdminAccessQuery = () =>
  useQuery({
    queryKey: [adminKeys.getAccess],
    queryFn: AdminAPI.getAccess,
    // Set in the server's configuration: it does not change under the app
    staleTime: Infinity,
  });

export const useAdminUsersQuery = () =>
  useQuery({ queryKey: [adminKeys.getUsers], queryFn: AdminAPI.getUsers });

export const useAdminSettingsQuery = () =>
  useQuery({
    queryKey: [adminKeys.getSettings],
    queryFn: AdminAPI.getSettings,
  });

/** Everything an action changes: the list it is in, and the log */
const useRefresh = (...keys: string[]) => {
  const queryClient = useQueryClient();
  return () =>
    Promise.all(
      [...keys, adminKeys.getActions].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );
};

export const useSetUserDisabledMutation = () => {
  const refresh = useRefresh(adminKeys.getUsers);
  return useMutation({
    mutationFn: AdminAPI.setUserDisabled,
    onSuccess: refresh,
  });
};

export const useDeleteUserMutation = () => {
  const refresh = useRefresh(
    adminKeys.getUsers,
    adminKeys.getSystem,
    adminKeys.getInvitations,
  );
  return useMutation({ mutationFn: AdminAPI.deleteUser, onSuccess: refresh });
};

export const useResetPasswordMutation = () => {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: AdminAPI.resetPassword,
    onSuccess: refresh,
  });
};

export const useAdminInvitationsQuery = () =>
  useQuery({
    queryKey: [adminKeys.getInvitations],
    queryFn: AdminAPI.getInvitations,
  });

export const useCreateInvitationMutation = () => {
  const refresh = useRefresh(adminKeys.getInvitations);
  return useMutation({
    mutationFn: AdminAPI.createInvitation,
    onSuccess: refresh,
  });
};

export const useRevokeInvitationMutation = () => {
  const refresh = useRefresh(adminKeys.getInvitations);
  return useMutation({
    mutationFn: AdminAPI.revokeInvitation,
    onSuccess: refresh,
  });
};

export const useAdminSystemQuery = () =>
  useQuery({ queryKey: [adminKeys.getSystem], queryFn: AdminAPI.getSystem });

export const useAdminActionsQuery = () =>
  useQuery({ queryKey: [adminKeys.getActions], queryFn: AdminAPI.getActions });

export const useSetSignupModeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: AdminAPI.setSignupMode,
    onSuccess: (settings) => {
      queryClient.setQueryData([adminKeys.getSettings], settings);
      void queryClient.invalidateQueries({ queryKey: [adminKeys.getActions] });
      // The sign-in pages read who may sign up from the instance's info
      return queryClient.invalidateQueries({
        queryKey: [instanceKeys.getInstanceInfo],
      });
    },
  });
};
