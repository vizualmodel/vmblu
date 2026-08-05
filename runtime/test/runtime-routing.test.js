import test from 'node:test'
import assert from 'node:assert/strict'
import {Runtime} from '../rt-base/runtime.js'

function waitFor(predicate, timeoutMs = 1000) {
    const start = Date.now()

    return new Promise((resolve, reject) => {
        const tick = () => {
            const value = predicate()
            if (value) return resolve(value)
            if ((Date.now() - start) > timeoutMs) return reject(new Error('Timed out waiting for condition'))
            setTimeout(tick, 10)
        }

        tick()
    })
}

function createRuntime(received) {
    function SourceFactory(tx) {
        return {tx}
    }

    function ReceiverFactory(tx, sx) {
        return {
            onNotice(param) {
                received.push([sx.name, param])
            },

            onQuestion(param) {
                tx.reply(`${sx.name}:${param}`)
            },
        }
    }

    return new Runtime([
        {
            name: 'Source',
            uid: 'source',
            factory: SourceFactory,
            inputs: [],
            outputs: [
                'notice -> ["notice @ Alpha (alpha)", "notice @ Beta (beta)"]',
                'question => ["question @ Alpha (alpha)", "question @ Beta (beta)"]',
            ],
        },
        {
            name: 'Alpha',
            uid: 'alpha',
            factory: ReceiverFactory,
            inputs: ['-> notice', '=> question'],
            outputs: [],
            sx: {name: 'Alpha'},
        },
        {
            name: 'Beta',
            uid: 'beta',
            factory: ReceiverFactory,
            inputs: ['-> notice', '=> question'],
            outputs: [],
            sx: {name: 'Beta'},
        },
    ])
}

test('to sends only to the selected connected node', async () => {
    const received = []
    const runtime = createRuntime(received)
    runtime.start()

    try {
        const sent = runtime.actors[0].cell.tx.to('Beta').send('notice', 42)

        assert.equal(sent, 1)
        await waitFor(() => received.length === 1)
        assert.deepEqual(received, [['Beta', 42]])
    } finally {
        runtime.stop()
    }
})

test('select remains a compatibility alias for to', async () => {
    const received = []
    const runtime = createRuntime(received)
    runtime.start()

    try {
        runtime.actors[0].cell.tx.select('Alpha').send('notice', 7)

        await waitFor(() => received.length === 1)
        assert.deepEqual(received, [['Alpha', 7]])
    } finally {
        runtime.stop()
    }
})

test('to requests a reply only from the selected connected node', async () => {
    const received = []
    const runtime = createRuntime(received)
    runtime.start()

    try {
        const reply = await runtime.actors[0].cell.tx.to('Beta').request('question', 'hello', 500)

        assert.equal(reply, 'Beta:hello')
    } finally {
        runtime.stop()
    }
})
