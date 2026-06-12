import { Settings } from "./settings.mjs"
import { Schedule } from "./schedule.mjs"
import { Shul } from "./shul.mjs"

function main() {
    let settings = new Settings(5787);
    settings.setTriennial(true);

    let shul = new Shul("Test Shul", [], [], null, "", "", settings);
    

    let schedule = new Schedule(shul.getSettings(), 5786);
    shul.setSchedule(schedule);
    shul.getSettings().setTriennial(true);
    
    shul.getSchedule().printSchedule();
}

main();