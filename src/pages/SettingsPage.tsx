import { GeneralSection } from './settings/GeneralSection'
import { PlatformsSection } from './settings/PlatformsSection'
import { EntriesSection } from './settings/EntriesSection'
import { DataSection } from './settings/DataSection'
import { RatesSection } from './settings/RatesSection'

export function SettingsPage() {
  return (
    <div className="space-y-4">
      <GeneralSection />
      <PlatformsSection />
      <EntriesSection />
      <RatesSection />
      <DataSection />
    </div>
  )
}
