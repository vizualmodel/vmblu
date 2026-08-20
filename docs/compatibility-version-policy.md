# vmblu Compatibility Version Policy

vmblu uses `xx.yy.zz` versions for the CLI, core, runtime and model schema.
The `xx.yy` pair is the compatibility family; `zz` is an independently
releasable patch level.

Components with the same compatibility family are compatible. A patch release
may fix defects and add optional capabilities, but it must not require an
incompatible change in another component from the same family.

Within a family:

- readers continue to accept artifacts written by earlier patches;
- writers emit one canonical representation;
- new serialized fields are added only where existing readers already permit
  extensions; otherwise they require a new compatibility family;
- package dependency ranges stay inside the family; and
- release fixtures exercise older patch artifacts with current readers.

Removing or changing fields, contracts, generated formats or required runtime
behaviour starts a new compatibility family. Precise patch versions remain in
diagnostics and generated-artifact provenance, but do not determine
compatibility.

The first release governed by this policy was family `0.10`. The first public
stable release family is `1.10`.
