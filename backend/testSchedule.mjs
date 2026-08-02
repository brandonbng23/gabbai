import { getSchedule } from "./services/scheduleService.mjs";
import { Settings } from "../core/settings.mjs"; 

const schedule = getSchedule(new Settings());

console.dir(schedule, {depth: null});