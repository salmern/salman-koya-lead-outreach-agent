/**
 * Next.js instrumentation hook. Runs once per server process at startup.
 *
 * We start the in-process run worker here so confirmed runs get processed
 * without an external queue. This requires a long-lived Node server; see
 * docs/architecture.md for the serverless caveat.
 *
 * The import stays inside the `NEXT_RUNTIME === "nodejs"` branch so the Edge
 * compiler (middleware) can drop the Node-only dependency tree (apify-client
 * and friends).
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startRunWorker } = await import("@/server/run-worker");
    startRunWorker();
  }
}
