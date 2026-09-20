// Full-editor sessions register live readers, so async file operations never
// rely on a stale snapshot of an editor's dirty flag.
const drafts = new Map()

function key(arl) {
    return String(arl?.url?.href ?? arl?.url ?? arl?.getFullPath?.() ?? arl?.getPath?.())
}

export function registerFileDraft(arl, isDirty) {
    const id = key(arl)
    let readers = drafts.get(id)
    if (!readers) drafts.set(id, readers = new Set())
    readers.add(isDirty)
    return () => {
        readers.delete(isDirty)
        if (!readers.size) drafts.delete(id)
    }
}

export function hasFileDraft(arl) {
    return [...(drafts.get(key(arl)) ?? [])].some(read => read())
}
