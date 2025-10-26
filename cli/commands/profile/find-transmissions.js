import { SyntaxKind } from 'ts-morph';
import { currentNode, topLevelClass, nodeAliases } from './find-handlers.js';

/**
 * Finds tx.send or this.tx.send calls and maps them to their node context.
 * 
 * @param {import('ts-morph').SourceFile} sourceFile - The source file being analyzed
 * @param {string} filePath - The (relative) path of the source file
 * @param {Map} nodeMap - Map from node name to metadata
 * @param {string|null} currentNode - Explicitly set node name (takes priority)
 */
export function findTransmissions(sourceFile, filePath, nodeMap) {

    // Create a quick lookup from handler name + file to node name to attribute transmissions precisely.
    const handlerToNode = new Map();
    for (const [nodeName, meta] of nodeMap.entries()) {
        for (const handle of meta.handles) {
            if (!handle?.handler) continue;
            const key = createHandlerKey(handle.file ?? filePath, handle.handler);
            if (!handlerToNode.has(key)) handlerToNode.set(key, nodeName);
        }
    }

    // Search all call expressions
    sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression).forEach(node => {
        const expr = node.getExpression();

        // check
        if (expr.getKind() !== SyntaxKind.PropertyAccessExpression) return

        // Match tx.send or this.tx.send - regular expression could be : expr.getText().match(/\w+\.tx\.send/)
        const text = expr.getText()

        // check
        if (! (text === 'tx.send' || text === 'this.tx.send' || text.endsWith('.tx.send'))) return;

        const args = node.getArguments();
        if (args.length === 0 || !args[0].isKind(SyntaxKind.StringLiteral)) return;

        const pin = args[0].getLiteralText();

        // Try to infer the class context of the tx.send call
        const method = node.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);
        const classDecl = method?.getFirstAncestorByKind(SyntaxKind.ClassDeclaration) ?? node.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
        const className = classDecl?.getName?.();
        const handlerName = getEnclosingHandlerName(node);
        const handlerKey = handlerName ? createHandlerKey(filePath, handlerName) : null;
        const aliasCandidate = getAliasCandidate(expr);
        const aliasNode = aliasCandidate ? nodeAliases.get(aliasCandidate) ?? null : null;

        // Priority order: handler lookup > alias mapping > current context > class fallback
        const nodeName = (handlerKey ? handlerToNode.get(handlerKey) : null)
            || aliasNode
            || currentNode
            || className
            || topLevelClass
            || null;

        // check
        if (!nodeName) return

        // check if there is an entry for the node or create it 
        nodeMap.has(nodeName) || nodeMap.set(nodeName, { handles: [], transmits: [] });

        // add the entry to the transmits array
        nodeMap.get(nodeName).transmits.push({
            pin,
            file: filePath,
            line: node.getStartLineNumber()
        });
    });
}

function getAliasCandidate(propertyAccess) {
    if (!propertyAccess || !propertyAccess.getExpression) return null;
    const target = propertyAccess.getExpression();
    const root = resolveRootIdentifier(target);
    if (!root) return null;
    if (root === 'tx' || root === 'this') return null;
    return root;
}

function resolveRootIdentifier(expression) {
    if (!expression) return null;
    if (expression.isKind?.(SyntaxKind.Identifier)) {
        return expression.getText();
    }
    if (expression.isKind?.(SyntaxKind.ThisKeyword)) {
        return 'this';
    }
    if (expression.isKind?.(SyntaxKind.PropertyAccessExpression)) {
        return resolveRootIdentifier(expression.getExpression());
    }
    if (expression.isKind?.(SyntaxKind.ElementAccessExpression)) {
        return resolveRootIdentifier(expression.getExpression());
    }
    return null;
}

function createHandlerKey(file, handler) {
    return `${file}::${handler}`;
}

function getEnclosingHandlerName(callExpression) {
    const method = callExpression.getFirstAncestorByKind(SyntaxKind.MethodDeclaration);
    if (method?.getName?.()) return method.getName();

    const funcDecl = callExpression.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration);
    if (funcDecl?.getName?.()) return funcDecl.getName();

    const funcExpr = callExpression.getFirstAncestorByKind(SyntaxKind.FunctionExpression);
    if (funcExpr) {
        if (funcExpr.getName?.()) return funcExpr.getName();
        const prop = funcExpr.getFirstAncestorByKind(SyntaxKind.PropertyAssignment);
        if (prop?.getName?.()) return prop.getName();
        const variable = funcExpr.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
        if (variable) return variable.getName();
    }

    const arrowFunc = callExpression.getFirstAncestorByKind(SyntaxKind.ArrowFunction);
    if (arrowFunc) {
        const prop = arrowFunc.getFirstAncestorByKind(SyntaxKind.PropertyAssignment);
        if (prop?.getName?.()) return prop.getName();
        const variable = arrowFunc.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
        if (variable) return variable.getName();
    }

    const propAssignment = callExpression.getFirstAncestorByKind(SyntaxKind.PropertyAssignment);
    if (propAssignment?.getName?.()) return propAssignment.getName();

    const varDecl = callExpression.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
    if (varDecl?.getName?.()) return varDecl.getName();

    return null;
}
