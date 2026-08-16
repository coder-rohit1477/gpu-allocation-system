export type AppErrorCode =
  "NOT_FOUND" | "FORBIDDEN" | "CONFLICT" | "VALIDATION_ERROR" | "BAD_REQUEST";

/** Domain-level error services throw; controllers map it to an HTTP response. */
export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFoundError(resource: string, id?: string): AppError {
  return new AppError("NOT_FOUND", `${resource}${id ? ` "${id}"` : ""} not found`, 404);
}

export function forbiddenError(
  message = "You do not have permission to perform this action",
): AppError {
  return new AppError("FORBIDDEN", message, 403);
}

export function conflictError(message: string): AppError {
  return new AppError("CONFLICT", message, 409);
}

export function badRequestError(message: string): AppError {
  return new AppError("BAD_REQUEST", message, 400);
}
