// extractHandlersFromFile.js

import ts from 'typescript';

export let currentNode = null;
export let topLevelClass = null
let nodeMap = null
let filePath = null

export function findHandlers(sourceFile, _filePath, _nodeMap) {
  
    // Reset any node context carried over from previous files.
    currentNode = null;

    // The fallback name is the top-level class
    topLevelClass = sourceFile.getClasses()[0]?.getName?.() || null;
    nodeMap = _nodeMap
    filePath = _filePath

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
        const jsdoc = getFullJsDoc(decl);
        updateNodeFromJsdoc(jsdoc);

        // check if the name is a handler and initialised with a function
        if (isHandler(name) && init && init.getKindName().includes('Function')) {

            const docTags = getParamDocs(decl);
            const params = init.getParameters().flatMap(p => describeParam(p, docTags));

            collect(name, params, line, jsdoc);
        }

        if (init && init.getKind() === ts.SyntaxKind.ObjectLiteralExpression) {
            collectObjectLiteralHandlers(init);
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
        if (!stmt.isKind(ts.SyntaxKind.ExpressionStatement)) return;
        const expr = stmt.getExpression();
        if (!expr.isKind(ts.SyntaxKind.BinaryExpression)) return;

        // get the two parts of the statement
        const left = expr.getLeft().getText();
        const right = expr.getRight();

        // check for protype
        if (left.includes('.prototype.') && right.isKind(ts.SyntaxKind.FunctionExpression)) {

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

        if (left.endsWith('.prototype') && right.isKind(ts.SyntaxKind.ObjectLiteralExpression)) {
            collectObjectLiteralHandlers(right);
        }
    });
}


function collectHandlersFromFunctionReturns(fn) {

    // Look for factory-style returns that expose handlers via object literals.
    fn.getDescendantsOfKind(ts.SyntaxKind.ReturnStatement).forEach(ret => {
        const expr = ret.getExpression();
        if (!expr || expr.getKind() !== ts.SyntaxKind.ObjectLiteralExpression) return;

        collectObjectLiteralHandlers(expr);
    });
}

function collectObjectLiteralHandlers(objectLiteral) {

    // Reuse the same extraction logic for any handler stored on an object literal shape.
    objectLiteral.getProperties().forEach(prop => {

        const propName = prop.getName?.();
        if (!isHandler(propName)) return;

        let params = [];
        if (prop.getKind() === ts.SyntaxKind.MethodDeclaration) {
            const docTags = getParamDocs(prop);
            params = prop.getParameters().flatMap(p => describeParam(p, docTags));
        } else if (prop.getKind() === ts.SyntaxKind.PropertyAssignment) {
            const fn = prop.getInitializerIfKind(ts.SyntaxKind.FunctionExpression) || prop.getInitializerIfKind(ts.SyntaxKind.ArrowFunction);
            if (fn) {
                const docTags = getParamDocs(fn);
                params = fn.getParameters().flatMap(p => describeParam(p, docTags));
            }
        }

        const jsdoc = getFullJsDoc(prop);
        const line = prop.getStartLineNumber();

        collect(propName, params, line, jsdoc);
    });
}

function updateNodeFromJsdoc(jsdoc = {}) {

    const nodeTag = jsdoc.tags?.find(t => t.tagName === 'node')?.comment;
    if (nodeTag) currentNode = nodeTag.trim();
}

function collect(rawName, params, line, jsdoc = {}) {

    //if (!isHandler(rawName)) return;
    const cleanHandler = rawName.replace(/^['"]|['"]$/g, '');

    let pin = null;
    let node = null;

    const pinTag = jsdoc.tags?.find(t => t.tagName === 'pin')?.comment;
    const nodeTag = jsdoc.tags?.find(t => t.tagName === 'node')?.comment;
    const mcpTag = jsdoc.tags?.find(t => t.tagName === 'mcp')?.comment ?? null;

    // if there is a node tag, change the name of the current node
    if (nodeTag) currentNode = nodeTag.trim();

    // check the pin tag to get a pin name and node name
    if (pinTag) {

        if (pinTag.includes('@')) {
            const [p, n] = pinTag.split('@').map(s => s.trim());
            pin = p;
            node = n;
        }
        else pin = pinTag.trim();

        // Use the current context when the pin tag does not specify a node.
        if (!node) node = currentNode || topLevelClass || null;
    }

    // check the pin tag to get a pin name and node name
    // if (pinTag && pinTag.includes('@')) {
    //     const [p, n] = pinTag.split('@').map(s => s.trim());
    //     pin = p;
    //     node = n;
    // } 
    else {

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
    if (!node) return

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
  };

// determines if a name is the name for a handler
function isHandler(name) {
    // must be a string
    if (typeof name !== 'string') return false;

    // get rid of " and '
    const clean = name.replace(/^['"]|['"]$/g, '');

    // check that it starts with the right symbols...
    return clean.startsWith('on') || clean.startsWith('->');
}

// Get the parameter description from the function or method
function getParamDocs(fnOrMethod) {

    // extract
    const docs = fnOrMethod.getJsDocs?.() ?? [];
    const tags = docs.flatMap(d => d.getTags());
    const paramDocs = {};

    // check the tags
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

// make a parameter description
function describeParam(p, docTags = {}) {

    const nameNode = p.getNameNode();

// const func = p.getParent();
// const funcName = func.getName?.() || '<anonymous>';
// console.log(funcName)

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
                    const text = resolvedType.getText();
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
    const tsType = p.getType().getText();

    // const isTSFallback = tsType === 'any' || tsType === 'string';
    // if (isTSFallback && !doc.type) {
    //   console.warn(`⚠️ No type info for param "${name}" in function "${funcName}"`);
    // }

    return {
        name,
        type: doc.type || tsType || 'string',
        description: doc.description || '',
    };
}

