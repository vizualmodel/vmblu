import {deepEqual} from './deep-equal.js'
import {hashTestArtifact} from './artifact-hash.js'
import {RoutedModelTestAdapter} from './routed-model-adapter.js'
import {SourceNodeTestAdapter} from './source-node-adapter.js'

export class ModelTestRuntime {
    constructor({adapter=null, scope=null, ...options}={}) {
        this.adapter = adapter ?? createAdapter(scope, options)
        if (!this.adapter) throw new TypeError('ModelTestRuntime requires a target adapter or supported scope')
    }

    async run(artifact, {testPath='<memory>', artifactHash=null}={}) {
        if (!artifact?.target || !Array.isArray(artifact?.scenarios)) {
            throw new TypeError('ModelTestRuntime requires a valid model test artifact')
        }

        const started = Date.now()
        const scenarios = []
        for (const scenario of artifact.scenarios) scenarios.push(await this.runScenario(scenario))

        const summary = summarize(scenarios)
        return {
            $schema: `https://vmblu.dev/context/${artifact.schemaVersion}/test-report.schema.json`,
            kind: 'vmblu.test-report',
            version: 1,
            schemaVersion: artifact.schemaVersion,
            test: testPath,
            artifactHash: artifactHash ?? hashTestArtifact(artifact),
            target: normalizeTarget(artifact.target),
            startedAt: new Date(started).toISOString(),
            durationMs: Date.now() - started,
            status: summary.error > 0 ? 'error' : summary.failed > 0 ? 'failed' : 'passed',
            summary,
            scenarios,
        }
    }

    async runScenario(scenario) {
        const started = Date.now()
        const failures = []
        let observations = []

        let status = 'passed'
        try {
            await this.adapter.start(scenario)
            const timeoutMs = scenario.timeoutMs ?? 1000
            await withTimeout(this.runActions(scenario.actions), timeoutMs, scenario.id)
            observations = this.adapter.getObservations()
            failures.push(...compareMessageObservations(scenario.expect, observations))

            for (const expectation of scenario.expect.filter(item => item.kind === 'view')) {
                const failure = await this.adapter.assert(expectation)
                if (failure) failures.push(failure)
            }

            status = failures.length ? 'failed' : 'passed'
        }
        catch (error) {
            observations = this.adapter.getObservations?.() ?? observations
            failures.push({message: error?.message ?? String(error)})
            status = 'error'
        }
        finally {
            try {
                await this.adapter.stop()
            }
            catch (error) {
                failures.push({message: `Test cleanup failed: ${error?.message ?? String(error)}`})
                status = 'error'
            }
        }
        return scenarioResult(scenario, status, started, observations, failures)
    }

    async runActions(actions) {
        for (const action of actions) await this.adapter.execute(action)
    }
}

export async function runModelTests(options) {
    const {artifact, testPath, artifactHash, ...runtimeOptions} = options ?? {}
    const scope = artifact?.target?.scope ?? runtimeOptions.scope ?? 'node'
    return new ModelTestRuntime({...runtimeOptions, scope}).run(artifact, {testPath, artifactHash})
}

function createAdapter(scope, options) {
    if (scope === 'node') return new SourceNodeTestAdapter(options)
    if (scope === 'group' || scope === 'model') return new RoutedModelTestAdapter(options)
    return null
}

function compareMessageObservations(expectations, observations) {
    const expected = expand(expectations.filter(item => item.kind === 'send' || item.kind === 'reply'))
    const actual = observations
        .filter(item => item.kind === 'send' || item.kind === 'reply')
        .map(({kind, pin, message}) => ({kind, pin, message}))
    if (deepEqual(actual, expected)) return []
    return [{
        message: 'Observed boundary messages do not match the expected sequence',
        expected,
        observed: actual,
    }]
}

function expand(expectations) {
    const result = []
    for (const expectation of expectations) {
        for (let index = 0; index < (expectation.count ?? 1); index++) {
            result.push({kind: expectation.kind, pin: expectation.pin, message: expectation.message})
        }
    }
    return result
}

function scenarioResult(scenario, status, started, observations, failures) {
    return {
        id: scenario.id,
        title: scenario.title,
        purpose: scenario.purpose,
        actions: scenario.actions,
        expect: scenario.expect,
        status,
        durationMs: Date.now() - started,
        observations,
        failures,
    }
}

function normalizeTarget(target) {
    return {scope: target.scope ?? 'node', name: target.name, path: target.path}
}

function summarize(scenarios) {
    const summary = {total: scenarios.length, passed: 0, failed: 0, skipped: 0, error: 0}
    for (const scenario of scenarios) summary[scenario.status]++
    return summary
}

function withTimeout(promise, timeoutMs, scenarioId) {
    if (!timeoutMs) return promise
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Scenario '${scenarioId}' timed out after ${timeoutMs} ms`)), timeoutMs)
        Promise.resolve(promise).then(
            value => { clearTimeout(timer); resolve(value) },
            error => { clearTimeout(timer); reject(error) },
        )
    })
}
