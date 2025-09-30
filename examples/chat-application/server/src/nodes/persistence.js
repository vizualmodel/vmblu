import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, resolve } from "path";

function clone(messages) {
  return messages.map((entry) => ({ ...entry }));
}

/**
 * @node Persistence
 */

export function createPersistence(tx, sx) {
  const filePath = resolve(process.cwd(), sx?.file ?? "server/data/messages.json");
  let history = [];
  let writeChain = Promise.resolve();

  async function ensureDirectory() {
    await mkdir(dirname(filePath), { recursive: true });
  }

  async function persist() {
    await ensureDirectory();
    await writeFile(filePath, JSON.stringify(history, null, 2), "utf8");
  }

  async function load() {
    try {
      const data = await readFile(filePath, "utf8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        history = parsed.map((entry) => ({ ...entry }));
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.warn("Persistence: failed to load history", error);
      } else {
        await ensureDirectory();
        await writeFile(filePath, "[]", "utf8");
      }
    }
  }

  const ready = load();

  function scheduleWrite() {
    writeChain = writeChain.then(persist).catch((error) => {
      console.warn("Persistence: failed to persist history", error);
    });
  }

  return {
    async onStore(payload) {
      if (!payload || typeof payload !== "object") {
        return;
      }
      await ready;
      history.push({ ...payload });
      scheduleWrite();
    },
    async onHistoryQuery() {
      await ready;
      await writeChain;
      tx.reply(clone(history));
    }
  };
}
