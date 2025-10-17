const fs = require('fs/promises');
const path = require('path');

async function readJsonIfExists(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; }
}

function sortKeys(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a],[b]) => a.localeCompare(b)));
}

async function makePackageJson({
  absTarget, projectName, force, dryRun,
  addCliDep = true, cliVersion = "^0.1.0"
}, ui) {
  const pkgPath = path.join(absTarget, 'package.json');
  const existing = await readJsonIfExists(pkgPath);

  // Base skeleton (created if missing)
  const basePkg = existing || {
    name: projectName,
    private: true,
    version: "0.0.0",
  };

  // Add/merge scripts (idempotent)
  basePkg.scripts = Object.assign({}, basePkg.scripts, {
    "vm:init": "vmblu init ."
  });

  // Optionally add the CLI as a devDependency
  if (addCliDep) {
    basePkg.devDependencies = Object.assign({}, basePkg.devDependencies, {
      "@vizualmodel/vmblu-cli": basePkg.devDependencies?.["@vizualmodel/vmblu-cli"] || cliVersion
    });
  }

  // Nice-to-have: keep deterministic key order
  const ordered = {
    ...sortKeys(basePkg),
    scripts: sortKeys(basePkg.scripts || {}),
    devDependencies: basePkg.devDependencies ? sortKeys(basePkg.devDependencies) : undefined
  };

  if (existing && !force) {
    ui.info(`update package.json (merge scripts${addCliDep ? " + devDependency" : ""})`);
  } else if (!existing) {
    ui.info(`create ${pkgPath}`);
  } else {
    ui.info(`overwrite ${pkgPath} (force)`);
  }

  if (!dryRun) {
    await fs.writeFile(pkgPath, JSON.stringify(ordered, null, 2) + '\n', 'utf8');
  }

  return pkgPath;
}
module.exports = { makePackageJson };