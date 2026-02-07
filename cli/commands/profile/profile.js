#!/usr/bin/env node

// Native
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ts from 'typescript';

// ts-morph
import { Project } from 'ts-morph';

// vmblu
import { ModelBlueprint, ModelCompiler } from '../../../core/model/index.js';
import { ARL } from '../../../core/arl/arl-node.js'
import { normalizeSeparators } from '../../../core/arl/path.js';

// profile tool
import {findHandlers} from './find-handlers.js'
import {findTransmissions} from './find-transmissions.js'

// allign with package version
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pckg = require('../../package.json');
const PROFILE_VERSION = pckg.version;

// The main function for the profile tool
export async function profile(argv = process.argv.slice(2)) {

    const cli = parseCliArgs(argv);

    if (!cli.modelFile) {
        console.error('Usage: vmblu profile <model-file> [--out <file>] [--full] [--changed <files...>] [--deleted <files...>] [--delta-file <path>] [--reason <text>]');
        process.exit(1);
    }

    const absoluteModelPath = path.resolve(cli.modelFile);
    const modelPath = normalizeSeparators(absoluteModelPath);

    if (!fs.existsSync(absoluteModelPath) || !fs.statSync(absoluteModelPath).isFile()) {
        console.error(cli.modelFile, 'is not a file');
        process.exit(1);
    }

    const outPath = cli.outFile
        ? path.resolve(cli.outFile)
        : (() => {
            const { dir, name, ext } = path.parse(absoluteModelPath);
            const baseName = ext === '.blu' && name.endsWith('.mod')
                ? name.slice(0, -'.mod'.length)
                : name;
            return path.join(dir, `${baseName}.src.prf`);
        })();

    if (cli.deltaFile) cli.deltaFile = path.resolve(cli.deltaFile);
    if (cli.reason) console.log('[profile] reason:', cli.reason);

    if (!cli.full && (cli.changed.length || cli.deleted.length || cli.deltaFile)) {
        console.log('[profile] incremental updates not yet supported; performing full rescan.');
    }

    // Make an Application Resource Locator    // Make an Application Resource Locator
    const arl = new ARL(modelPath);

    // Create model object
    const model = new ModelBlueprint(arl);

    // create a model compile object - we do not need a uid generator
    const compiler = new ModelCompiler(null);

    // get all the factories that are refernced in the model and submodels
    await compiler.getFactoriesAndModels(model);

    // extract the factories
    const factories = compiler.factories.map.values();

    // setup the ts-morph project with the factory files
    const project = setupProject(factories)

    // Extract the source files
    const sourceFiles = project.getSourceFiles()

    // get all the handlers and transmissions of all the source files into the rxtx array
    const rxtx = []
    const generatedAt = new Date().toISOString()
    for (const sourceFile of sourceFiles) {

        // display file scanned..
        // console.log(sourceFile.getFilePath())

        // A file reference is always relative to the model file
        const filePath = normalizeSeparators(path.relative(path.dirname(modelPath), sourceFile.getFilePath()));

        // the node map to collect the data for the file
        const nodeMap = new Map();

        // find the handlers in the file
        findHandlers(sourceFile, filePath, nodeMap)

        // find the transmissions in the file
        findTransmissions(sourceFile, filePath, nodeMap)

        // map the nodemap to an array 
        const nodeArray = Array.from(nodeMap.entries()).map(([node, { handles, transmits }]) => ({node,handles,transmits}))

        // add these to the overall rxtx array
        rxtx.push(...nodeArray)
    }

    // Assemble the output file path
    // (outPath was resolved earlier based on CLI arguments)

    // and write the output to that file
    const output = {
        version: PROFILE_VERSION,
        generatedAt,
        entries: rxtx
    };

    // Persist the structured documentation with its header so downstream tools can validate against the schema.
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`Documentation written to ${outPath}`);
}

function normalizePathValue(value) {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
        if (typeof value.fsPath === 'string') return value.fsPath;
        if (typeof value.path === 'string') return value.path;
        if (typeof value.url === 'string') return value.url;
    }
    return null;
}

function toStringArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) {
        return value.map(normalizePathValue).filter(Boolean);
    }
    const normalized = normalizePathValue(value);
    return normalized ? [normalized] : [];
}

function normalizeArgv(argv) {
    if (Array.isArray(argv)) return argv;
    if (!argv || typeof argv !== 'object') return [];

    const args = [];
    const modelFile = normalizePathValue(argv.modelFile ?? argv['model-file'] ?? argv.model ?? argv._?.[0]);
    if (modelFile) args.push(modelFile);

    const outFile = normalizePathValue(argv.outFile ?? argv.out ?? argv.o);
    if (outFile) args.push('--out', outFile);

    if (argv.full) args.push('--full');

    if (argv.reason != null) args.push('--reason', String(argv.reason));

    const deltaFile = normalizePathValue(argv.deltaFile ?? argv['delta-file']);
    if (deltaFile) args.push('--delta-file', deltaFile);

    const changed = toStringArray(argv.changed);
    if (changed.length) args.push('--changed', ...changed);

    const deleted = toStringArray(argv.deleted);
    if (deleted.length) args.push('--deleted', ...deleted);

    return args;
}

function normalizeToken(token) {
    if (typeof token === 'string') return token;
    if (typeof token === 'number') return String(token);
    return normalizePathValue(token);
}

function parseCliArgs(argvInput) {

    const argv = normalizeArgv(argvInput);

    const result = {
        modelFile: null,
        outFile: null,
        full: false,
        reason: null,
        changed: [],
        deleted: [],
        deltaFile: null,
    };

    let i = 0;
    while (i < argv.length) {
        const token = normalizeToken(argv[i]);
        if (!token) {
            i += 1;
            continue;
        }

        if (token === '--out') {
            const next = normalizeToken(argv[i + 1]);
            if (next && !next.startsWith('--')) {
                result.outFile = next;
                i += 2;
            } else {
                console.warn('Warning: --out requires a path argument; ignoring.');
                i += 1;
            }
            continue;
        }

        if (token === '--full') {
            result.full = true;
            i += 1;
            continue;
        }

        if (token === '--reason') {
            const next = normalizeToken(argv[i + 1]);
            if (next && !next.startsWith('--')) {
                result.reason = next;
                i += 2;
            } else {
                result.reason = '';
                i += 1;
            }
            continue;
        }

        if (token === '--delta-file') {
            const next = normalizeToken(argv[i + 1]);
            if (next && !next.startsWith('--')) {
                result.deltaFile = next;
                i += 2;
            } else {
                console.warn('Warning: --delta-file requires a path argument; ignoring.');
                i += 1;
            }
            continue;
        }

        if (token === '--changed') {
            const values = [];
            i += 1;
            while (i < argv.length) {
                const value = normalizeToken(argv[i]);
                if (!value || value.startsWith('--')) break;
                values.push(value);
                i += 1;
            }
            if (values.length === 0) {
                console.warn('Warning: --changed provided without any paths.');
            } else {
                result.changed.push(...values);
            }
            continue;
        }

        if (token === '--deleted') {
            const values = [];
            i += 1;
            while (i < argv.length) {
                const value = normalizeToken(argv[i]);
                if (!value || value.startsWith('--')) break;
                values.push(value);
                i += 1;
            }
            if (values.length === 0) {
                console.warn('Warning: --deleted provided without any paths.');
            } else {
                result.deleted.push(...values);
            }
            continue;
        }

        if (token.startsWith('--')) {
            console.warn('Warning: unknown option "' + token + '" ignored.');
            i += 1;
            continue;
        }

        if (!result.modelFile) {
            result.modelFile = token;
        } else {
            console.warn('Warning: extra positional argument "' + token + '" ignored.');
        }

        i += 1;
    }

    return result;
}



// Gets all the source files that are part of this project
function setupProject(factories) {

    // show the version that we use
    console.log('version: ',PROFILE_VERSION)

    // Initialize ts-morph without tsconfig
    const project = new Project({
        compilerOptions: {
            allowJs: true,
            checkJs: true,
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ESNext,
            moduleResolution: ts.ModuleResolutionKind.NodeJs,
            esModuleInterop: true,
            noEmit: true,
        },
        skipAddingFilesFromTsConfig: true,
    });

    // Add factory entry files
    for (const factory of factories) {

        // get the file path
        const filePath = factory.arl.url;

        // user feedback
        console.log('Adding factory entry:', filePath);

        // add to the project
        try {
            project.addSourceFileAtPath(factory.arl.url);
        } catch (err) {
            //console.warn(`Could not load ${filePath}: ${err.message}`);
            console.warn(err.message);
        }
    }

    // Resolve all imports recursively
    project.resolveSourceFileDependencies();

    // done
    return project
}


const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  profile().catch(err => {
    console.error('Failed to generate source documentation:', err);
    process.exit(1);
  });
}
