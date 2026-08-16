import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";
import { AppError, badRequestError } from "./errors.js";

export function ok<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ ok: true, data });
}

/**
 * Express types req.params values as `string | string[]` (to accommodate
 * wildcard/repeated route segments); every route in this codebase uses
 * plain `:id`-style params, so this narrows to the single-string case a
 * handler actually expects and rejects the (here, impossible-in-practice)
 * array case explicitly rather than casting past it.
 */
export function requireParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || value.length === 0) {
    throw badRequestError(`Missing or invalid path parameter: ${name}`);
  }
  return value;
}

export function fail(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ ok: false, error: { code, message } });
}

/**
 * Combines Express-4-safe async error forwarding (see auth's asyncHandler)
 * with mapping AppError/ZodError to the standard response envelope, so
 * every admin-module controller does not need to repeat try/catch.
 */
export function controllerHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch((error: unknown) => {
      if (error instanceof AppError) {
        fail(res, error.status, error.code, error.message);
        return;
      }
      if (error instanceof ZodError) {
        fail(res, 400, "VALIDATION_ERROR", error.issues[0]?.message ?? "Invalid request");
        return;
      }
      next(error);
    });
  };
}
