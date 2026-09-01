import {SCHEMA_VERSION} from '../../core/types/model/schema-version.js'

export function chatSystem() {
    return {
        header: {
            version: SCHEMA_VERSION,
            name: 'Chat system',
        },
        nodes: [
            {
                id: 'chat-client',
                kind: 'application',
                name: 'Chat client',
                vmblu: true,
                position: {x: 100, y: 100},
                references: [
                    {kind: 'model', label: 'Open application', target: '../client/chat-client.blu'},
                    {kind: 'documentation', target: '../client/README.md'},
                    {
                        kind: 'build',
                        target: '../client/package.json',
                        command: 'npm run build',
                        workingDirectory: '../client',
                    },
                ],
                endpoints: [
                    {
                        id: 'chat',
                        name: 'Live messages',
                        role: 'client',
                        protocol: '../protocols/chat.protocol.json',
                    },
                ],
                extensions: {future: {kept: true}},
            },
            {
                id: 'chat-server',
                kind: 'application',
                name: 'Chat server',
                vmblu: true,
                position: {x: 520, y: 100},
                references: [{kind: 'model', label: 'Open application', target: '../server/chat-server.blu'}],
                endpoints: [
                    {
                        id: 'chat',
                        name: 'Live messages',
                        role: 'server',
                        protocol: '../protocols/chat.protocol.json',
                    },
                ],
            },
        ],
        connections: [
            {
                id: 'realtime-chat',
                from: {node: 'chat-client', endpoint: 'chat'},
                to: {node: 'chat-server', endpoint: 'chat'},
                transport: 'websocket',
            },
        ],
        references: [
            {kind: 'prompt', label: 'Application prompt', target: '../prompt.md'},
        ],
        view: {offset: {x: 0, y: 0}, zoom: 1},
    }
}

export function transmitter() {
    const messages = []
    return {
        messages,
        send(pin, payload) {
            messages.push({pin, payload})
        },
        last(pin) {
            return messages.findLast(message => message.pin === pin)
        },
    }
}
