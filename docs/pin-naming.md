# Pin names

Inside a named interface, ordinary typed pin names receive the interface name
and a dot automatically. In `items`, typing `add` stores `items.add` and displays
`add` below the interface heading.

To use an absolute message name, type a leading apostrophe: `'add`. An optional
closing apostrophe is accepted too: `'add'`. Both store `add`. The apostrophes
are editor notation, not part of message names or generated handler names.

Existing explicit prefix and suffix notation remains supported: `.`, `/`, `-`,
`_`, and `+` (a space). For example, `/add` stores `items/add`, and `add.` stores
`add.items`. Space separators display as `₊` and remain editable in that form.

Pins outside named interfaces remain unqualified and do not display an escape
apostrophe. Pads show full message names; ordinary pad edits remain full-name
edits, while explicit prefix/suffix shorthand remains available.

## Existing models

Loading uses stored message names unchanged. The editor infers `Pin.pxlen`
using the existing interface prefix/suffix conventions. A pin with `pxlen == 0`
inside a named interface displays a leading apostrophe automatically. No new
model property or stored escape character is introduced.

The playground, VS Code webview, tutorials, and blueprints do not need message
or handler renaming to adopt this notation. Release/schema migration from
1.12.x to 1.14.0 is separate from pin-name conversion; version 1.13.x is skipped.
This source change does not itself bump the repository's release versions.

Interface renaming updates recognized prefixes/suffixes and preserves absolute
names. Moving a qualified pin between named interfaces replaces its old prefix
or suffix with the destination's dot prefix: `items.add` becomes `commands.add`.
Moving it outside all named interfaces keeps and displays its full name and
makes it absolute. A later move into an interface preserves that absolute name;
remove the displayed apostrophe while editing to adopt the new namespace.
Absolute pins always retain their names. Linked pins remain read-only: moving
them changes only presentation. Undo/redo restores both positions and names.

Moving qualified pins between interfaces is a semantic rename. Existing direct
connections and group pads follow the pin, but selective cable matching can
change and name collisions are flagged. Source message sends and handler names
must be updated separately, just as when editing a pin's name. Legacy separator
options remain available for now; changing interfaces converts a qualified pin
to the dot prefix without changing untouched legacy names.

Because qualification is inferred rather than persisted separately, a literal
name that already matches an interface prefix/suffix is recognized as qualified
on reload. This follows the existing `pxlen` mechanism; the notation does not
introduce a persistent opt-out flag.
