import fs from 'node:fs/promises'
import path from 'node:path'
import {createRequire} from 'node:module'
import {fileURLToPath, pathToFileURL} from 'node:url'

import {routedTargetManifest, sourceTargetManifest} from './model-test-artifact.js'
import {compatibilityFamily} from './version-policy.js'

const ownRequire = createRequire(import.meta.url)

export async function runBrowserModelTest(context, artifact, {headless=true, channel=process.env.VMBLU_TEST_BROWSER_CHANNEL, testPath='<browser>'}={}) {
    const harness = await makeHarness(context)
    let server
    let browser
    let browserContext
    const browserErrors = []

    try {
        const vite = await import(pathToFileURL(resolveModule('vite', context.projectRoot)).href)
        server = await vite.createServer({
            root: context.projectRoot,
            appType: 'mpa',
            logLevel: 'error',
            server: {host: '127.0.0.1', port: 0, strictPort: false},
        })
        await server.listen()

        const playwright = await import('playwright')
        browser = await launchBrowser(playwright.chromium, {headless, channel})
        browserContext = await browser.newContext()
        const page = await browserContext.newPage()
        page.on('pageerror', error => browserErrors.push(error?.message ?? String(error)))
        page.on('console', message => {
            if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) browserErrors.push(message.text())
        })
        page.on('response', response => {
            if (response.status() >= 400 && !response.url().endsWith('/favicon.ico')) {
                browserErrors.push(`HTTP ${response.status()} for ${response.url()}`)
            }
        })

        const address = server.httpServer.address()
        const urlPath = path.relative(context.projectRoot, harness.htmlFile).replaceAll('\\', '/')
        const response = await page.goto(`http://127.0.0.1:${address.port}/${urlPath}`)
        if (!response?.ok()) throw new Error(`Browser harness returned HTTP ${response?.status() ?? 'unknown'}`)
        try {
            await page.waitForFunction(() => globalThis.__vmbluModelTest?.ready === true, null, {timeout: 5000})
        }
        catch (error) {
            throw new Error(`Browser harness did not become ready: ${browserErrors.join('; ') || error.message}`)
        }
        const report = await page.evaluate(testArtifact => globalThis.__vmbluModelTest.run(testArtifact), artifact)
        report.test = testPath
        applyBrowserErrors(report, browserErrors)
        return report
    }
    finally {
        await browserContext?.close?.()
        await browser?.close?.()
        await server?.close?.()
        await removeHarness(harness)
    }
}

async function makeHarness(context) {
    const cacheRoot = path.resolve(context.projectRoot, '.vmblu', 'cache', 'model-test')
    const id = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const directory = path.resolve(cacheRoot, id)
    if (path.dirname(directory) !== cacheRoot) throw new Error('Refusing to create a browser harness outside the model-test cache')
    await fs.mkdir(directory, {recursive: true})

    const htmlFile = path.join(directory, 'index.html')
    const scriptFile = path.join(directory, 'harness.js')
    await fs.writeFile(htmlFile, '<!doctype html><html><body><div id="vmblu-test-root"></div><script type="module" src="./harness.js"></script></body></html>\n')
    await fs.writeFile(scriptFile, browserHarnessSource(context))
    return {cacheRoot, directory, htmlFile, scriptFile}
}

function browserHarnessSource(context) {
    const modelRuntime = toViteImport(resolveImportModule('@vizualmodel/vmblu-runtime/rt-model-test', context.projectRoot))
    const target = context.scope === 'node' ? sourceTargetManifest(context) : routedTargetManifest(context)
    const factories = context.scope === 'node' ? [target] : target.nodeList
    const imports = factories.map((factory, index) => `import * as factory${index} from ${JSON.stringify(toViteImport(factory.factoryPath))}`)
    let runtimeImport = ''
    let runtimeOption = ''

    if (context.scope !== 'node') {
        const runtimeSpecifier = context.model.raw.header.runtime ?? '@vizualmodel/vmblu-runtime/rt-base'
        const runtimePath = resolveImportModule(runtimeSpecifier, context.projectRoot)
        runtimeImport = `import * as targetRuntimeModule from ${JSON.stringify(toViteImport(runtimePath))}\nconst TargetRuntime = targetRuntimeModule.Runtime ?? targetRuntimeModule.default?.Runtime`
        runtimeOption = ', Runtime: TargetRuntime'
    }

    const serializedTarget = JSON.stringify(target)
    const runtimeOptions = JSON.stringify({
        vmblu: {compatibilityFamily: compatibilityFamily(context.model.raw.header.version)},
        runtimeSettings: context.model.raw.header.runtimeSettings ?? null,
    })

    return `import * as modelTestRuntimeModule from ${JSON.stringify(modelRuntime)}
${runtimeImport}
${imports.join('\n')}

const modelTestRuntime = modelTestRuntimeModule.default ?? modelTestRuntimeModule
const {BrowserTestHost, runModelTests} = modelTestRuntime

const target = ${serializedTarget}
const factoryModules = [${factories.map((_, index) => `factory${index}`).join(', ')}]

function runtimeOptions() {
    const host = new BrowserTestHost({document, root: document.body})
    if (target.scope === 'node') {
        const factory = factoryModules[0][target.functionName]
        if (typeof factory !== 'function') throw new Error('Factory ' + target.functionName + ' is not exported by ' + target.factoryPath)
        return {...target, factory, host}
    }

    const nodeList = target.nodeList.map((node, index) => {
        const factory = factoryModules[index][node.functionName]
        if (typeof factory !== 'function') throw new Error('Factory ' + node.functionName + ' is not exported by ' + node.factoryPath)
        const {factoryPath, functionName, ...descriptor} = node
        return {...descriptor, factory}
    })
    return {nodeList, boundary: target.boundary, runtimeOptions: ${runtimeOptions}, host${runtimeOption}}
}

globalThis.__vmbluModelTest = {
    ready: true,
    run: artifact => runModelTests({artifact, testPath: '<browser>', ...runtimeOptions()}),
}
`
}

async function launchBrowser(chromium, {headless, channel}) {
    const candidates = channel ? [channel] : [null, 'msedge', 'chrome']
    const errors = []
    for (const candidate of candidates) {
        try {
            return await chromium.launch({headless, ...(candidate ? {channel: candidate} : {})})
        }
        catch (error) {
            errors.push(`${candidate ?? 'chromium'}: ${error?.message ?? String(error)}`)
        }
    }
    throw new Error(
        'No test browser could be launched. Install Chromium with "npx playwright install chromium" ' +
        'or set VMBLU_TEST_BROWSER_CHANNEL to chrome or msedge.\n' + errors.join('\n'),
    )
}

function resolveModule(specifier, projectRoot) {
    const projectRequire = createRequire(path.join(projectRoot, 'package.json'))
    try {
        return projectRequire.resolve(specifier)
    }
    catch {
        return ownRequire.resolve(specifier)
    }
}

function resolveImportModule(specifier, projectRoot) {
    try {
        return fileURLToPath(import.meta.resolve(specifier))
    }
    catch {
        return resolveModule(specifier, projectRoot)
    }
}

function toViteImport(file) {
    const pathname = fileURLToPath(pathToFileURL(file)).replaceAll('\\', '/')
    return `/@fs/${pathname}`
}

function applyBrowserErrors(report, errors) {
    if (!errors.length || !report?.scenarios?.length) return
    const scenario = report.scenarios.at(-1)
    scenario.failures.push(...errors.map(message => ({message: `Browser error: ${message}`})))
    if (scenario.status === 'passed') {
        scenario.status = 'error'
        report.summary.passed--
        report.summary.error++
    }
    report.status = 'error'
}

async function removeHarness(harness) {
    if (!harness?.directory || path.dirname(harness.directory) !== harness.cacheRoot) return
    await fs.rm(harness.directory, {recursive: true, force: true})
}
