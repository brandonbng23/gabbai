import { Schedule } from "./schedule.mjs"
import { Triennial } from "./triennial.mjs"
import { Shul } from "./shul.mjs"
import { Settings } from "./settings.mjs"

function main() {
    let triennial = new Triennial(false, false, false, false);
    let shul = new Shul("Test Shul", [], [], null);

    let schedule = new Schedule(shul.getSettings());
    shul.setSchedule(schedule);
    
    shul.getSchedule().printSchedule();
}

main();