import type { AuthenticatedUser } from "../modules/auth/types.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export {};
