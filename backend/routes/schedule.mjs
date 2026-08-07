import express from "express";
import { getScheduleHandler } from "../controllers/scheduleController.mjs";

const router = express.Router();
router.get("/", getScheduleHandler);
export default router;