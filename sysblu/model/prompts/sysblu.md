# sysblu application

The sysblu application edits one system configuration without depending on the
vmblu model editor. Its host selects and supplies the active `*.sys.blu`
document. Keep the application boundary small: the view owns presentation and
transient interaction state, while the manager owns the authoritative document
and its reversible mutation history.

UI composition and host-specific file access belong outside these two core
nodes. The application exposes only the canvas, resize, document lifecycle,
application-prompt, and reference-navigation messages needed to integrate
those concerns later.
