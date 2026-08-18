import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

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
    logger.info({ jobId: job.id, jobName: job.name }, "processed job");
  },
  { connection },
);

worker.on("ready", () => {
  logger.info({ queue: QUEUE_NAME }, "connected to Redis, listening on queue");
});

worker.on("error", (error) => {
  logger.error({ err: error }, "worker error");
});

async function scheduleHeartbeat(): Promise<void> {
  await queue.add(
    "heartbeat",
    { at: new Date().toISOString() },
    { repeat: { every: 30_000 }, removeOnComplete: true, removeOnFail: true },
  );
}

scheduleHeartbeat().catch((error: unknown) => {
  logger.error({ err: error }, "failed to schedule heartbeat");
});

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  logger.info({ signal }, "shutting down");
  await worker.close();
  await queue.close();
  await connection.quit();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
