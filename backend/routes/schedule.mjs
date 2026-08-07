import express from "express";
import { getScheduleByIDHandler, getScheduleHandler } from "../controllers/scheduleController.mjs";

const router = express.Router();
router.get("/", getScheduleHandler);
router.get("/:id", getScheduleByIDHandler);

export default router;