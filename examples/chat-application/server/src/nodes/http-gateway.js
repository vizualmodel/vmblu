import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { existsSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function createId(prefix = "msg") {
  if (typeof randomUUID === "function") {
    return `${prefix}-${randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createHttpGateway(tx, sx) {
  const port = Number.parseInt(sx?.port ?? process.env.PORT ?? "4000", 10);
  const host = sx?.host ?? "0.0.0.0";
  const clientRoot = sx?.clientRoot ?? resolve(__dirname, "../../../client/dist");
  const clientIndex = sx?.clientIndex ?? "index.html";

  const fastify = Fastify({
    logger: sx?.logger ?? true
  });

  const subscribers = new Set();

  function setupSSE(reply) {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": sx?.cors?.origin ?? "*"
    });
    reply.raw.write("\n");
    const client = reply.raw;
    const heartbeat = setInterval(() => {
      client.write(":keep-alive\n\n");
    }, 25000);

    const record = { client, heartbeat };
    subscribers.add(record);

    reply.raw.on("close", () => {
      clearInterval(heartbeat);
      subscribers.delete(record);
    });
  }

  function broadcast(message) {
    const payload = `data: ${JSON.stringify(message)}\n\n`;
    for (const { client } of subscribers) {
      try {
        client.write(payload);
      } catch (error) {
        fastify.log.warn({ err: error }, "Failed to write to SSE client");
      }
    }
  }

  fastify.register(cors, sx?.cors ?? { origin: true });

  fastify.post("/messages", async (request, reply) => {
    const body = request.body ?? {};
    const text = typeof body.text === "string" ? body.text.trim() : "";

    if (!text) {
      reply.code(400).send({ error: "text_required" });
      return;
    }

    const author = typeof body.author === "string" && body.author.trim() ? body.author.trim() : "anonymous";
    const message = {
      id: body.id ?? createId("server"),
      author,
      text,
      createdAt: new Date().toISOString()
    };

    tx.send("newMessage", message);

    reply.code(201).send(message);
  });

  fastify.get("/history", async (request, reply) => {
    try {
      const records = await tx.request("historyRequest", {});
      reply.send(Array.isArray(records) ? records : []);
    } catch (error) {
      fastify.log.error({ err: error }, "Failed to load history");
      reply.code(500).send({ error: "history_unavailable" });
    }
  });

  fastify.get("/events", async (request, reply) => {
    setupSSE(reply);
    try {
      const records = await tx.request("historyRequest", {});
      const snapshot = Array.isArray(records) ? records : [];
      if (snapshot.length > 0) {
        reply.raw.write(`data: ${JSON.stringify({ type: "history", messages: snapshot })}\n\n`);
      }
    } catch (error) {
      fastify.log.warn({ err: error }, "Failed to send initial history over SSE");
    }
  });

  fastify.get("/health", async () => ({ status: "ok" }));

  if (existsSync(clientRoot)) {
    fastify.log.info({ clientRoot }, "Serving static client assets");
    fastify.register(fastifyStatic, {
      root: clientRoot,
      decorateReply: false
    });

    fastify.setNotFoundHandler((request, reply) => {
      reply.sendFile(clientIndex);
    });
  } else {
    fastify.log.warn({ clientRoot }, "Client build directory not found. Run `npm run build -w client` to generate it.");
  }

  fastify.listen({ port, host }).catch((error) => {
    fastify.log.error({ err: error }, "HttpGateway failed to listen");
  });

  return {
    onBroadcast(message) {
      broadcast({ type: "message", message });
    }
  };
}
