import { SyntaxKind } from 'ts-morph';
import {currentNode, topLevelClass} from './find-handlers.js'

/**
 * Finds tx.send or this.tx.send calls and maps them to their node context.
 * 
 * @param {import('ts-morph').SourceFile} sourceFile - The source file being analyzed
 * @param {string} filePath - The (relative) path of the source file
 * @param {Map} nodeMap - Map from node name to metadata
 * @param {string|null} currentNode - Explicitly set node name (takes priority)
 */
export function findTransmissions(sourceFile, filePath, nodeMap) {

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

        // Priority order: currentNode > className > topLevelClass > 'global'
        const nodeName = currentNode || className || topLevelClass || null;

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

