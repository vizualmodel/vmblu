import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { initProject } from '../commands/init/init-project.js';

test('init creates schema 1.10.0 model and visualization headers', async () => {
  const parent = await mkdtemp(path.join(tmpdir(), 'vmblu-cli-init-'));
  const targetDir = path.join(parent, 'sample');

  try {
    const result = await initProject({
      targetDir,
      projectName: 'sample',
      ui: {
        info() {},
        warn() {},
        error() {}
      }
    });

    const model = JSON.parse(await readFile(result.files.model, 'utf8'));
    const visual = JSON.parse(await readFile(result.files.vizual, 'utf8'));

    assert.equal(model.header.version, '1.10.0');
    assert.equal(model.header.description, undefined);
    assert.equal(visual.header.version, '1.10.0');
    assert.match(visual.header.created, /^\d{4}-\d{2}-\d{2}T/);
    assert.match(visual.header.saved, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(visual.root.connections, undefined);
  }
  finally {
    await rm(parent, { recursive: true, force: true });
  }
});
