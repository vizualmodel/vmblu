import * as fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pckg = require('../../package.json');

async function readJsonIfExists(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return null; }
};

function sortKeys(obj) {
  return Object.fromEntries(Object.entries(obj).sort(([a],[b]) => a.localeCompare(b)));
};

export async function makePackageJson({
                                        absTarget, 
                                        projectName, 
                                        entrypointName = `${projectName}.blu`,
                                        force, 
                                        dryRun,
                                        addCliDep = true, 
                                        cliVersion = "^"+pckg.version
                                      }, ui) 
{

  // check if a pckage file exists
  const pkgPath = path.join(absTarget, 'package.json');
  const existing = await readJsonIfExists(pkgPath);

  // don't overwrite
  if (existing && !force) return pkgPath;

  // The base package with vite and typescript
  const basePackage = {
    name: projectName,
    private: true,
    version: "0.0.0",
    type: "module",
    dependencies: {
      "@vizualmodel/vmblu-runtime": "^0.4.0"
    },
    devDependencies : {
      "@vizualmodel/vmblu-cli": cliVersion,
      "typescript": "^5.9.3",
      "vite": "^7.1.12",
      // "ts-morph": "^26.0.0",
      // "svelte": "^5.0.0",
      // "@sveltejs/vite-plugin-svelte": "^6.2.1",
      // "@tsconfig/svelte": "^5.0.2"
    },
    scripts : {
      "vm:init": "vmblu init .",
      "vm:profile": `vmblu profile ${entrypointName}`,
      "vm:app": `vmblu make-app ${entrypointName}`,
      "vm:capabilities": `vmblu make-capabilities ${entrypointName}`,
      "dev": "vite",
      "build": "vite build",
      "preview": "vite preview"
    }
  };


  if (!existing) {
    ui.info(`create ${pkgPath}`);
  } else {
    ui.info(`overwrite ${pkgPath} (force)`);
  };

  if (!dryRun) {
    await fs.writeFile(pkgPath, JSON.stringify(basePackage, null, 2) + '\n', 'utf8');
  };

  return pkgPath;
}
