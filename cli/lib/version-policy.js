export {CLI_VERSION, SCHEMA_VERSION} from './release-version.js'
import {CLI_VERSION} from './release-version.js'

export function parseVmbluVersion(version, label = 'version') {
  const match = String(version ?? '').match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/)
  if (!match) throw new Error(`Invalid vmblu ${label}: ${version}`)
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    family: `${match[1]}.${match[2]}`
  }
}

export function compatibilityFamily(version) {
  return parseVmbluVersion(version).family
}

export function versionsAreCompatible(left, right) {
  return compatibilityFamily(left) === compatibilityFamily(right)
}

export function assertCompatibleVersion(actualVersion, label = 'artifact', expectedVersion = CLI_VERSION) {
  const expectedFamily = compatibilityFamily(expectedVersion)
  const actualFamily = compatibilityFamily(actualVersion)
  if (actualFamily !== expectedFamily) {
    throw new Error(
      `Incompatible ${label} version ${actualVersion}; vmblu ${expectedVersion} requires compatibility family ${expectedFamily}. ` +
      `Migrate the project before continuing.`
    )
  }
  return actualFamily
}

export function familyRange(version) {
  const parsed = parseVmbluVersion(version)
  return `>=${parsed.major}.${parsed.minor}.0 <${parsed.major}.${parsed.minor + 1}.0`
}
