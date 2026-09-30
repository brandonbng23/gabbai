import { Settings } from "./settings.mts"
import { Schedule } from "./schedule.mts"
import { Shul } from "./shul.mts"

function main() {
    const hebYear = 5787;
    const settings = new Settings(hebYear);
    settings.setTriennial(true);

    const schedule = new Schedule(settings, hebYear);

    let shul = new Shul("Test Shul", [], [], schedule, "testshul.org", "testshul.org/contribute", settings);
    
    shul.setSchedule(schedule);
    
    shul.getSchedule().printSchedule();
}

main();

