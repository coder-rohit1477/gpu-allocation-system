import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";

const TELEMETRY_TOKEN_HEADER = "x-telemetry-token";

/**
 * Guards node-agent telemetry ingestion. Deliberately independent of Phase
 * 3's cookie/JWT `authenticate` middleware: node agents are machines with
 * no browser session, so they can't present a user access-token cookie.
 * This is new, additive infrastructure for a new module — not a
 * modification of the existing user-authentication system.
 *
 * A shared secret is a minimal baseline, not a substitute for the
 * per-node mTLS credentials a production telemetry pipeline should
 * eventually use (see ARCHITECTURE_AUDIT_AND_REDESIGN.md's "Health &
 * Telemetry" module) — flagged here rather than silently left unguarded.
 */
export function requireTelemetryToken(req: Request, res: Response, next: NextFunction): void {
  const token = req.header(TELEMETRY_TOKEN_HEADER);

  if (!token || token !== env.telemetry.ingestToken) {
    res
      .status(401)
      .json({ ok: false, error: { code: "UNAUTHORIZED", message: "Invalid or missing telemetry token" } });
    return;
  }

  next();
}
