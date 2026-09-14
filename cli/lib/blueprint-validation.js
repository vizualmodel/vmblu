import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import Ajv from 'ajv';
import semver from 'semver';

const schema = JSON.parse(fs.readFileSync(new URL('./blueprint.schema.json', import.meta.url), 'utf8'));
const validate = new Ajv({allErrors: true}).compile(schema);

export function repositoryFile(root, relative) {
  if (typeof relative !== 'string' || !relative.trim() || relative.includes('\\') || relative.includes(':') || relative.startsWith('/') || relative.split('/').some(p => !p || p === '..' || p === '.')) throw new Error(`Invalid repository-relative path: ${relative}`);
  const base = fs.realpathSync(root);
  const target = fs.realpathSync(path.join(base, relative));
  const inside = path.relative(base, target);
  if (inside.startsWith('..') || path.isAbsolute(inside) || !fs.statSync(target).isFile()) throw new Error(`File must stay inside repository: ${relative}`);
  return target;
}

export function validateBlueprint(directory = process.cwd()) {
  const errors = [];
  const check = (label, fn) => { try { return fn(); } catch (error) { errors.push(`${label}: ${error.message}`); } };
  const metadata = check('blueprint.yaml', () => {
    const file = repositoryFile(directory, 'blueprint.yaml');
    if (fs.statSync(file).size > 65536) throw new Error('metadata exceeds 64 KiB');
    return yaml.load(fs.readFileSync(file, 'utf8'), {schema: yaml.JSON_SCHEMA});
  });
  if (!validate(metadata)) errors.push(...validate.errors.map(e => `${e.instancePath || '/'} ${e.message}`));
  if (errors.length) return {valid: false, errors};
  for (const field of ['name','summary','author','license']) if (!metadata[field].trim()) errors.push(`${field}: cannot be blank`);
  if (!semver.validRange(metadata.vmblu) || semver.validRange(metadata.vmblu) === '*') errors.push('vmblu: expected a non-wildcard semver range');
  if (metadata.license.startsWith('LicenseRef-') && !metadata.licenseFile) errors.push('licenseFile: required for LicenseRef licenses');
  check('readme', () => {
    const file = repositoryFile(directory, metadata.readme);
    if (!/\.md$/i.test(file) || !fs.readFileSync(file, 'utf8').trim()) throw new Error('expected nonempty Markdown file');
  });
  for (const relative of [...(metadata.media ?? []), ...(metadata.licenseFile ? [metadata.licenseFile] : [])]) check(relative, () => repositoryFile(directory, relative));
  for (const relative of metadata.models) check(relative, () => {
    const file = repositoryFile(directory, relative);
    if (!file.endsWith('.mod.blu')) throw new Error('expected canonical .mod.blu model');
    const model = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!model?.header || !semver.valid(model.header.version)) throw new Error('model header.version must be a semantic version');
    if (!model.root || typeof model.root !== 'object' || Array.isArray(model.root)) throw new Error('model root must be an object');
    if (!semver.satisfies(model.header.version, metadata.vmblu)) throw new Error('model version is outside declared vmblu range');
  });
  return {valid: errors.length === 0, errors, metadata};
}
