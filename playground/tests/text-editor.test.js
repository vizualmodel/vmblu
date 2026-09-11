import test from 'node:test'
import assert from 'node:assert/strict'

import {isTextFile, languageForFile, isMarkdownFile, renderMarkdown} from '../nodes/text-editor/text-editor.js'

test('text editor accepts source and documentation files but rejects binary assets', () => {
    assert.equal(isTextFile('src/index.js'), true)
    assert.equal(isTextFile('README'), true)
    assert.equal(isTextFile('assets/earth.png'), false)
    assert.equal(isTextFile('manual.pdf'), false)
})

test('text editor selects language support without requiring file content', () => {
    assert.notDeepEqual(languageForFile('app.ts'), [])
    assert.notDeepEqual(languageForFile('model.cap.json'), [])
    assert.deepEqual(languageForFile('LICENSE'), [])
})

test('preview is available only for Markdown files, including uppercase extensions', () => {
    assert.equal(isMarkdownFile('README.MD'), true)
    assert.equal(isMarkdownFile('guide.markdown'), true)
    assert.equal(isMarkdownFile('app.js'), false)
    assert.equal(isMarkdownFile('README'), false)
})

test('preview renders headings, emphasis, tables and fenced code', () => {
    const rendered = renderMarkdown('# Title\n\n**bold**\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n```js\nconst x = 1\n```')
    assert.match(rendered, /<h1>Title<\/h1>/)
    assert.match(rendered, /<strong>bold<\/strong>/)
    assert.match(rendered, /<table>/)
    assert.match(rendered, /<code class="language-js">const x = 1/)
})

test('preview escapes embedded HTML and rejects executable links', () => {
    const rendered = renderMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert(1))')
    assert.doesNotMatch(rendered, /<script|href="javascript:/)
    assert.match(rendered, /&lt;script&gt;/)
})
