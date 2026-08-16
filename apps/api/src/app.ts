import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import healthRouter from "./routes/health.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json());

  app.use(healthRouter);

  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  return app;
}
