var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// mcp/mcp-interface.js
import { createServer as createNodeServer } from "http";
import { randomUUID } from "crypto";
import {
  McpServer,
  createMcpHandler,
  fromJsonSchema,
  getOAuthProtectedResourceMetadataUrl,
  oauthMetadataResponse,
  requireBearerAuth
} from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { toNodeHandler } from "@modelcontextprotocol/node";

// agent-base/broker-protocol.js
var BrokerRequestTypes = Object.freeze({
  CAPABILITIES_LIST: "capabilities.list",
  TOOL_CALL: "tool.call",
  PROBE_READ: "probe.read",
  EVENT_WAIT: "event.wait",
  EVENTS_QUERY: "events.query",
  APPROVAL_RESOLVE: "approval.resolve"
});
var BrokerResultTypes = Object.freeze({
  CAPABILITIES_RESULT: "capabilities.result",
  TOOL_RESULT: "tool.result",
  PROBE_RESULT: "probe.result",
  EVENT_RESULT: "event.result",
  EVENTS_RESULT: "events.result",
  BROKER_ERROR: "broker.error"
});
var ToolResultStatus = Object.freeze({
  ACCEPTED: "accepted",
  COMPLETED: "completed",
  VERIFIED: "verified",
  UNVERIFIED: "unverified",
  PENDING: "pending",
  FAILED: "failed",
  TIMEOUT: "timeout",
  DENIED: "denied"
});

// mcp/mcp-interface.js
function createVmbluMcpServer({ broker, profileId, name = "vmblu-application", version = "1.0.0" } = {}) {
  assertBrokerProfile(broker, profileId);
  const capabilities = broker.capabilityView(profileId);
  const server = new McpServer({ name, version });
  for (const tool of capabilities.tools) registerApplicationTool(server, broker, profileId, tool);
  for (const probe of capabilities.probes) registerProbeTool(server, broker, profileId, probe);
  for (const event of capabilities.events) registerEventTool(server, broker, profileId, event);
  return server;
}
__name(createVmbluMcpServer, "createVmbluMcpServer");
function serveVmbluMcpStdio(options = {}) {
  const { broker, profileId, legacy = "serve", onerror } = options;
  assertBrokerProfile(broker, profileId);
  return serveStdio(
    () => createVmbluMcpServer(options),
    { legacy, onerror }
  );
}
__name(serveVmbluMcpStdio, "serveVmbluMcpStdio");
function createVmbluMcpHttpHandler(options = {}) {
  const { broker, profileId } = options;
  assertBrokerProfile(broker, profileId);
  const handler = createMcpHandler(() => createVmbluMcpServer(options), {
    legacy: options.legacy ?? "stateless",
    responseMode: options.responseMode ?? "auto",
    onerror: options.onerror
  });
  const authentication = makeAuthentication(options.authentication);
  return {
    async fetch(request) {
      var _a;
      const metadata = (_a = authentication.metadata) == null ? void 0 : _a.call(authentication, request);
      if (metadata) return metadata;
      if (!matchesMcpPath(request, options.path ?? "/mcp")) {
        return new Response("Not found", { status: 404 });
      }
      if (!authentication.gate) {
        return handler.fetch(request);
      }
      const auth = await authentication.gate(request);
      if (auth instanceof Response) return auth;
      return handler.fetch(request, { authInfo: auth });
    },
    handler,
    profileId,
    authentication: authentication.mode
  };
}
__name(createVmbluMcpHttpHandler, "createVmbluMcpHttpHandler");
async function startVmbluMcpHttpServer(options = {}) {
  var _a, _b;
  const host = options.host ?? "127.0.0.1";
  const port = Number(options.port ?? 8787);
  const authentication = ((_a = options.authentication) == null ? void 0 : _a.mode) ?? "oauth";
  if (authentication === "loopback" && !isLoopbackHost(host)) {
    throw new Error("Unauthenticated MCP HTTP may listen only on a loopback host");
  }
  const fetchHandler = createVmbluMcpHttpHandler(options);
  const nodeHandler = toNodeHandler(fetchHandler, { onerror: options.onerror });
  const server = createNodeServer(async (request, response) => {
    var _a2;
    if (authentication === "loopback" && !isLoopbackAddress((_a2 = request.socket) == null ? void 0 : _a2.remoteAddress)) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
      response.end("Loopback clients only");
      return;
    }
    await nodeHandler(request, response);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
  return {
    server,
    host,
    port: ((_b = server.address()) == null ? void 0 : _b.port) ?? port,
    path: options.path ?? "/mcp",
    profileId: options.profileId,
    close: /* @__PURE__ */ __name(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())), "close")
  };
}
__name(startVmbluMcpHttpServer, "startVmbluMcpHttpServer");
async function startConfiguredVmbluMcpInterfaces({ runtime, hostOptions = {} } = {}) {
  var _a, _b, _c;
  if (!(runtime == null ? void 0 : runtime.toolBroker)) throw new Error("A configured agent runtime is required");
  const enabled = (runtime.agentInterfaces ?? []).filter((item) => item.enabled !== false);
  const stdio = enabled.filter((item) => item.kind === "mcp-stdio");
  if (stdio.length > 1) throw new Error("Only one MCP stdio interface can own the process streams");
  const handles = [];
  for (const item of enabled) {
    const supplied = hostOptions[item.id] ?? {};
    if (item.kind === "mcp-stdio") {
      handles.push(await serveVmbluMcpStdio({
        broker: runtime.toolBroker,
        profileId: item.profile,
        name: supplied.name,
        version: supplied.version,
        onerror: supplied.onerror
      }));
    } else if (item.kind === "mcp-http") {
      handles.push(await startVmbluMcpHttpServer({
        broker: runtime.toolBroker,
        profileId: item.profile,
        host: (_a = item.server) == null ? void 0 : _a.host,
        port: (_b = item.server) == null ? void 0 : _b.port,
        path: (_c = item.server) == null ? void 0 : _c.path,
        authentication: {
          ...item.authentication,
          ...supplied.authentication ?? {}
        },
        name: supplied.name,
        version: supplied.version,
        onerror: supplied.onerror
      }));
    }
  }
  return {
    handles,
    close: /* @__PURE__ */ __name(() => Promise.all(handles.map((handle) => {
      var _a2;
      return (_a2 = handle == null ? void 0 : handle.close) == null ? void 0 : _a2.call(handle);
    }).filter(Boolean)), "close")
  };
}
__name(startConfiguredVmbluMcpInterfaces, "startConfiguredVmbluMcpInterfaces");
function registerApplicationTool(server, broker, profileId, tool) {
  var _a, _b, _c;
  const inputSchema = fromJsonSchema(((_a = tool.input) == null ? void 0 : _a.schema) ?? { type: "object" });
  const outputSchema = ((_c = (_b = tool.output) == null ? void 0 : _b.schema) == null ? void 0 : _c.type) === "object" ? fromJsonSchema(tool.output.schema) : void 0;
  server.registerTool(tool.id, {
    title: tool.title,
    description: tool.description,
    inputSchema,
    ...outputSchema ? { outputSchema } : {},
    annotations: annotationsFromTool(tool)
  }, async (args) => {
    var _a2;
    const result = await broker.handle({
      type: BrokerRequestTypes.TOOL_CALL,
      requestId: randomUUID(),
      agentId: profileId,
      toolId: tool.id,
      args
    });
    return brokerResultToMcp(result, (_a2 = tool.output) == null ? void 0 : _a2.schema);
  });
}
__name(registerApplicationTool, "registerApplicationTool");
function registerProbeTool(server, broker, profileId, probe) {
  var _a;
  const outputSchema = ((_a = probe.schema) == null ? void 0 : _a.type) === "object" ? fromJsonSchema(probe.schema) : void 0;
  server.registerTool(`probe.${probe.id}`, {
    title: probe.title || `Read ${probe.id}`,
    description: probe.description || `Read vmblu probe ${probe.id}.`,
    inputSchema: fromJsonSchema(probe.argsSchema ?? { type: "object" }),
    ...outputSchema ? { outputSchema } : {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  }, async (args) => {
    const result = await broker.handle({
      type: BrokerRequestTypes.PROBE_READ,
      requestId: randomUUID(),
      agentId: profileId,
      probeId: probe.id,
      args
    });
    return brokerResultToMcp(result, probe.schema, "value");
  });
}
__name(registerProbeTool, "registerProbeTool");
function registerEventTool(server, broker, profileId, event) {
  var _a;
  const outputSchema = ((_a = event.schema) == null ? void 0 : _a.type) === "object" ? fromJsonSchema(event.schema) : void 0;
  server.registerTool(`event.wait.${event.id}`, {
    title: event.title || `Wait for ${event.id}`,
    description: event.description || `Wait for the next vmblu event ${event.id}.`,
    inputSchema: fromJsonSchema({
      type: "object",
      properties: { timeoutMs: { type: "integer", minimum: 1 } },
      additionalProperties: false
    }),
    ...outputSchema ? { outputSchema } : {},
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false }
  }, async (args) => {
    const result = await broker.handle({
      type: BrokerRequestTypes.EVENT_WAIT,
      requestId: randomUUID(),
      agentId: profileId,
      eventId: event.id,
      timeoutMs: args == null ? void 0 : args.timeoutMs
    });
    return brokerResultToMcp(result, event.schema, "payload");
  });
}
__name(registerEventTool, "registerEventTool");
function brokerResultToMcp(result, outputSchema = null, valueKey = "result") {
  const hasResult = (result == null ? void 0 : result[valueKey]) !== void 0;
  const value = hasResult ? result[valueKey] : result;
  const text = JSON.stringify(value ?? null, null, 2);
  const successful = ["accepted", "completed", "verified", "ok", "observed"].includes(result == null ? void 0 : result.status);
  const response = {
    content: [{ type: "text", text }],
    ...successful ? {} : { isError: true }
  };
  if ((outputSchema == null ? void 0 : outputSchema.type) === "object" && hasResult && isPlainObject(value)) {
    response.structuredContent = value;
  }
  return response;
}
__name(brokerResultToMcp, "brokerResultToMcp");
function annotationsFromTool(tool) {
  return {
    readOnlyHint: false,
    destructiveHint: tool.risk === "high",
    idempotentHint: false,
    openWorldHint: false
  };
}
__name(annotationsFromTool, "annotationsFromTool");
function makeAuthentication(authentication = null) {
  var _a;
  const mode = (authentication == null ? void 0 : authentication.mode) ?? "oauth";
  if (mode === "loopback") return { mode, gate: null, metadata: null };
  if (mode !== "oauth") throw new Error(`Unsupported MCP HTTP authentication mode: ${mode}`);
  if (!((_a = authentication == null ? void 0 : authentication.verifier) == null ? void 0 : _a.verifyAccessToken)) {
    throw new Error("OAuth MCP HTTP requires a token verifier");
  }
  if (!(authentication == null ? void 0 : authentication.resourceServerUrl)) {
    throw new Error("OAuth MCP HTTP requires resourceServerUrl");
  }
  if (!(authentication == null ? void 0 : authentication.oauthMetadata)) {
    throw new Error("OAuth MCP HTTP requires authorization-server metadata");
  }
  if (authentication.issuer && normalizeUrl(authentication.oauthMetadata.issuer) !== normalizeUrl(authentication.issuer)) {
    throw new Error("OAuth metadata issuer does not match the configured issuer");
  }
  const resourceServerUrl = new URL(authentication.resourceServerUrl);
  const resourceMetadataUrl = getOAuthProtectedResourceMetadataUrl(resourceServerUrl).toString();
  const gate = requireBearerAuth({
    verifier: authentication.verifier,
    requiredScopes: authentication.requiredScopes ?? ["mcp"],
    resourceMetadataUrl
  });
  const metadataOptions = {
    oauthMetadata: authentication.oauthMetadata,
    resourceServerUrl,
    scopesSupported: authentication.requiredScopes ?? ["mcp"],
    dangerouslyAllowInsecureIssuerUrl: authentication.dangerouslyAllowInsecureIssuerUrl === true
  };
  return {
    mode,
    gate,
    metadata: /* @__PURE__ */ __name((request) => oauthMetadataResponse(request, metadataOptions), "metadata")
  };
}
__name(makeAuthentication, "makeAuthentication");
function assertBrokerProfile(broker, profileId) {
  var _a;
  if (!(broker == null ? void 0 : broker.handle) || !(broker == null ? void 0 : broker.capabilityView)) throw new Error("A ToolBroker is required");
  const identity = (_a = broker.identityDecision) == null ? void 0 : _a.call(broker, profileId);
  if (!(identity == null ? void 0 : identity.allowed)) throw new Error(`MCP interface profile is unavailable: ${profileId ?? "<missing>"}`);
}
__name(assertBrokerProfile, "assertBrokerProfile");
function matchesMcpPath(request, expectedPath) {
  return new URL(request.url).pathname === expectedPath;
}
__name(matchesMcpPath, "matchesMcpPath");
function isLoopbackHost(host) {
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}
__name(isLoopbackHost, "isLoopbackHost");
function isLoopbackAddress(address) {
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}
__name(isLoopbackAddress, "isLoopbackAddress");
function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
__name(isPlainObject, "isPlainObject");
function normalizeUrl(value) {
  const url = new URL(value);
  return url.toString().replace(/\/$/, "");
}
__name(normalizeUrl, "normalizeUrl");
export {
  createVmbluMcpHttpHandler,
  createVmbluMcpServer,
  serveVmbluMcpStdio,
  startConfiguredVmbluMcpInterfaces,
  startVmbluMcpHttpServer
};
//# sourceMappingURL=index.js.map