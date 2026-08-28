# sysblu manager

Own the active system configuration and the `sysmod` system modifier. Accept an
active document from the host, validate and initialize its editable state, and
report whether loading succeeded or failed. Save the authoritative document
when requested through the host-compatible document lifecycle interface.

Apply every authored change through sysmod so changes are reversible. Maintain
undo and redo history, reply with `sysmod.done`, and publish a complete
`system.updated` snapshot after load, change, undo, or redo. The snapshot is the
only system state consumed by the view.

Endpoint deletion removes incident connections in the same reversible change.
Connection metadata edits preserve message and extension details that the
current inspector does not expose.

Do not own canvas presentation, selection, hover, drag, zoom, pan, dialogs, or
other transient UI state. Preserve system properties that the current editor
does not yet understand whenever the document can be safely round-tripped.
