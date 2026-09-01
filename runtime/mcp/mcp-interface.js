import {createServer as createNodeServer} from 'node:http'
import {randomUUID} from 'node:crypto'

import {
    McpServer,
    createMcpHandler,
    fromJsonSchema,
    getOAuthProtectedResourceMetadataUrl,
    oauthMetadataResponse,
    requireBearerAuth,
} from '@modelcontextprotocol/server'
import {serveStdio} from '@modelcontextprotocol/server/stdio'
import {toNodeHandler} from '@modelcontextprotocol/node'

import {BrokerRequestTypes} from '../agent-base/broker-protocol.js'

export function createVmbluMcpServer({broker, profileId, name = 'vmblu-application', version = '1.0.0'} = {}) {
    assertBrokerProfile(broker, profileId)
    const capabilities = broker.capabilityView(profileId)
    const server = new McpServer({name, version})

    for (const tool of capabilities.tools) registerApplicationTool(server, broker, profileId, tool)
    for (const probe of capabilities.probes) registerProbeTool(server, broker, profileId, probe)
    for (const event of capabilities.events) registerEventTool(server, broker, profileId, event)

    return server
}

export function serveVmbluMcpStdio(options = {}) {
    const {broker, profileId, legacy = 'serve', onerror} = options
    assertBrokerProfile(broker, profileId)
    return serveStdio(
        () => createVmbluMcpServer(options),
        {legacy, onerror},
    )
}

export function createVmbluMcpHttpHandler(options = {}) {
    const {broker, profileId} = options
    assertBrokerProfile(broker, profileId)
    const handler = createMcpHandler(() => createVmbluMcpServer(options), {
        legacy: options.legacy ?? 'stateless',
        responseMode: options.responseMode ?? 'auto',
        onerror: options.onerror,
    })

    const authentication = makeAuthentication(options.authentication)
    return {
        async fetch(request) {
            const metadata = authentication.metadata?.(request)
            if (metadata) return metadata

            if (!matchesMcpPath(request, options.path ?? '/mcp')) {
                return new Response('Not found', {status: 404})
            }

            if (!authentication.gate) {
                return handler.fetch(request)
            }

            const auth = await authentication.gate(request)
            if (auth instanceof Response) return auth
            return handler.fetch(request, {authInfo: auth})
        },
        handler,
        profileId,
        authentication: authentication.mode,
    }
}

export async function startVmbluMcpHttpServer(options = {}) {
    const host = options.host ?? '127.0.0.1'
    const port = Number(options.port ?? 8787)
    const authentication = options.authentication?.mode ?? 'oauth'
    if (authentication === 'loopback' && !isLoopbackHost(host)) {
        throw new Error('Unauthenticated MCP HTTP may listen only on a loopback host')
    }

    const fetchHandler = createVmbluMcpHttpHandler(options)
    const nodeHandler = toNodeHandler(fetchHandler, {onerror: options.onerror})
    const server = createNodeServer(async (request, response) => {
        if (authentication === 'loopback' && !isLoopbackAddress(request.socket?.remoteAddress)) {
            response.writeHead(403, {'content-type': 'text/plain; charset=utf-8'})
            response.end('Loopback clients only')
            return
        }
        await nodeHandler(request, response)
    })

    await new Promise((resolve, reject) => {
        server.once('error', reject)
        server.listen(port, host, resolve)
    })

    return {
        server,
        host,
        port: server.address()?.port ?? port,
        path: options.path ?? '/mcp',
        profileId: options.profileId,
        close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
    }
}

export async function startConfiguredVmbluMcpInterfaces({runtime, hostOptions = {}} = {}) {
    if (!runtime?.toolBroker) throw new Error('A configured agent runtime is required')
    const enabled = (runtime.agentInterfaces ?? []).filter(item => item.enabled !== false)
    const stdio = enabled.filter(item => item.kind === 'mcp-stdio')
    if (stdio.length > 1) throw new Error('Only one MCP stdio interface can own the process streams')

    const handles = []
    for (const item of enabled) {
        const supplied = hostOptions[item.id] ?? {}
        if (item.kind === 'mcp-stdio') {
            handles.push(await serveVmbluMcpStdio({
                broker: runtime.toolBroker,
                profileId: item.profile,
                name: supplied.name,
                version: supplied.version,
                onerror: supplied.onerror,
            }))
        }
        else if (item.kind === 'mcp-http') {
            handles.push(await startVmbluMcpHttpServer({
                broker: runtime.toolBroker,
                profileId: item.profile,
                host: item.server?.host,
                port: item.server?.port,
                path: item.server?.path,
                authentication: {
                    ...item.authentication,
                    ...(supplied.authentication ?? {}),
                },
                name: supplied.name,
                version: supplied.version,
                onerror: supplied.onerror,
            }))
        }
    }

    return {
        handles,
        close: () => Promise.all(handles.map(handle => handle?.close?.()).filter(Boolean)),
    }
}

function registerApplicationTool(server, broker, profileId, tool) {
    const inputSchema = fromJsonSchema(tool.input?.schema ?? {type: 'object'})
    const outputSchema = tool.output?.schema?.type === 'object'
        ? fromJsonSchema(tool.output.schema)
        : undefined

    server.registerTool(tool.id, {
        title: tool.title,
        description: tool.description,
        inputSchema,
        ...(outputSchema ? {outputSchema} : {}),
        annotations: annotationsFromTool(tool),
    }, async args => {
        const result = await broker.handle({
            type: BrokerRequestTypes.TOOL_CALL,
            requestId: randomUUID(),
            agentId: profileId,
            toolId: tool.id,
            args,
        })
        return brokerResultToMcp(result, tool.output?.schema)
    })
}

function registerProbeTool(server, broker, profileId, probe) {
    const outputSchema = probe.schema?.type === 'object'
        ? fromJsonSchema(probe.schema)
        : undefined
    server.registerTool(`probe.${probe.id}`, {
        title: probe.title || `Read ${probe.id}`,
        description: probe.description || `Read vmblu probe ${probe.id}.`,
        inputSchema: fromJsonSchema(probe.argsSchema ?? {type: 'object'}),
        ...(outputSchema ? {outputSchema} : {}),
        annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: true},
    }, async args => {
        const result = await broker.handle({
            type: BrokerRequestTypes.PROBE_READ,
            requestId: randomUUID(),
            agentId: profileId,
            probeId: probe.id,
            args,
        })
        return brokerResultToMcp(result, probe.schema, 'value')
    })
}

function registerEventTool(server, broker, profileId, event) {
    const outputSchema = event.schema?.type === 'object'
        ? fromJsonSchema(event.schema)
        : undefined
    server.registerTool(`event.wait.${event.id}`, {
        title: event.title || `Wait for ${event.id}`,
        description: event.description || `Wait for the next vmblu event ${event.id}.`,
        inputSchema: fromJsonSchema({
            type: 'object',
            properties: {timeoutMs: {type: 'integer', minimum: 1}},
            additionalProperties: false,
        }),
        ...(outputSchema ? {outputSchema} : {}),
        annotations: {readOnlyHint: true, destructiveHint: false, idempotentHint: false},
    }, async args => {
        const result = await broker.handle({
            type: BrokerRequestTypes.EVENT_WAIT,
            requestId: randomUUID(),
            agentId: profileId,
            eventId: event.id,
            timeoutMs: args?.timeoutMs,
        })
        return brokerResultToMcp(result, event.schema, 'payload')
    })
}

function brokerResultToMcp(result, outputSchema = null, valueKey = 'result') {
    const hasResult = result?.[valueKey] !== undefined
    const value = hasResult ? result[valueKey] : result
    const text = JSON.stringify(value ?? null, null, 2)
    const successful = ['accepted', 'completed', 'verified', 'ok', 'observed'].includes(result?.status)
    const response = {
        content: [{type: 'text', text}],
        ...(successful ? {} : {isError: true}),
    }
    if (outputSchema?.type === 'object' && hasResult && isPlainObject(value)) {
        response.structuredContent = value
    }
    return response
}

function annotationsFromTool(tool) {
    return {
        readOnlyHint: false,
        destructiveHint: tool.risk === 'high',
        idempotentHint: false,
        openWorldHint: false,
    }
}

function makeAuthentication(authentication = null) {
    const mode = authentication?.mode ?? 'oauth'
    if (mode === 'loopback') return {mode, gate: null, metadata: null}
    if (mode !== 'oauth') throw new Error(`Unsupported MCP HTTP authentication mode: ${mode}`)
    if (!authentication?.verifier?.verifyAccessToken) {
        throw new Error('OAuth MCP HTTP requires a token verifier')
    }
    if (!authentication?.resourceServerUrl) {
        throw new Error('OAuth MCP HTTP requires resourceServerUrl')
    }
    if (!authentication?.oauthMetadata) {
        throw new Error('OAuth MCP HTTP requires authorization-server metadata')
    }
    if (authentication.issuer
        && normalizeUrl(authentication.oauthMetadata.issuer) !== normalizeUrl(authentication.issuer)) {
        throw new Error('OAuth metadata issuer does not match the configured issuer')
    }

    const resourceServerUrl = new URL(authentication.resourceServerUrl)
    const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(resourceServerUrl).toString()
    const gate = requireBearerAuth({
        verifier: authentication.verifier,
        requiredScopes: authentication.requiredScopes ?? ['mcp'],
        resourceMetadataUrl,
    })
    const metadataOptions = {
        oauthMetadata: authentication.oauthMetadata,
        resourceServerUrl,
        scopesSupported: authentication.requiredScopes ?? ['mcp'],
        dangerouslyAllowInsecureIssuerUrl: authentication.dangerouslyAllowInsecureIssuerUrl === true,
    }
    return {
        mode,
        gate,
        metadata: request => oauthMetadataResponse(request, metadataOptions),
    }
}

function assertBrokerProfile(broker, profileId) {
    if (!broker?.handle || !broker?.capabilityView) throw new Error('A ToolBroker is required')
    const identity = broker.identityDecision?.(profileId)
    if (!identity?.allowed) throw new Error(`MCP interface profile is unavailable: ${profileId ?? '<missing>'}`)
}

function matchesMcpPath(request, expectedPath) {
    return new URL(request.url).pathname === expectedPath
}

function isLoopbackHost(host) {
    return host === '127.0.0.1' || host === '::1' || host === 'localhost'
}

function isLoopbackAddress(address) {
    return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function isPlainObject(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value)
}

function normalizeUrl(value) {
    const url = new URL(value)
    return url.toString().replace(/\/$/, '')
}
