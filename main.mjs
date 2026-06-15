import { Settings } from "./settings.mjs"
import { Schedule } from "./schedule.mjs"
import { Shul } from "./shul.mjs"

function main() {
    let settings = new Settings(5788);
    settings.setTriennial(false);

    let shul = new Shul("Test Shul", [], [], null, "", "", settings);
    

    let schedule = new Schedule(shul.getSettings(), settings.getHebYear());
    shul.setSchedule(schedule);
    shul.getSettings().setTriennial(true);
    
    shul.getSchedule().printSchedule();
}

main();