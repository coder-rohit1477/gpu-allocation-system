import { Router, type Router as ExpressRouter } from "express";
import { controllerHandler } from "../../common/http.js";
import { requireTelemetryToken } from "./requireTelemetryToken.js";
import { heartbeatHandler, metricsHandler } from "./telemetry.controller.js";

const router: ExpressRouter = Router();

// Node-agent ingestion — guarded by a shared secret, not a user session.
// See requireTelemetryToken.ts.
router.use(requireTelemetryToken);

router.post("/heartbeat", controllerHandler(heartbeatHandler));
router.post("/metrics", controllerHandler(metricsHandler));

export default router;
