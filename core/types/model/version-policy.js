// Compatibility is major.minor; patch releases do not require migration.
export function parseVmbluVersion(version, label = 'version') {
    const match = String(version ?? '').match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/)
    if (!match) throw new Error(`Invalid vmblu ${label}: ${version}`)
    return {major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), family: `${match[1]}.${match[2]}`}
}

export function compatibilityFamily(version) {
    return parseVmbluVersion(version).family
}

export function versionsAreCompatible(left, right) {
    return compatibilityFamily(left) === compatibilityFamily(right)
}

export function assertCompatibleVersion(actualVersion, label, expectedVersion) {
    if (!versionsAreCompatible(actualVersion, expectedVersion)) {
        throw new Error(`Incompatible ${label} version ${actualVersion}; vmblu ${expectedVersion} requires compatibility family ${compatibilityFamily(expectedVersion)}. Migrate the project before continuing.`)
    }
    return compatibilityFamily(actualVersion)
}

export function familyRange(version) {
    const {major, minor} = parseVmbluVersion(version)
    return `>=${major}.${minor}.0 <${major}.${minor + 1}.0`
}

// JSON Schema cannot call JavaScript; generate its constraint from this policy.
export function compatibilityVersionPattern(version) {
    const {major, minor} = parseVmbluVersion(version)
    return `^${major}\\.${minor}\\.\\d+(?:[-+].*)?$`
}
