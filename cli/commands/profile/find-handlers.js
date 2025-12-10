// extractHandlersFromFile.js

import { SyntaxKind } from 'ts-morph';

const DEBUG = process.env.VMBLU_PROFILE_DEBUG === '1';
const debug = (...args) => {
    if (DEBUG) console.log('[profile-debug]', ...args);
};

export let currentNode = null;
export let topLevelClass = null;
let nodeMap = null;
let filePath = null;
export let nodeAliases = new Map();

let knownIdentifiers = new Set();

export function findHandlers(sourceFile, _filePath, _nodeMap) {

    // Reset any node context carried over from previous files.
    currentNode = null;

    // The fallback name is the top-level class
    topLevelClass = sourceFile.getClasses()[0]?.getName?.() || null;
    nodeMap = _nodeMap;
    filePath = _filePath;
    nodeAliases = new Map();
    knownIdentifiers = collectKnownIdentifiers(sourceFile);

    // Check all the functions in the sourcefile - typically generator functions
    sourceFile.getFunctions().forEach(fn => {

        // Capture node annotations on generator-style functions and harvest handlers returned from them.
        const jsdoc = getFullJsDoc(fn);
        updateNodeFromJsdoc(jsdoc);

        const name = fn.getName();

        if (isHandler(name)) {

            const line = fn.getNameNode()?.getStartLineNumber() ?? fn.getStartLineNumber();
            const docTags = getParamDocs(fn);
            const params = fn.getParameters().flatMap(p => describeParam(p, docTags));

            collect(name, params, line, jsdoc);
        }

        collectHandlersFromFunctionReturns(fn);
    });

    // Check the variable declarations in the sourcefile
    sourceFile.getVariableDeclarations().forEach(decl => {

        // check the name
        const name = decl.getName();
        const init = decl.getInitializer();
        const line = decl.getStartLineNumber();
        const declJsdoc = getFullJsDoc(decl);
        const statement = decl.getFirstAncestorByKind?.(SyntaxKind.VariableStatement);
        const statementJsdoc = statement ? getFullJsDoc(statement) : null;
        const jsdoc = hasDocMetadata(declJsdoc) ? declJsdoc : statementJsdoc ?? declJsdoc;
        updateNodeFromJsdoc(jsdoc);

        // check if the name is a handler and initialised with a function
        if (isHandler(name) && init && init.getKindName().includes('Function')) {

            const docTags = getParamDocs(decl);
            const params = init.getParameters().flatMap(p => describeParam(p, docTags));

            collect(name, params, line, jsdoc);
        }

        const objectLiteral = resolveObjectLiteralExpression(init);
        if (objectLiteral) {
            collectObjectLiteralHandlers(objectLiteral);
        }
    });

    // check all the classes in the file
    sourceFile.getClasses().forEach(cls => {

        // get the name of the node
        const nodeName = cls.getName?.() || topLevelClass;

        // check all the methods
        cls.getMethods().forEach(method => {

            // check the name
            const name = method.getName();
            if (!isHandler(name)) return;

            // extract
            const line = method.getNameNode()?.getStartLineNumber() ?? method.getStartLineNumber();
            const jsdoc = getFullJsDoc(method);
            const docTags = getParamDocs(method);
            const params = method.getParameters().flatMap(p => describeParam(p, docTags));

            // and collect
            collect(name, params, line, jsdoc, nodeName);
        });
    });

    // check all the statements
    sourceFile.getStatements().forEach(stmt => {

        // only binary expressions
        if (!stmt.isKind(SyntaxKind.ExpressionStatement)) return;
        const expr = stmt.getExpression();
        if (!expr.isKind(SyntaxKind.BinaryExpression)) return;

        // get the two parts of the statement
        const left = expr.getLeft().getText();
        const right = expr.getRight();

        // check for protype
        if (left.includes('.prototype.') && right.isKind(SyntaxKind.FunctionExpression)) {

            // get the name and check
            const parts = left.split('.');
            const name = parts[parts.length - 1];
            if (!isHandler(name)) return;

            // extract
            const line = expr.getStartLineNumber();
            const params = right.getParameters().flatMap(p => describeParam(p));
            const jsdoc = getFullJsDoc(expr);

            // and save in nodemap
            collect(name, params, line, jsdoc);
        }

        const objectLiteral = resolveObjectLiteralExpression(right);
        if (left.endsWith('.prototype') && objectLiteral) {
            collectObjectLiteralHandlers(objectLiteral);
        }
    });
}


function collectHandlersFromFunctionReturns(fn) {

    // Look for factory-style returns that expose handlers via object literals.
    fn.getDescendantsOfKind(SyntaxKind.ReturnStatement).forEach(ret => {
        const expr = ret.getExpression();
        const objectLiteral = resolveObjectLiteralExpression(expr);
        if (!objectLiteral) return;

        collectObjectLiteralHandlers(objectLiteral);
    });
}

function resolveObjectLiteralExpression(expression) {
    if (!expression || typeof expression.getKind !== 'function') return null;

    const hasObjectLiteralShape = typeof expression.getProperties === 'function'
        && (expression.getKindName?.() === 'ObjectLiteralExpression' || expression.getText?.().trim().startsWith('{'));
    if (hasObjectLiteralShape) {
        return expression;
    }

    if (expression.isKind?.(SyntaxKind.ParenthesizedExpression)) {
        return resolveObjectLiteralExpression(expression.getExpression());
    }

    if (expression.isKind?.(SyntaxKind.AsExpression)
        || expression.isKind?.(SyntaxKind.TypeAssertionExpression)
        || expression.isKind?.(SyntaxKind.SatisfiesExpression)
        || expression.isKind?.(SyntaxKind.NonNullExpression)
    ) {
        return resolveObjectLiteralExpression(expression.getExpression?.());
    }

    return null;
}

function collectObjectLiteralHandlers(objectLiteral) {

    // Reuse the same extraction logic for any handler stored on an object literal shape.
    if (!objectLiteral || typeof objectLiteral.getProperties !== 'function') return;

    objectLiteral.getProperties().forEach(prop => {

        const propName = prop.getName?.();
        if (!isHandler(propName)) return;

        let jsdoc = getFullJsDoc(prop);
        let line = prop.getStartLineNumber();
        let params = [];
        if (prop.getKind() === SyntaxKind.MethodDeclaration) {
            const docTags = getParamDocs(prop);
            params = prop.getParameters().flatMap(p => describeParam(p, docTags));
        } else if (prop.getKind() === SyntaxKind.PropertyAssignment) {
            const fn = prop.getInitializerIfKind(SyntaxKind.FunctionExpression) || prop.getInitializerIfKind(SyntaxKind.ArrowFunction);
            if (fn) {
                const docTags = getParamDocs(fn);
                params = fn.getParameters().flatMap(p => describeParam(p, docTags));
            }
        } else if (prop.getKind() === SyntaxKind.ShorthandPropertyAssignment) {
            const resolved = resolveShorthandHandler(prop);
            if (resolved) {
                params = resolved.params;
                jsdoc = hasDocMetadata(jsdoc) ? jsdoc : resolved.jsdoc ?? jsdoc;
                line = resolved.line ?? line;
            } else {
                debug('shorthand handler unresolved', {
                    prop: prop.getName?.(),
                    file: filePath,
                    line
                });
            }
        }

        collect(propName, params, line, jsdoc);
    });
}

function updateNodeFromJsdoc(jsdoc = {}) {

    const nodeTag = jsdoc.tags?.find(t => t.tagName === 'node')?.comment;
    if (nodeTag) {
        applyNodeTag(nodeTag);
    }
}

function collect(rawName, params, line, jsdoc = {}, defaultNode = null) {

    const cleanHandler = rawName.replace(/^['"]|['"]$/g, '');

    let pin = null;
    let node = defaultNode || null;

    const pinTag = jsdoc.tags?.find(t => t.tagName === 'pin')?.comment;
    const nodeTag = jsdoc.tags?.find(t => t.tagName === 'node')?.comment;
    const mcpTag = jsdoc.tags?.find(t => t.tagName === 'mcp')?.comment ?? null;

    if (nodeTag) {
        const context = applyNodeTag(nodeTag);
        if (context?.nodeName) {
            node = context.nodeName;
        }
    }

    if (pinTag) {

        if (pinTag.includes('@')) {
            const [p, n] = pinTag.split('@').map(s => s.trim());
            pin = p;
            node = n;
        }
        else pin = pinTag.trim();
    }
    else if (!node) {

        // no explicit tag - try these...
        node = currentNode || topLevelClass || null;

        // deduct the pin name from the handler name
        if (cleanHandler.startsWith('on')) {
            pin = cleanHandler.slice(2).replace(/([A-Z])/g, ' $1').trim().toLowerCase();
        } else if (cleanHandler.startsWith('->')) {
            pin = cleanHandler.slice(2).trim();
        }
    }

    // if there is no node we just don't save the data
    if (!node) return;

    // check if we have an entry for the node
    if (!nodeMap.has(node)) nodeMap.set(node, { handles: [], transmits: [] });

    // The handler data to save
    const handlerData = {
        pin,
        handler: cleanHandler,
        file: filePath,
        line,
        summary: jsdoc.summary || '',
        returns: jsdoc.returns || '',
        examples: jsdoc.examples || [],
        params
    };

    // extract the data from an mcp tag if present
    if (mcpTag !== null) {
        handlerData.mcp = true;
        if (mcpTag.includes('name:') || mcpTag.includes('description:')) {
            const nameMatch = /name:\s*\"?([^\"]+)\"?/.exec(mcpTag);
            const descMatch = /description:\s*\"?([^\"]+)\"?/.exec(mcpTag);
            if (nameMatch) handlerData.mcpName = nameMatch[1];
            if (descMatch) handlerData.mcpDescription = descMatch[1];
        }
    }

    // and put it in the nodemap
    nodeMap.get(node).handles.push(handlerData);
}

// determines if a name is the name for a handler
function isHandler(name) {
    if (typeof name !== 'string') return false;

    const clean = name.replace(/^['"]|['"]$/g, '');
    return clean.startsWith('on') || clean.startsWith('->');
}

// Get the parameter description from the function or method
function getParamDocs(fnOrMethod) {

    const docs = fnOrMethod.getJsDocs?.() ?? [];
    const tags = docs.flatMap(d => d.getTags());
    const paramDocs = {};

    for (const tag of tags) {
        if (tag.getTagName() === 'param') {
            const name = tag.getNameNode()?.getText?.() || tag.getName();
            const desc = tag.getComment() ?? '';
            const type = tag.getTypeNode?.()?.getText?.() || tag.getTypeExpression()?.getTypeNode()?.getText();
            paramDocs[name] = { description: desc, type };
        }
    }
    return paramDocs;
}

// Get the jsdoc 
function getFullJsDoc(node) {

    const docs = node.getJsDocs?.() ?? [];
    const summary = docs.map(d => d.getComment()).filter(Boolean).join('\n');
    const tags = docs.flatMap(d => d.getTags()).map(t => ({
        tagName: t.getTagName(),
        comment: t.getComment() || ''
    }));

    const returns = tags.find(t => t.tagName === 'returns')?.comment || '';
    const examples = tags.filter(t => t.tagName === 'example').map(t => t.comment);

    return { summary, returns, examples, tags };
}

function hasDocMetadata(jsdoc) {
    if (!jsdoc) return false;
    if (jsdoc.summary && jsdoc.summary.trim()) return true;
    return Array.isArray(jsdoc.tags) && jsdoc.tags.length > 0;
}

// make a parameter description
function describeParam(p, docTags = {}) {

    const nameNode = p.getNameNode();

    if (nameNode.getKindName() === 'ObjectBindingPattern') {

        const objType = p.getType();
        const properties = objType.getProperties();
        const isTSFallback = objType.getText() === 'any' || objType.getText() === 'string' || properties.length === 0;

        return nameNode.getElements().map(el => {

            const subName = el.getName();
            const doc = docTags[subName] ?? {};
            let tsType = null;

            if (!isTSFallback) {
                const symbol = objType.getProperty(subName);
                if (symbol) {
                    const resolvedType = symbol.getTypeAtLocation(el);
                    const text = resolvedType.getText(p.getSourceFile?.());
                    if (text && text !== 'any') {
                        tsType = text;
                    }
                }
            }

            const type = tsType || doc.type || 'string';
            const description = doc.description || '';
            return { name: subName, type, description };
        });
    }

    const name = p.getName();
    const doc = docTags[name] ?? {};
    const tsType = p.getType().getText(p.getSourceFile?.());

    return {
        name,
        type: doc.type || tsType || 'string',
        description: doc.description || '',
    };
}

function resolveShorthandHandler(prop) {
    const name = prop.getName?.();
    const nameNode = prop.getNameNode?.();
    const symbol = prop.getShorthandAssignmentValueSymbol?.() || prop.getSymbol?.() || nameNode?.getSymbol?.();
    const declarations = symbol?.getDeclarations?.() || [];

    const decl = declarations.find(d =>
        d.isKind?.(SyntaxKind.FunctionDeclaration) ||
        d.isKind?.(SyntaxKind.VariableDeclaration)
    ) || findDeclarationByName(prop, name);

    if (!decl) {
        const fallback = findDeclarationInScope(prop, name);
        if (!fallback) {
            debug('shorthand unresolved after search', {
                name,
                hasSymbol: !!symbol,
                declCount: declarations.length,
                file: filePath,
                line: prop.getStartLineNumber()
            });
            return null;
        }
        return fallback;
    }

    if (decl.isKind?.(SyntaxKind.FunctionDeclaration)) {
        const docTags = getParamDocs(decl);
        const params = decl.getParameters().flatMap(p => describeParam(p, docTags));
        const jsdoc = getFullJsDoc(decl);
        const line = decl.getNameNode?.()?.getStartLineNumber?.() ?? decl.getStartLineNumber?.();
        debug('shorthand -> function decl', { name, line });
        return { params, jsdoc, line };
    }

    if (decl.isKind?.(SyntaxKind.VariableDeclaration)) {
        const init = decl.getInitializer?.();
        const fn = init && (init.isKind?.(SyntaxKind.FunctionExpression) || init.isKind?.(SyntaxKind.ArrowFunction)) ? init : null;
        if (!fn) return null;

        const docTags = { ...getParamDocs(decl), ...getParamDocs(fn) };
        const params = fn.getParameters().flatMap(p => describeParam(p, docTags));
        const declDocs = getFullJsDoc(decl);
        const fnDocs = getFullJsDoc(fn);
        const jsdoc = hasDocMetadata(declDocs) ? declDocs : fnDocs;
        const line = decl.getNameNode?.()?.getStartLineNumber?.() ?? fn.getStartLineNumber?.();
        debug('shorthand -> variable decl', { name, line });
        return { params, jsdoc, line };
    }

    debug('shorthand decl had unexpected kind; falling back', {
        name,
        kind: decl.getKindName?.(),
        file: filePath,
        line: prop.getStartLineNumber()
    });
    const fallback = findDeclarationInScope(prop, name);
    if (fallback) return fallback;

    return null;
}

function findDeclarationByName(prop, name) {
    if (!name) return null;
    const sourceFile = prop.getSourceFile?.();
    if (!sourceFile) return null;

    const targetPos = prop.getStart?.() ?? 0;
    let best = null;

    const consider = (decl) => {
        if (!decl || decl.getName?.() !== name) return;
        const pos = decl.getStart?.();
        if (typeof pos !== 'number' || pos > targetPos) return;
        if (!best || pos > (best.getStart?.() ?? -Infinity)) {
            best = decl;
        }
    };

    sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration).forEach(consider);
    sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration).forEach(consider);

    return best;
}

function findDeclarationInScope(prop, name) {
    if (!name) return null;
    const sourceFile = prop.getSourceFile?.();
    if (!sourceFile) return null;

    const targetPos = prop.getStart?.() ?? 0;
    const scopes = [];

    const fnScope = prop.getFirstAncestor(n =>
        n.getKind && (
            n.isKind?.(SyntaxKind.FunctionDeclaration) ||
            n.isKind?.(SyntaxKind.FunctionExpression) ||
            n.isKind?.(SyntaxKind.ArrowFunction)
        )
    );
    if (fnScope) scopes.push(fnScope);
    scopes.push(sourceFile);

    for (const scope of scopes) {
        let best = null;
        const consider = (decl) => {
            if (!decl || decl.getName?.() !== name) return;
            const pos = decl.getStart?.();
            if (typeof pos !== 'number' || pos > targetPos) return;
            if (!best || pos > (best.getStart?.() ?? -Infinity)) {
                best = decl;
            }
        };

        scope.getDescendantsOfKind?.(SyntaxKind.FunctionDeclaration)?.forEach(consider);
        scope.getDescendantsOfKind?.(SyntaxKind.VariableDeclaration)?.forEach(consider);

        if (best) {
            if (best.isKind?.(SyntaxKind.FunctionDeclaration)) {
                const docTags = getParamDocs(best);
                const params = best.getParameters().flatMap(p => describeParam(p, docTags));
                const jsdoc = getFullJsDoc(best);
                const line = best.getNameNode?.()?.getStartLineNumber?.() ?? best.getStartLineNumber?.();
                debug('shorthand -> function decl (fallback)', { name, line });
                return { params, jsdoc, line };
            }

            const init = best.getInitializer?.();
            const fn = init && (init.isKind?.(SyntaxKind.FunctionExpression) || init.isKind?.(SyntaxKind.ArrowFunction)) ? init : null;
            if (fn) {
                const docTags = { ...getParamDocs(best), ...getParamDocs(fn) };
                const params = fn.getParameters().flatMap(p => describeParam(p, docTags));
                const declDocs = getFullJsDoc(best);
                const fnDocs = getFullJsDoc(fn);
                const jsdoc = hasDocMetadata(declDocs) ? declDocs : fnDocs;
                const line = best.getNameNode?.()?.getStartLineNumber?.() ?? fn.getStartLineNumber?.();
                debug('shorthand -> variable decl (fallback)', { name, line });
                return { params, jsdoc, line };
            }
        }
    }

    return null;
}

function applyNodeTag(rawTag) {
    const { nodeName, aliases } = parseNodeTag(rawTag);
    if (!nodeName) return null;
    registerNodeContext(nodeName, aliases);
    return { nodeName, aliases };
}

function registerNodeContext(nodeName, aliases = []) {
    const normalizedNode = nodeName.trim();
    if (!normalizedNode) return;
    currentNode = normalizedNode;

    aliases.forEach(alias => registerAlias(alias, normalizedNode));

    const derivedAlias = deriveIdentifierFromNodeName(normalizedNode);
    if (derivedAlias) registerAlias(derivedAlias, normalizedNode);
}

function registerAlias(alias, nodeName) {
    const cleaned = alias?.trim();
    if (!cleaned) return;
    if (!isValidIdentifier(cleaned)) return;
    if (!nodeAliases.has(cleaned)) {
        nodeAliases.set(cleaned, nodeName);
    }
}

function parseNodeTag(rawTag) {
    if (!rawTag || typeof rawTag !== 'string') return { nodeName: null, aliases: [] };

    let text = rawTag.trim();
    if (!text) return { nodeName: null, aliases: [] };

    let nodeName = text;
    let aliasChunk = '';

    const explicitMatch = text.match(/^(.*?)(?:\s+(?:@|as|=>|->|\||:)\s+)(.+)$/i);
    if (explicitMatch) {
        nodeName = explicitMatch[1].trim();
        aliasChunk = explicitMatch[2].trim();
    } else {
        const quotedMatch = text.match(/^["']([^"']+)["']\s+(.+)$/);
        if (quotedMatch) {
            nodeName = quotedMatch[1].trim();
            aliasChunk = quotedMatch[2].trim();
        }
    }

    if (!aliasChunk) {
        const parts = text.split(/\s+/);
        if (parts.length > 1) {
            const candidateAlias = parts[parts.length - 1];
            const candidateNode = parts.slice(0, -1).join(' ');
            if (isValidIdentifier(candidateAlias) && isKnownIdentifier(candidateAlias)) {
                aliasChunk = candidateAlias;
                nodeName = candidateNode.trim();
            }
        }
    }

    const aliases = aliasChunk
        ? aliasChunk.split(/[,\s]+/).map(a => a.trim()).filter(Boolean)
        : [];

    return { nodeName, aliases };
}

function deriveIdentifierFromNodeName(name) {
    const chunks = name.split(/[\s\-]+/).filter(Boolean);
    if (chunks.length === 0) return null;
    if (chunks.length === 1) {
        const single = chunks[0];
        return isValidIdentifier(single) ? single : null;
    }
    const [first, ...rest] = chunks;
    const camel = first.toLowerCase() + rest.map(capitalize).join('');
    return isValidIdentifier(camel) ? camel : null;
}

function capitalize(word) {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1);
}

function isValidIdentifier(value) {
    return /^[A-Za-z_$][\w$]*$/.test(value);
}

function isKnownIdentifier(name) {
    return knownIdentifiers.has(name);
}

function collectKnownIdentifiers(sourceFile) {
    const identifiers = new Set();

    sourceFile.getVariableDeclarations().forEach(decl => {
        const name = decl.getName();
        if (typeof name === 'string' && isValidIdentifier(name)) {
            identifiers.add(name);
        }
    });

    sourceFile.getFunctions().forEach(fn => {
        const name = fn.getName?.();
        if (name && isValidIdentifier(name)) identifiers.add(name);
    });

    sourceFile.getClasses().forEach(cls => {
        const name = cls.getName?.();
        if (name && isValidIdentifier(name)) identifiers.add(name);
    });

    if (typeof sourceFile.getInterfaces === 'function') {
        sourceFile.getInterfaces().forEach(iface => {
            const name = iface.getName?.();
            if (name && isValidIdentifier(name)) identifiers.add(name);
        });
    }

    if (typeof sourceFile.getTypeAliases === 'function') {
        sourceFile.getTypeAliases().forEach(alias => {
            const name = alias.getName?.();
            if (name && isValidIdentifier(name)) identifiers.add(name);
        });
    }

    if (typeof sourceFile.getEnums === 'function') {
        sourceFile.getEnums().forEach(enm => {
            const name = enm.getName?.();
            if (name && isValidIdentifier(name)) identifiers.add(name);
        });
    }

    sourceFile.getImportDeclarations().forEach(decl => {
        const defaultImport = decl.getDefaultImport();
        if (defaultImport) {
            const name = defaultImport.getText();
            if (isValidIdentifier(name)) identifiers.add(name);
        }

        const namespaceImport = decl.getNamespaceImport();
        if (namespaceImport) {
            const nsName = typeof namespaceImport.getText === 'function'
                ? namespaceImport.getText()
                : namespaceImport.getName?.();
            if (nsName && isValidIdentifier(nsName)) identifiers.add(nsName);
        }

        decl.getNamedImports().forEach(spec => {
            const alias = spec.getAliasNode()?.getText();
            if (alias && isValidIdentifier(alias)) {
                identifiers.add(alias);
            } else {
                const name = spec.getName();
                if (isValidIdentifier(name)) identifiers.add(name);
            }
        });
    });

    return identifiers;
}
