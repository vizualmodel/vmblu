# Release automation setup

`/.github/workflows/release.yml` validates and publishes a coordinated vmblu release after a single approval in the GitHub `release` environment.

It publishes:

- `@vizualmodel/vmblu-runtime`
- `@vizualmodel/vmblu-core`
- `@vizualmodel/vmblu-cli`
- `vizualmodel.vmblu` on the Visual Studio Marketplace

The npm packages use npm trusted publishing directly from GitHub OIDC. The Marketplace currently uses GitHub OIDC to sign in as a Microsoft Entra workload identity, followed by `vsce publish --azure-credential`. No npm token, Marketplace PAT, client secret, or recurring interactive login is stored.

Merge this workflow and guide into `main` before configuring npm: npm requires the named workflow file to exist in `.github/workflows/` on GitHub when the trusted publisher is registered.

## One-time GitHub environment

In `vizualmodel/vmblu`:

1. Open **Settings → Environments → New environment**.
2. Name it exactly `release` (lowercase).
3. Add yourself as a required reviewer and disable self-review prevention if you are the only maintainer and GitHub offers that setting.
4. Restrict deployment branches/tags to the protected release policy. At minimum, allow only `main`.
5. Do not add npm or Marketplace tokens.

The workflow also rejects any dispatch whose ref is not `main`.

## One-time npm trusted publishers

Repeat this for each package:

- `@vizualmodel/vmblu-runtime`
- `@vizualmodel/vmblu-core`
- `@vizualmodel/vmblu-cli`

In npm:

1. Open the package.
2. Open **Settings → Trusted publishing**.
3. Select **GitHub Actions**.
4. Enter these exact values (they are case-sensitive):

    | Field                | Value         |
    | -------------------- | ------------- |
    | Organization or user | `vizualmodel` |
    | Repository           | `vmblu`       |
    | Workflow filename    | `release.yml` |
    | Environment          | `release`     |
    | Allowed action       | `npm publish` |

5. Save the trusted publisher.

The workflow filename is entered without `.github/workflows/`. Each package can have only one trusted publisher.

After one successful OIDC release, optionally harden each package under **Settings → Publishing access** by selecting **Require two-factor authentication and disallow tokens**. Configure and test trusted publishing first, then revoke obsolete automation tokens.

## One-time Microsoft Entra workload identity

The stable Marketplace client does not yet provide direct GitHub trusted publishing. It does support Microsoft Entra authentication, so GitHub obtains an Entra token through workload identity federation without storing a secret.

### 1. Create the identity

In the Microsoft Entra admin center:

1. Open **Identity → Applications → App registrations → New registration**.
2. Name it `vmblu-vscode-publisher`.
3. Use the appropriate single-tenant setting for the tenant that owns the Marketplace publisher.
4. Record the **Application (client) ID** and **Directory (tenant) ID**.
5. Do not create a client secret.

### 2. Trust the GitHub release environment

On the app registration, open **Certificates & secrets → Federated credentials → Add credential**:

1. Select **GitHub Actions deploying Azure resources**.
2. Organization: `vizualmodel`.
3. Repository: `vmblu`.
4. Entity type: **Environment**.
5. Environment: `release`.
6. Keep the standard audience `api://AzureADTokenExchange`.
7. Give the credential a descriptive name such as `github-vmblu-release` and save it.

Using the environment subject binds the credential to jobs that reference the protected GitHub `release` environment.

### 3. Add the identifiers to GitHub

In **GitHub → vizualmodel/vmblu → Settings → Environments → release → Environment variables**, add:

| Variable          | Value                                           |
| ----------------- | ----------------------------------------------- |
| `AZURE_CLIENT_ID` | Application/client ID from the app registration |
| `AZURE_TENANT_ID` | Directory/tenant ID from the app registration   |

These identifiers are not passwords, but environment variables keep their scope aligned with the approval gate. No subscription ID is required; the workflow logs into the tenant with `allow-no-subscriptions`.

### 4. Authorize the identity in the Marketplace

The Entra identity must also be a member of the existing `vizualmodel` Marketplace publisher:

1. After the workflow is merged to `main` and the GitHub environment variables are set, dispatch its safe authentication-only mode:

    ```powershell
    gh workflow run release.yml --repo vizualmodel/vmblu --ref main -f version=1.10.0 -f allow_existing=false -f authentication_only=true
    ```

2. Approve the `release` environment deployment. The workflow signs in through GitHub OIDC and writes the identity's Azure DevOps/Marketplace profile ID into the run summary. Its Marketplace permission check is expected to fail before the identity is added.
3. Open the [Visual Studio Marketplace publisher management page](https://marketplace.visualstudio.com/manage/publishers/).
4. Open publisher `vizualmodel`, then its members/permissions management.
5. Add the workload identity using the profile ID from the workflow summary and assign **Contributor**.
6. Dispatch the same authentication-only command again. It must now pass. Authentication-only mode does not build or publish npm packages or the extension.

The exact Marketplace member screen can vary by tenant. Do not substitute a personal account ID for the workload identity profile ID. The release workflow runs `vsce verify-pat vizualmodel --azure-credential` before publishing npm, so an incorrectly authorized identity stops the release before any package is published.

## Running a release

The source, generated artifacts, manifests, and lockfiles must already contain the exact release version and be merged into `main`. The local release process must also copy the final playground bundle to `vmblu.dev`; the CI runner cannot commit that cross-repository handoff.

Start the workflow from the GitHub Actions page or with:

```powershell
gh workflow run release.yml --repo vizualmodel/vmblu --ref main -f version=<VERSION> -f allow_existing=false -f authentication_only=false
```

Then approve the pending deployment for the `release` environment in GitHub.

The workflow:

1. verifies it is running from `main`;
2. checks the exact coordinated version and npm repository metadata;
3. runs package, runtime, playground, UI, and extension validation/builds;
4. packs and smoke-tests npm tarballs and the VSIX;
5. uploads the immutable artifacts and SHA-256 manifest to the workflow run;
6. verifies the Entra identity has Marketplace publishing rights;
7. publishes runtime, core, and CLI to npm using OIDC;
8. verifies npm and publishes the VSIX with Entra authentication.

For a normal release, leave `allow_existing` false. It prevents accidentally re-running an already published npm version.

If a run fails after only some npm packages were published, independently verify the existing packages and artifacts. Then dispatch the same commit/version with `allow_existing=true`. Existing npm packages are skipped, missing ones are published, and `vsce --skip-duplicate` safely handles an extension version that already reached the Marketplace.

## Future Marketplace simplification

Microsoft is adding direct `vsce --oidc` trusted publishing, but it is not present in the stable `@vscode/vsce` 3.9.2 release as of August 2026. When a stable version includes it:

1. configure the Marketplace trusted policy for `vizualmodel/vmblu`, `release.yml`, and environment `release`;
2. replace the Azure login, identity verification, and `--azure-credential` steps with `vsce publish --oidc`;
3. remove the Entra environment variables and federation only after a successful test.

Do not install an unreleased `vsce` commit in the production workflow merely to get the new flag early.
