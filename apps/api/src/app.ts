import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import healthRouter from "./routes/health.js";
import authRouter from "./modules/auth/auth.routes.js";
import organizationRouter from "./modules/organization/organization.routes.js";
import departmentRouter from "./modules/department/department.routes.js";
import laboratoryRouter from "./modules/laboratory/laboratory.routes.js";
import courseRouter from "./modules/course/course.routes.js";
import gpuNodeRouter from "./modules/gpuNode/gpuNode.routes.js";
import userRouter from "./modules/user/user.routes.js";
import telemetryRouter from "./modules/telemetry/telemetry.routes.js";
import gpuNodeHealthRouter from "./modules/telemetry/gpuNodeHealth.routes.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.use(healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/organizations", organizationRouter);
  app.use("/api/v1/departments", departmentRouter);
  app.use("/api/v1/laboratories", laboratoryRouter);
  app.use("/api/v1/courses", courseRouter);
  // Must be mounted before gpuNodeRouter: "/live" would otherwise be
  // swallowed by the admin router's GET "/:id" (id="live"). See
  // gpuNodeHealth.routes.ts for the full explanation.
  app.use("/api/v1/gpu-nodes", gpuNodeHealthRouter);
  app.use("/api/v1/gpu-nodes", gpuNodeRouter);
  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/telemetry", telemetryRouter);

  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  // Express 4 error middleware must take exactly four parameters to be
  // recognized as an error handler, even though `next` is unused here.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[api] unhandled error", err);
    res
      .status(500)
      .json({ ok: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
  });

  return app;
}
