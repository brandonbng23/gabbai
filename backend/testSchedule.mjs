import { getSchedule } from "./services/scheduleService.mjs";
import { Settings } from "../core/settings.mjs"; 

const schedule = getSchedule(new Settings(5787));

console.dir(schedule, {depth: null});