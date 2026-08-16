import { Router, type Router as ExpressRouter } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import {
  loginHandler,
  logoutAllHandler,
  logoutHandler,
  meHandler,
  refreshHandler,
} from "./auth.controller.js";

const router: ExpressRouter = Router();

router.post("/login", asyncHandler(loginHandler));
router.post("/refresh", asyncHandler(refreshHandler));
router.post("/logout", asyncHandler(logoutHandler));
router.post("/logout-all", authenticate, asyncHandler(logoutAllHandler));
router.get("/me", authenticate, asyncHandler(meHandler));

export default router;
