import { Settings } from "../../core/settings.mjs"
import { Schedule } from "../../core/schedule.mjs"
import { Shul } from "../../core/shul.mjs"
import { SchedulePage } from "./schedule.jsx"
import ReactDOM from "react-dom/client";

const settings = new Settings();
settings.triennial(true);

const shul = new Shul("Test Shul", [], [], null, "testshul.org", "testshul.org/contribute", settings);

const schedule = new Schedule(shul.getSettings(), settings.getHebYear());
shul.setSchedule(schedule);

const data = schedule.getScheduleData();

ReactDOM.createRoot(document.getElementById("schedule-root")).render(
    <SchedulePage scheduleData={data}/>
)

