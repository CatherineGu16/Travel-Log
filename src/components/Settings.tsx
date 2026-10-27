import { BackupPanel } from './BackupPanel.tsx'
import { HomePanel } from './HomePanel.tsx'
import { MapDetailPanel } from './MapDetailPanel.tsx'
import { Sheet } from './Sheet.tsx'
import { SyncPanel } from './SyncPanel.tsx'
import { ThemePicker } from './ThemePicker.tsx'

export function Settings({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()} title="Settings">
      <div className="mt-2 space-y-4">
        <SyncPanel />
        <HomePanel />
        <MapDetailPanel />
        <BackupPanel />
        <ThemePicker />
      </div>
    </Sheet>
  )
}
