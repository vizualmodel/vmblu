import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateBlueprint} from '../lib/blueprint-validation.js';

function fixture(t, change = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'blueprint-test-'));
  t.after(() => fs.rmSync(root, {recursive:true,force:true}));
  const metadata = {schemaVersion:1,name:'Example',summary:'Test app',author:'Maintainer',license:'MIT',vmblu:'>=1.12.1 <1.13.0',readme:'README.md',models:['app.mod.blu'],...change};
  fs.writeFileSync(path.join(root,'blueprint.yaml'),JSON.stringify(metadata));
  fs.writeFileSync(path.join(root,'README.md'),'# Example');
  fs.writeFileSync(path.join(root,'app.mod.blu'),JSON.stringify({header:{version:'1.12.1'},root:{name:'App',kind:'group'}}));
  return root;
}
test('valid structure returns metadata without approval status', t => {
  const result = validateBlueprint(fixture(t));
  assert.equal(result.valid,true); assert.equal(result.status,undefined);
});
test('rejects missing files, traversal, invalid versions and claimed official status', t => {
  for (const change of [{media:['missing.png']},{readme:'../README.md'},{vmblu:'latest'},{vmblu:'*'},{status:'Official'},{license:'LicenseRef-Custom'},{models:[]}]) assert.equal(validateBlueprint(fixture(t,change)).valid,false,JSON.stringify(change));
});
test('rejects duplicate YAML keys and invalid model JSON', t => {
  const root=fixture(t);
  fs.appendFileSync(path.join(root,'blueprint.yaml'),'\nname: duplicate\n');
  assert.equal(validateBlueprint(root).valid,false);
  const other=fixture(t); fs.writeFileSync(path.join(other,'app.mod.blu'),'{');
  assert.equal(validateBlueprint(other).valid,false);
});
test('CLI returns JSON and failure exit status', t => {
  const root=fixture(t,{readme:'missing.md'});
  const result=spawnSync(process.execPath,[new URL('../bin/vmblu.js',import.meta.url).pathname.replace(/^\/(?:([A-Z]:))/i,'$1'),'blueprint','validate',root,'--json'],{encoding:'utf8'});
  assert.equal(result.status,1); assert.equal(JSON.parse(result.stdout).valid,false);
});
test('CLI schema matches specification when sibling registry is available', () => {
  // Typical workspace layout has vmblu and vmblu-blueprints as siblings.
  const actual=new URL('../../../../vmblu-blueprints/blueprint.schema.json',import.meta.url);
  if (fs.existsSync(actual)) assert.deepEqual(JSON.parse(fs.readFileSync(actual)),JSON.parse(fs.readFileSync(new URL('../lib/blueprint.schema.json',import.meta.url))));
});
