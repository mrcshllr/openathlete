import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { instanceKeys } from '../instance';
import { AdminAPI } from './admin.api';

export const adminKeys = {
  getAccess: 'AdminAPI.getAccess',
  getUsers: 'AdminAPI.getUsers',
  getSettings: 'AdminAPI.getSettings',
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

export const useSetUserDisabledMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: AdminAPI.setUserDisabled,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [adminKeys.getUsers] }),
  });
};

export const useSetSignupModeMutation = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: AdminAPI.setSignupMode,
    onSuccess: (settings) => {
      queryClient.setQueryData([adminKeys.getSettings], settings);
      // The sign-in pages read who may sign up from the instance's info
      return queryClient.invalidateQueries({
        queryKey: [instanceKeys.getInstanceInfo],
      });
    },
  });
};
