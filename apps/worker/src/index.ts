import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./config/env.js";

/**
 * Phase 1 foundation worker. No domain job processors (notifications,
 * waitlist, reminders, ...) exist yet — this only proves that the worker
 * process can connect to Redis and run a BullMQ queue end to end.
 */

const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });

const QUEUE_NAME = "foundation-heartbeat";

const queue = new Queue(QUEUE_NAME, { connection });

const worker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    console.log(`[worker] processed job ${job.id} (${job.name})`);
  },
  { connection },
);

worker.on("ready", () => {
  console.log(`[worker] connected to Redis, listening on queue "${QUEUE_NAME}"`);
});

worker.on("error", (error) => {
  console.error("[worker] error", error);
});

async function scheduleHeartbeat(): Promise<void> {
  await queue.add(
    "heartbeat",
    { at: new Date().toISOString() },
    { repeat: { every: 30_000 }, removeOnComplete: true, removeOnFail: true },
  );
}

scheduleHeartbeat().catch((error: unknown) => {
  console.error("[worker] failed to schedule heartbeat", error);
});

async function shutdown(): Promise<void> {
  await worker.close();
  await queue.close();
  await connection.quit();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
