import { BackupPanel } from './BackupPanel.tsx'
import { HomePanel } from './HomePanel.tsx'
import { MapDetailPanel } from './MapDetailPanel.tsx'
import { SyncPanel } from './SyncPanel.tsx'
import { ThemePicker } from './ThemePicker.tsx'

/** You › Settings: sync, where trips start and end, map detail, backups and appearance. */
export function Settings() {
  return (
    <section aria-label="Settings">
      <h2 className="sr-only">Settings</h2>
      <div className="space-y-4">
        <SyncPanel />
        <HomePanel />
        <MapDetailPanel />
        <BackupPanel />
        <ThemePicker />
      </div>
    </section>
  )
}
