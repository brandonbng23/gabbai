import { Settings } from "./backend/settings.mjs"
import { Schedule } from "./backend/schedule.mjs"
import { Shul } from "./backend/shul.mjs"

function main() {
    let settings = new Settings(5787);
    settings.setTriennial(true);

    let shul = new Shul("Test Shul", [], [], null, "testshul.org", "testshul.org/contribute", settings);
    
    let schedule = new Schedule(shul.getSettings(), settings.getHebYear());
    shul.setSchedule(schedule);
    
    shul.getSchedule().printSchedule();
}

main();

