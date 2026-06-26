import fs from 'fs';
import path from 'path';
import ts from 'typescript';

import { normalizePath, relativePath, slug, withoutExtension } from './path.js';

const MODEL_VERSION = '0.2.0';
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const EXCLUDED_DIRS = new Set(['.git', '.vmblu', 'node_modules', 'dist', 'build', 'coverage', '.next', '.svelte-kit']);

export async function analyzeProject({ projectRoot = '.', outFile = null } = {}) {
  const root = path.resolve(projectRoot);
  const packageJson = readJsonIfExists(path.join(root, 'package.json'));
  const config = readCompilerConfig(root);
  const program = ts.createProgram({
    rootNames: config.rootNames,
    options: config.options
  });
  const checker = program.getTypeChecker();
  const sourceFiles = program.getSourceFiles().filter((sourceFile) => isProjectSource(root, sourceFile.fileName));
  const sourceFileSet = new Set(sourceFiles.map((sourceFile) => path.resolve(sourceFile.fileName)));
  const moduleByFile = new Map();
  const symbolByDeclaration = new Map();
  const exportedSymbolIdsByModule = new Map();

  const evidence = emptyEvidence();
  const now = new Date().toISOString();
  const languages = new Set();

  for (const sourceFile of sourceFiles) {
    const file = makeFile(root, sourceFile);
    const module = makeModule(file);
    evidence.files.push(file);
    evidence.modules.push(module);
    languages.add(file.language);
    moduleByFile.set(path.resolve(sourceFile.fileName), module);
    exportedSymbolIdsByModule.set(module.id, []);
  }

  for (const sourceFile of sourceFiles) {
    collectSymbols({ root, sourceFile, checker, evidence, moduleByFile, symbolByDeclaration, exportedSymbolIdsByModule });
  }

  for (const module of evidence.modules) {
    module.exports = exportedSymbolIdsByModule.get(module.id) ?? [];
  }

  for (const sourceFile of sourceFiles) {
    collectImportsAndExports({ root, sourceFile, checker, program, evidence, moduleByFile, sourceFileSet });
    collectCalls({ root, sourceFile, checker, evidence, moduleByFile, symbolByDeclaration, sourceFileSet });
  }

  evidence.diagnostics.push(...collectDiagnostics(root, program, sourceFileSet));

  const model = {
    header: {
      format: 'vmblu-linear-code-model',
      version: MODEL_VERSION,
      createdAt: now,
      updatedAt: now,
      origin: 'analysis',
      schema: 'https://vmblu.dev/context/0.9.8/vmlc.schema.json',
      generator: {
        name: 'vmblu linear analyze',
        version: 'initial'
      }
    },
    project: {
      name: packageJson?.name ?? path.basename(root),
      root: '.',
      languages: [...languages].sort(),
      packages: [
        {
          id: 'app',
          path: '.',
          name: packageJson?.name ?? path.basename(root)
        }
      ],
      sourceRoots: inferRoots(evidence.files, 'source'),
      testRoots: inferRoots(evidence.files, 'test'),
      entryPoints: []
    },
    analysis: {
      adapter: {
        name: 'typescript',
        version: ts.version
      },
      configuration: {
        configFile: config.configFile ? normalizePath(path.relative(root, config.configFile)) : null,
        allowJs: Boolean(config.options.allowJs),
        checkJs: Boolean(config.options.checkJs)
      },
      scannedAt: now,
      includedPaths: evidence.files.map((file) => file.path),
      excludedPaths: [...EXCLUDED_DIRS],
      diagnostics: evidence.diagnostics
    },
    evidence,
    architecture: {
      components: [],
      interfaces: [],
      operations: [],
      dependencies: [],
      layers: [],
      resources: [],
      policies: [],
      exceptions: [],
      decisions: []
    },
    verification: {
      rules: [],
      results: [],
      lastRun: null
    },
    migration: {
      targets: [],
      candidates: [],
      plans: [],
      generatedArtifacts: []
    },
    editor: {}
  };

  const outputPath = path.resolve(root, outFile ?? '.vmlc.json');
  fs.writeFileSync(outputPath, `${JSON.stringify(model, null, 2)}\n`, 'utf8');

  return {
    outFile: outputPath,
    model,
    counts: {
      files: evidence.files.length,
      modules: evidence.modules.length,
      symbols: evidence.symbols.length,
      imports: evidence.imports.length,
      exports: evidence.exports.length,
      calls: evidence.calls.length,
      diagnostics: evidence.diagnostics.length
    }
  };
}

function emptyEvidence() {
  return {
    files: [],
    modules: [],
    symbols: [],
    imports: [],
    exports: [],
    calls: [],
    types: [],
    inherits: [],
    implements: [],
    routes: [],
    events: [],
    databaseAccess: [],
    externalIntegrations: [],
    environmentAccess: [],
    tests: [],
    diagnostics: []
  };
}

function readCompilerConfig(root) {
  const configFile = ts.findConfigFile(root, ts.sys.fileExists, 'tsconfig.json')
    ?? ts.findConfigFile(root, ts.sys.fileExists, 'jsconfig.json');

  if (configFile) {
    const configRead = ts.readConfigFile(configFile, ts.sys.readFile);
    if (configRead.error) {
      throw new Error(ts.flattenDiagnosticMessageText(configRead.error.messageText, '\n'));
    }
    const parsed = ts.parseJsonConfigFileContent(configRead.config, ts.sys, path.dirname(configFile), {
      allowJs: true,
      checkJs: false,
      noEmit: true,
      skipLibCheck: true
    }, configFile);
    return {
      configFile,
      rootNames: parsed.fileNames.filter((fileName) => isSupportedSource(fileName)),
      options: {
        ...parsed.options,
        allowJs: true,
        noEmit: true,
        skipLibCheck: true
      }
    };
  }

  return {
    configFile: null,
    rootNames: discoverSourceFiles(root),
    options: {
      allowJs: true,
      checkJs: false,
      noEmit: true,
      skipLibCheck: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      jsx: ts.JsxEmit.ReactJSX
    }
  };
}

function discoverSourceFiles(root) {
  const files = [];
  walk(root, files);
  return files;
}

function walk(dir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!EXCLUDED_DIRS.has(entry.name)) {
        walk(path.join(dir, entry.name), files);
      }
      continue;
    }

    const fullPath = path.join(dir, entry.name);
    if (isSupportedSource(fullPath) && !fullPath.endsWith('.d.ts')) {
      files.push(fullPath);
    }
  }
}

function isSupportedSource(filePath) {
  return SOURCE_EXTENSIONS.has(path.extname(filePath));
}

function isProjectSource(root, fileName) {
  const absolute = path.resolve(fileName);
  if (!absolute.startsWith(root) || absolute.includes(`${path.sep}node_modules${path.sep}`)) {
    return false;
  }
  if (fileName.endsWith('.d.ts')) {
    return false;
  }
  return isSupportedSource(fileName);
}

function makeFile(root, sourceFile) {
  const filePath = relativePath(root, sourceFile.fileName);
  return {
    id: `file:${filePath}`,
    path: filePath,
    language: languageForFile(filePath),
    kind: isTestFile(filePath) ? 'test' : 'source',
    package: 'app'
  };
}

function makeModule(file) {
  const modulePath = withoutExtension(file.path);
  return {
    id: `module:${modulePath}`,
    path: file.path,
    file: file.id,
    kind: 'unknown',
    exports: []
  };
}

function languageForFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.ts' || ext === '.tsx') return 'typescript';
  if (ext === '.jsx') return 'jsx';
  if (ext === '.tsx') return 'tsx';
  return 'javascript';
}

function collectSymbols(context) {
  const { root, sourceFile, checker, evidence, moduleByFile, symbolByDeclaration, exportedSymbolIdsByModule } = context;
  const module = moduleByFile.get(path.resolve(sourceFile.fileName));

  visit(sourceFile);

  function visit(node) {
    if (isSymbolDeclaration(node)) {
      const symbol = makeSymbol(root, sourceFile, checker, module, node);
      if (symbol) {
        evidence.symbols.push(symbol);
        symbolByDeclaration.set(node, symbol.id);
        const nameNode = getDeclarationNameNode(node);
        if (nameNode) {
          const tsSymbol = checker.getSymbolAtLocation(nameNode);
          if (tsSymbol?.valueDeclaration) {
            symbolByDeclaration.set(tsSymbol.valueDeclaration, symbol.id);
          }
        }
        if (isExported(node)) {
          exportedSymbolIdsByModule.get(module.id)?.push(symbol.id);
          module.kind = module.kind === 'commonjs' ? 'mixed' : 'esm';
          evidence.exports.push({
            id: `export:${slug(module.id)}:${node.getStart(sourceFile)}`,
            module: module.id,
            kind: 'declaration',
            specifier: null,
            symbols: [
              {
                local: symbol.name,
                exported: symbol.name,
                symbol: symbol.id
              }
            ],
            source: symbol.source,
            resolution: 'exact'
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
}

function isSymbolDeclaration(node) {
  return ts.isFunctionDeclaration(node)
    || ts.isClassDeclaration(node)
    || ts.isInterfaceDeclaration(node)
    || ts.isTypeAliasDeclaration(node)
    || ts.isEnumDeclaration(node)
    || ts.isMethodDeclaration(node)
    || ts.isConstructorDeclaration(node)
    || ts.isPropertyDeclaration(node)
    || (ts.isVariableDeclaration(node) && isRelevantVariableDeclaration(node));
}

function isRelevantVariableDeclaration(node) {
  if (node.parent?.parent && ts.isSourceFile(node.parent.parent)) return true;
  if (hasExportedVariableStatement(node)) return true;
  return Boolean(node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)));
}

function makeSymbol(root, sourceFile, checker, module, node) {
  const name = getDeclarationName(node);
  if (!name) return null;

  const qualifiedName = getQualifiedName(node, name);
  const id = `symbol:${withoutExtension(relativePath(root, sourceFile.fileName))}#${qualifiedName}`;
  return {
    id,
    name,
    qualifiedName,
    kind: symbolKind(node),
    visibility: visibilityOf(node),
    module: module.id,
    signature: signatureOf(node, checker),
    source: sourceRange(root, sourceFile, node),
    resolution: 'exact'
  };
}

function getDeclarationName(node) {
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  const nameNode = getDeclarationNameNode(node);
  if (!nameNode) return null;
  return nameNode.getText();
}

function getDeclarationNameNode(node) {
  return node.name && (ts.isIdentifier(node.name) || ts.isStringLiteral(node.name) || ts.isPrivateIdentifier(node.name))
    ? node.name
    : null;
}

function getQualifiedName(node, name) {
  const owner = nearestParent(node, ts.isClassDeclaration);
  if (owner?.name && node !== owner) {
    return `${owner.name.getText()}.${name}`;
  }
  return name;
}

function symbolKind(node) {
  if (ts.isFunctionDeclaration(node)) return 'function';
  if (ts.isClassDeclaration(node)) return 'class';
  if (ts.isInterfaceDeclaration(node)) return 'interface';
  if (ts.isTypeAliasDeclaration(node)) return 'type';
  if (ts.isEnumDeclaration(node)) return 'enum';
  if (ts.isMethodDeclaration(node)) return 'method';
  if (ts.isConstructorDeclaration(node)) return 'constructor';
  if (ts.isPropertyDeclaration(node)) return 'property';
  if (ts.isVariableDeclaration(node)) return 'variable';
  return 'unknown';
}

function visibilityOf(node) {
  const flags = ts.getCombinedModifierFlags(node);
  if (flags & ts.ModifierFlags.Private) return 'private';
  if (flags & ts.ModifierFlags.Protected) return 'protected';
  return 'public';
}

function signatureOf(node, checker) {
  if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node)) {
    return functionSignature(node, checker);
  }
  if (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) {
    return {
      parameters: [],
      returns: typeText(node, checker)
    };
  }
  return null;
}

function functionSignature(node, checker) {
  const parameters = node.parameters?.map((parameter) => ({
    name: parameter.name.getText(),
    type: parameter.type ? parameter.type.getText() : typeText(parameter, checker)
  })) ?? [];
  const signature = checker.getSignatureFromDeclaration(node);
  return {
    parameters,
    returns: node.type ? node.type.getText() : signature ? checker.typeToString(checker.getReturnTypeOfSignature(signature)) : 'unknown'
  };
}

function typeText(node, checker) {
  try {
    return checker.typeToString(checker.getTypeAtLocation(node));
  } catch {
    return 'unknown';
  }
}

function isExported(node) {
  const flags = ts.getCombinedModifierFlags(node);
  if (flags & ts.ModifierFlags.Export) return true;
  return node.parent && ts.isSourceFile(node.parent) && ts.isVariableDeclaration(node) && hasExportedVariableStatement(node);
}

function hasExportedVariableStatement(node) {
  const statement = nearestParent(node, ts.isVariableStatement);
  return statement ? Boolean(ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export) : false;
}

function collectImportsAndExports(context) {
  const { root, sourceFile, checker, program, evidence, moduleByFile, sourceFileSet } = context;
  const module = moduleByFile.get(path.resolve(sourceFile.fileName));
  if (!module) return;

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const specifier = statement.moduleSpecifier.text;
      const resolved = resolveModule(root, sourceFile, specifier, program, sourceFileSet);
      evidence.imports.push({
        id: `import:${slug(module.id)}:${statement.getStart(sourceFile)}`,
        fromModule: module.id,
        toModule: resolved.toModule,
        specifier,
        kind: 'static',
        symbols: importedSymbols(statement),
        source: sourceRange(root, sourceFile, statement),
        resolution: resolved.resolution
      });
      module.kind = 'esm';
      continue;
    }

    if (ts.isExportDeclaration(statement)) {
      evidence.exports.push({
        id: `export:${slug(module.id)}:${statement.getStart(sourceFile)}`,
        module: module.id,
        kind: statement.moduleSpecifier ? 're-export' : 'named',
        specifier: ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : null,
        symbols: exportSymbols(statement),
        source: sourceRange(root, sourceFile, statement),
        resolution: 'static'
      });
      module.kind = 'esm';
    }

    if (ts.isExportAssignment(statement)) {
      evidence.exports.push({
        id: `export:${slug(module.id)}:${statement.getStart(sourceFile)}`,
        module: module.id,
        kind: statement.isExportEquals ? 'export-equals' : 'default',
        specifier: null,
        symbols: [{ exported: 'default', local: statement.expression.getText() }],
        source: sourceRange(root, sourceFile, statement),
        resolution: 'static'
      });
      module.kind = 'esm';
    }
  }

  collectRequireCalls(root, sourceFile, evidence, module, program, sourceFileSet);
}

function importedSymbols(statement) {
  const clause = statement.importClause;
  if (!clause) return [];
  const symbols = [];
  if (clause.name) {
    symbols.push({ local: clause.name.text, imported: 'default' });
  }
  if (clause.namedBindings) {
    if (ts.isNamespaceImport(clause.namedBindings)) {
      symbols.push({ local: clause.namedBindings.name.text, imported: '*' });
    } else {
      for (const element of clause.namedBindings.elements) {
        symbols.push({
          local: element.name.text,
          imported: element.propertyName ? element.propertyName.text : element.name.text
        });
      }
    }
  }
  return symbols;
}

function exportSymbols(statement) {
  const clause = statement.exportClause;
  if (!clause || !ts.isNamedExports(clause)) return [];
  return clause.elements.map((element) => ({
    local: element.propertyName ? element.propertyName.text : element.name.text,
    exported: element.name.text
  }));
}

function collectRequireCalls(root, sourceFile, evidence, module, program, sourceFileSet) {
  visit(sourceFile);

  function visit(node) {
    if (ts.isCallExpression(node)
      && node.expression.getText(sourceFile) === 'require'
      && node.arguments.length === 1
      && ts.isStringLiteral(node.arguments[0])) {
      const specifier = node.arguments[0].text;
      const resolved = resolveModule(root, sourceFile, specifier, program, sourceFileSet);
      evidence.imports.push({
        id: `import:${slug(module.id)}:${node.getStart(sourceFile)}`,
        fromModule: module.id,
        toModule: resolved.toModule,
        specifier,
        kind: 'commonjs',
        symbols: [],
        source: sourceRange(root, sourceFile, node),
        resolution: resolved.resolution
      });
      module.kind = module.kind === 'esm' ? 'mixed' : 'commonjs';
    }
    ts.forEachChild(node, visit);
  }
}

function resolveModule(root, sourceFile, specifier, program, sourceFileSet) {
  const resolved = ts.resolveModuleName(specifier, sourceFile.fileName, program.getCompilerOptions(), ts.sys).resolvedModule;
  if (resolved?.resolvedFileName) {
    const resolvedFile = path.resolve(resolved.resolvedFileName);
    if (sourceFileSet.has(resolvedFile)) {
      return {
        toModule: `module:${withoutExtension(relativePath(root, resolvedFile))}`,
        resolution: 'exact'
      };
    }
  }
  return {
    toModule: `external:${specifier}`,
    resolution: specifier.startsWith('.') ? 'unknown' : 'static'
  };
}

function collectCalls(context) {
  const { root, sourceFile, checker, evidence, moduleByFile, symbolByDeclaration, sourceFileSet } = context;
  const module = moduleByFile.get(path.resolve(sourceFile.fileName));
  if (!module) return;

  visit(sourceFile);

  function visit(node) {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const target = resolveCallTarget(node, checker, root, symbolByDeclaration, sourceFileSet);
      const source = sourceRange(root, sourceFile, node);
      evidence.calls.push({
        id: `call:${slug(module.id)}:${source.range.start.line}:${source.range.start.column}:${slug(target.toName ?? 'unknown')}`,
        fromSymbol: enclosingSymbolId(node, symbolByDeclaration),
        fromModule: module.id,
        toSymbol: target.toSymbol,
        toName: target.toName,
        toModule: target.toModule,
        kind: ts.isNewExpression(node) ? 'constructor-call' : callKind(node),
        async: isAwaited(node),
        source,
        resolution: target.resolution,
        confidence: target.resolution === 'exact' ? 1 : 0.4
      });
    }
    ts.forEachChild(node, visit);
  }
}

function resolveCallTarget(node, checker, root, symbolByDeclaration, sourceFileSet) {
  const expression = ts.isCallExpression(node) ? node.expression : node.expression;
  const toName = expression ? expression.getText() : 'unknown';
  const signature = ts.isCallExpression(node) ? checker.getResolvedSignature(node) : null;
  const declaration = signature?.declaration ?? checker.getSymbolAtLocation(expression)?.valueDeclaration;

  if (declaration) {
    const symbolId = symbolByDeclaration.get(declaration);
    const sourceFile = declaration.getSourceFile();
    const resolvedFile = path.resolve(sourceFile.fileName);
    if (symbolId) {
      return {
        toSymbol: symbolId,
        toName,
        toModule: `module:${withoutExtension(relativePath(root, resolvedFile))}`,
        resolution: 'exact'
      };
    }
    if (sourceFileSet.has(resolvedFile)) {
      return {
        toSymbol: null,
        toName,
        toModule: `module:${withoutExtension(relativePath(root, resolvedFile))}`,
        resolution: 'static'
      };
    }
  }

  return {
    toSymbol: null,
    toName,
    toModule: null,
    resolution: 'unknown'
  };
}

function enclosingSymbolId(node, symbolByDeclaration) {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current)
      || ts.isMethodDeclaration(current)
      || ts.isConstructorDeclaration(current)
      || ts.isClassDeclaration(current)) {
      const id = symbolByDeclaration.get(current);
      if (id) return id;
    }
    if (ts.isArrowFunction(current) || ts.isFunctionExpression(current)) {
      const variable = nearestParent(current, ts.isVariableDeclaration);
      const id = variable ? symbolByDeclaration.get(variable) : null;
      if (id) return id;
    }
    current = current.parent;
  }
  return null;
}

function callKind(node) {
  if (ts.isPropertyAccessExpression(node.expression)) return 'method-call';
  if (ts.isElementAccessExpression(node.expression)) return 'element-call';
  return 'function-call';
}

function isAwaited(node) {
  let current = node.parent;
  while (current) {
    if (ts.isAwaitExpression(current)) return true;
    if (ts.isStatement(current) || ts.isFunctionLike(current)) return false;
    current = current.parent;
  }
  return false;
}

function collectDiagnostics(root, program, sourceFileSet) {
  return ts.getPreEmitDiagnostics(program)
    .filter((diagnostic) => !diagnostic.file || sourceFileSet.has(path.resolve(diagnostic.file.fileName)))
    .map((diagnostic, index) => {
      const base = {
        id: `diagnostic:${diagnostic.code}:${index}`,
        code: diagnostic.code,
        category: ts.DiagnosticCategory[diagnostic.category].toLowerCase(),
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
      };
      if (!diagnostic.file || diagnostic.start == null) return base;
      return {
        ...base,
        source: pointRange(root, diagnostic.file, diagnostic.start, diagnostic.length ?? 0)
      };
    });
}

function sourceRange(root, sourceFile, node) {
  return pointRange(root, sourceFile, node.getStart(sourceFile), node.getWidth(sourceFile));
}

function pointRange(root, sourceFile, start, width) {
  const startPosition = sourceFile.getLineAndCharacterOfPosition(start);
  const endPosition = sourceFile.getLineAndCharacterOfPosition(start + width);
  return {
    file: relativePath(root, sourceFile.fileName),
    range: {
      start: {
        line: startPosition.line + 1,
        column: startPosition.character + 1
      },
      end: {
        line: endPosition.line + 1,
        column: endPosition.character + 1
      }
    }
  };
}

function nearestParent(node, predicate) {
  let current = node.parent;
  while (current) {
    if (predicate(current)) return current;
    current = current.parent;
  }
  return null;
}

function isTestFile(filePath) {
  return /(^|\/)(__tests__|tests?|spec)\//i.test(filePath)
    || /\.(test|spec)\.[cm]?[jt]sx?$/i.test(filePath);
}

function inferRoots(files, kind) {
  const roots = new Set();
  for (const file of files) {
    if (kind === 'test' && file.kind !== 'test') continue;
    if (kind === 'source' && file.kind !== 'source') continue;
    const first = file.path.split('/')[0];
    if (first) roots.add(first);
  }
  return [...roots].sort();
}

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}
