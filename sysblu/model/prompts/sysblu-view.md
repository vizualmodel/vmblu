# sysblu view

Own all graphical presentation and direct user interaction for the active
system configuration. Render application nodes, using their `vmblu` flag to
distinguish vmblu and non-vmblu participants, and render their
connections, labels, selection, and interaction feedback. Own transient view
state such as selection, hover, drag state, zoom, and pan.

Consume complete `system.updated` snapshots from the sysblu manager. Convert
gestures that change authored system data into `sysmod.doit` commands; request
undo and redo through the corresponding sysmod pins. Never mutate or retain an
independent authoritative copy of the system document.

Expose the drawable canvas and respond to host size changes. Emit
`open reference` when the user follows an application, system prompt,
documentation, build, deployment, test, or operations reference. Resolve an
`application prompt` request to the explicit project-level `prompt` reference.
References with both a command and working directory show a command marker.
Ctrl/Cmd-click emits `execute command` with the working directory resolved
relative to the active system document; ordinary clicks continue to open the
target. Never interpret or execute terminal command text inside sysblu.
Open the application inspector for every selected node and translate
its accepted result into one `editApplication` sysmod command. Do not perform
file access itself. Use the same inspector to add an application from the host
menu and to delete an existing application through its trash action; express
each accepted structural change as one sysmod command. New applications are
vmblu applications by default. The inspector edits the node-level references
and the `vmblu` rendering flag; it has no separate entrypoint field.

Expose endpoint editing from each application card: the title-bar add action
creates an endpoint and selecting an endpoint row edits or deletes it. Endpoint
editing owns name, one optional protocol file-or-webpage reference,
client/server/peer role, and
optional remarks. Derive the displayed protocol label from the referenced
filename without its complete `.protocol.json` suffix. Let the shared endpoint
inspector open the current protocol-file value through `open reference`, resolved
relative to the active system document. Starting a drag on an endpoint connector
and completing it on another endpoint opens the
shared Transport inspector with an explicit `unspecified` default. Selecting an
existing route opens that inspector for transport/remarks editing or deletion.
Connections have no authored name, flow, or arrowheads; label routes with their
transport. Keep connection
gestures transient until an inspector is accepted, and express every accepted
endpoint or connection change as one sysmod command. Endpoints do not own
additional references; supporting files belong to the application node. Do not edit message
payload definitions in this slice.
