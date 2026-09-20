export {CLI_VERSION, SCHEMA_VERSION} from './release-version.js'
import {CLI_VERSION} from './release-version.js'
import {assertCompatibleVersion as assertVersion} from '@vizualmodel/vmblu-core/types/model/version-policy.js'
export {parseVmbluVersion, compatibilityFamily, versionsAreCompatible, familyRange} from '@vizualmodel/vmblu-core/types/model/version-policy.js'

export function assertCompatibleVersion(actualVersion, label = 'artifact', expectedVersion = CLI_VERSION) {
  return assertVersion(actualVersion, label, expectedVersion)
}
