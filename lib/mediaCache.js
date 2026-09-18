import { MAX_MEDIA_BYTES } from "./generation.js";

// Session-only, byte-bounded LRU. Shared requests cancel only when their last reader leaves.
export function mediaCache({ maxBytes = MAX_MEDIA_BYTES, maxPending = 4 } = {}) {
  const cached = new Map();
  const pending = new Map();
  let bytes = 0;
  return {
    async get(key, generate, signal) {
      signal.throwIfAborted();
      if (cached.has(key)) {
        const value = cached.get(key);
        cached.delete(key);
        cached.set(key, value);
        return value;
      }
      let entry = pending.get(key);
      if (!entry) {
        if (pending.size >= maxPending) throw Object.assign(new Error("Too many media generations; try again shortly"), { statusCode: 429 });
        entry = { controller: new AbortController(), readers: 0 };
        pending.set(key, entry);
        entry.promise = Promise.resolve().then(() => generate(entry.controller.signal)).then((value) => {
          if (!entry.controller.signal.aborted && value.body.length <= maxBytes) {
            while (bytes + value.body.length > maxBytes && cached.size) {
              const oldest = cached.keys().next().value;
              bytes -= cached.get(oldest).body.length;
              cached.delete(oldest);
            }
            cached.set(key, value);
            bytes += value.body.length;
          }
          return value;
        }).finally(() => {
          if (pending.get(key) === entry) pending.delete(key);
        });
      }
      entry.readers++;
      let onAbort;
      const aborted = new Promise((_, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener("abort", onAbort, { once: true });
      });
      try {
        return await Promise.race([entry.promise, aborted]);
      } finally {
        signal.removeEventListener("abort", onAbort);
        if (--entry.readers === 0 && pending.get(key) === entry) {
          pending.delete(key);
          entry.controller.abort();
        }
      }
    },
    close() {
      for (const entry of pending.values()) entry.controller.abort();
      pending.clear();
      cached.clear();
      bytes = 0;
    },
  };
}
