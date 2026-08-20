# Release automation

`.github/workflows/release.yml` validates and publishes a coordinated vmblu release after approval in the protected GitHub `release` environment.

It publishes:

- `@vizualmodel/vmblu-runtime`
- `@vizualmodel/vmblu-core`
- `@vizualmodel/vmblu-cli`
- `vizualmodel.vmblu` on the Visual Studio Marketplace

The npm packages use GitHub OIDC trusted publishing. The Marketplace release uses GitHub OIDC to obtain a Microsoft Entra workload credential for `vsce`. The workflow stores no npm token, Marketplace PAT, Entra client secret, or recurring interactive login.

Account-specific setup, recovery procedures, and operational history are maintained in the private administration repository. They do not belong in this public source repository.

## Inputs

| Input                 | Purpose                                                                               |
| --------------------- | ------------------------------------------------------------------------------------- |
| `version`             | Exact version already present in every release manifest and generated version surface |
| `allow_existing`      | Resume a verified partial release by skipping npm versions that already exist         |
| `authentication_only` | Verify Entra and Marketplace access without building or publishing                    |

Normal releases use `allow_existing=false` and `authentication_only=false`.

## Preconditions

- The coordinated version, compatibility ranges, context, generated files, manifests, and lockfiles are complete.
- The release commit is merged into `main`; the workflow rejects other refs.
- The GitHub `release` environment is configured and approved by an authorized reviewer.
- npm trusted publishers and the Marketplace workload identity are already configured by an administrator.
- The final playground bundle is copied separately into the `vmblu.dev` repository; this workflow cannot commit a cross-repository website handoff.

## Dispatch

From the GitHub Actions page, select **Publish vmblu release**, or run:

```powershell
gh workflow run release.yml --repo vizualmodel/vmblu --ref main -f version=<VERSION> -f allow_existing=false -f authentication_only=false
```

Approve the pending `release` environment deployment only after confirming the ref, commit, version, and workflow inputs.

## Workflow behavior

The workflow:

1. verifies `main` and the exact coordinated version;
2. installs dependencies and runs release checks, linting, tests, and builds;
3. packages and smoke-tests the npm tarballs and VSIX;
4. uploads immutable artifacts and a SHA-256 manifest to the workflow run;
5. verifies the Marketplace workload identity;
6. publishes runtime, core, and CLI to npm using OIDC;
7. verifies npm publication and publishes the VS Code extension.

The workflow uses a concurrency group so production releases do not overlap. Its repository permission is read-only; `id-token: write` allows short-lived OIDC exchange with the configured publishers.

## Safe authentication check

Administrators can verify Marketplace authentication without building or publishing:

```powershell
gh workflow run release.yml --repo vizualmodel/vmblu --ref main -f version=<VERSION_ON_MAIN> -f allow_existing=false -f authentication_only=true
```

Authentication-only mode must skip all build, package, and publication steps.

## Partial-release recovery

For a normal release, leave `allow_existing` false. If a run fails after publishing only some deliverables, independently verify the existing public packages and artifacts before rerunning the same commit/version with `allow_existing=true`. Existing npm versions are skipped, and `vsce --skip-duplicate` handles an extension version that already reached the Marketplace.

Never use `allow_existing` to conceal mismatched or unverified artifacts. Fix incorrect published contents forward with a new patch version.

## Security maintenance

- Do not add publishing tokens or client secrets to GitHub variables, secrets, workflow files, or repository files.
- Review changes to `.github/workflows/release.yml` as production-security changes.
- Keep actions, Node, npm, and `@vscode/vsce` current through reviewed updates.
- When stable direct Marketplace trusted publishing is available, simplify the Entra bridge only after testing the replacement end to end.
