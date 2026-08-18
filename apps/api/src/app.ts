import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { requestLogger } from "./middleware/requestLogger.js";
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
import reservationRouter from "./modules/reservation/reservation.routes.js";
import gpuNodeAvailabilityRouter from "./modules/reservation/gpuNodeAvailability.routes.js";
import laboratoryCalendarRouter from "./modules/reservation/laboratoryCalendar.routes.js";
import facultyRouter from "./modules/faculty/faculty.routes.js";
import reservationBulkRouter from "./modules/faculty/reservationBulk.routes.js";
import analyticsRouter from "./modules/analytics/analytics.routes.js";
import reportsRouter from "./modules/analytics/reports.routes.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(requestLogger);
  app.use(express.json());
  app.use(cookieParser());

  app.use(healthRouter);
  app.use("/api/v1/auth", authRouter);
  app.use("/api/v1/organizations", organizationRouter);
  app.use("/api/v1/departments", departmentRouter);
  // Must be mounted before laboratoryRouter for grouping consistency with
  // the gpu-nodes routers below, though "/:id/calendar" (two segments)
  // can never actually collide with the admin router's "/:id" (one).
  app.use("/api/v1/laboratories", laboratoryCalendarRouter);
  app.use("/api/v1/laboratories", laboratoryRouter);
  app.use("/api/v1/courses", courseRouter);
  // Both must be mounted before gpuNodeRouter: "/live" and "/availability"
  // would otherwise be swallowed by the admin router's GET "/:id"
  // (id="live" / id="availability"). See gpuNodeHealth.routes.ts and
  // gpuNodeAvailability.routes.ts for the full explanation.
  app.use("/api/v1/gpu-nodes", gpuNodeHealthRouter);
  app.use("/api/v1/gpu-nodes", gpuNodeAvailabilityRouter);
  app.use("/api/v1/gpu-nodes", gpuNodeRouter);
  app.use("/api/v1/users", userRouter);
  app.use("/api/v1/telemetry", telemetryRouter);
  // Must be mounted before reservationRouter for the same reason as the
  // gpu-nodes pair above — not required for a path collision here (no
  // collision is possible; see reservationBulk.routes.ts), just grouping
  // consistency with the rest of this file.
  app.use("/api/v1/reservations", reservationBulkRouter);
  app.use("/api/v1/reservations", reservationRouter);
  app.use("/api/v1/faculty", facultyRouter);
  app.use("/api/v1/analytics", analyticsRouter);
  app.use("/api/v1/reports", reportsRouter);

  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Route not found" } });
  });

  // Express 4 error middleware must take exactly four parameters to be
  // recognized as an error handler, even though `next` is unused here.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    // express.json() throws a SyntaxError with `status: 400` for a
    // malformed request body — it never reaches controllerHandler's
    // AppError/ZodError mapping since parsing fails before any route runs.
    // Without this check that client input error was reported as a 500.
    const status =
      typeof err === "object" && err !== null && "status" in err && typeof err.status === "number"
        ? err.status
        : undefined;

    if (status !== undefined && status >= 400 && status < 500) {
      logger.warn({ err }, "client error");
      res.status(status).json({ ok: false, error: { code: "BAD_REQUEST", message: "Invalid request" } });
      return;
    }

    logger.error({ err }, "unhandled error");
    res
      .status(500)
      .json({ ok: false, error: { code: "INTERNAL_ERROR", message: "Internal server error" } });
  });

  return app;
}
