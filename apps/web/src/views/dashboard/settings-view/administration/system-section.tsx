import { useAdminSystemQuery } from '@/api/admin';
import { m } from '@/paraglide/messages';

import {
  SettingsPanel,
  SettingsRowsSkeleton,
  SettingsSection,
} from '../settings-section';
import { formatBytes } from './admin-format';

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

/** What the instance stores, and what its background queues have left */
export function SystemSection() {
  const { data: system } = useAdminSystemQuery();
  // A queue with nothing in it says nothing
  const busy = system?.queues.filter(
    (queue) => queue.waiting + queue.active + queue.delayed + queue.failed > 0,
  );

  return (
    <SettingsSection
      title={m.admin_system_title()}
      description={m.admin_system_description()}
    >
      {!system ? (
        <SettingsRowsSkeleton count={2} />
      ) : (
        <>
          <SettingsPanel
            className="grid grid-cols-2 divide-y-0 md:grid-cols-4"
            data-admin-system
          >
            <Figure
              label={m.admin_system_users()}
              value={String(system.users)}
            />
            <Figure
              label={m.admin_system_activities()}
              value={String(system.activities)}
            />
            <Figure
              label={m.admin_system_database()}
              value={formatBytes(system.databaseBytes)}
            />
            <Figure
              label={m.admin_system_activity_data()}
              value={formatBytes(system.activityBytes)}
            />
          </SettingsPanel>
          {busy && busy.length === 0 ? (
            <p className="px-1 text-sm text-muted-foreground">
              {m.admin_system_queues_idle()}
            </p>
          ) : (
            <SettingsPanel className="overflow-x-auto" data-admin-queues>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">
                      {m.admin_system_queue()}
                    </th>
                    {[
                      m.admin_system_waiting(),
                      m.admin_system_active(),
                      m.admin_system_delayed(),
                      m.admin_system_failed(),
                    ].map((heading) => (
                      <th
                        key={heading}
                        className="px-4 py-2 text-right font-medium"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {busy?.map((queue) => (
                    <tr key={queue.name} className="border-t">
                      <th
                        scope="row"
                        className="px-4 py-2 text-left font-medium"
                      >
                        {queue.name}
                      </th>
                      {[
                        queue.waiting,
                        queue.active,
                        queue.delayed,
                        queue.failed,
                      ].map((count, index) => (
                        <td
                          key={index}
                          className="px-4 py-2 text-right tabular-nums"
                        >
                          {count}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </SettingsPanel>
          )}
        </>
      )}
    </SettingsSection>
  );
}
