import fs from 'fs';
import path from 'path';

export async function profileModel({ query, target = null, modelFile = null } = {}) {
  if (!query) {
    throw new Error('Usage: vmblu linear profile <callers|imports|dependencies> [target] [--model <file>]');
  }

  const resolvedModelFile = path.resolve(modelFile ?? '.vmlc.json');
  const model = JSON.parse(fs.readFileSync(resolvedModelFile, 'utf8'));

  if (query === 'callers') {
    return profileCallers(model, target);
  }
  if (query === 'imports') {
    return profileImports(model, target);
  }
  if (query === 'dependencies') {
    return profileDependencies(model, target);
  }

  throw new Error(`Unknown profile query: ${query}`);
}

function profileCallers(model, target) {
  if (!target) {
    throw new Error('Usage: vmblu linear profile callers <symbol-or-name> [--model <file>]');
  }

  const calls = evidence(model).calls
    .filter((call) => matchesTarget(call.toSymbol, target)
      || matchesTarget(call.toName, target)
      || matchesTarget(call.toModule, target))
    .map((call) => ({
      call: call.id,
      fromSymbol: call.fromSymbol,
      fromModule: call.fromModule,
      toSymbol: call.toSymbol,
      toName: call.toName,
      toModule: call.toModule,
      kind: call.kind,
      async: call.async,
      source: call.source,
      resolution: call.resolution,
      confidence: call.confidence
    }));

  return {
    query: 'callers',
    target,
    count: calls.length,
    calls
  };
}

function profileImports(model, target) {
  const imports = evidence(model).imports
    .filter((item) => !target
      || matchesTarget(item.fromModule, target)
      || matchesTarget(item.toModule, target)
      || matchesTarget(item.specifier, target)
      || matchesTarget(item.source?.file, target))
    .map((item) => ({
      import: item.id,
      fromModule: item.fromModule,
      toModule: item.toModule,
      specifier: item.specifier,
      kind: item.kind,
      symbols: item.symbols,
      source: item.source,
      resolution: item.resolution
    }));

  return {
    query: 'imports',
    target,
    count: imports.length,
    imports
  };
}

function profileDependencies(model, target) {
  const moduleNames = new Map(evidence(model).modules.map((module) => [module.id, module.path]));
  const dependencies = new Map();

  for (const item of evidence(model).imports) {
    if (target && !matchesTarget(item.fromModule, target) && !matchesTarget(item.source?.file, target)) {
      continue;
    }
    addDependency(dependencies, item.fromModule, item.toModule, 'import', item.id);
  }

  for (const call of evidence(model).calls) {
    if (!call.toModule || call.toModule === call.fromModule) continue;
    if (target && !matchesTarget(call.fromModule, target) && !matchesTarget(call.source?.file, target)) {
      continue;
    }
    addDependency(dependencies, call.fromModule, call.toModule, 'call', call.id);
  }

  const rows = [...dependencies.values()]
    .sort((a, b) => `${a.fromModule}:${a.toModule}`.localeCompare(`${b.fromModule}:${b.toModule}`))
    .map((dependency) => ({
      ...dependency,
      fromPath: moduleNames.get(dependency.fromModule) ?? null,
      toPath: moduleNames.get(dependency.toModule) ?? null
    }));

  return {
    query: 'dependencies',
    target,
    count: rows.length,
    dependencies: rows
  };
}

function addDependency(dependencies, fromModule, toModule, kind, evidenceId) {
  const key = `${fromModule}->${toModule}`;
  const current = dependencies.get(key) ?? {
    fromModule,
    toModule,
    kinds: [],
    evidence: []
  };
  if (!current.kinds.includes(kind)) {
    current.kinds.push(kind);
  }
  current.evidence.push(evidenceId);
  dependencies.set(key, current);
}

function evidence(model) {
  return model.evidence ?? {
    modules: [],
    imports: [],
    calls: []
  };
}

function matchesTarget(value, target) {
  if (!value || !target) return false;
  const normalizedValue = String(value).toLowerCase();
  const normalizedTarget = String(target).toLowerCase();
  return normalizedValue === normalizedTarget
    || normalizedValue.endsWith(normalizedTarget)
    || normalizedValue.includes(normalizedTarget);
}
