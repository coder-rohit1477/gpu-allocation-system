import { ApiError } from "../api/client.js";

/** Turns any thrown value into a user-displayable message. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}
