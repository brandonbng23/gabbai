import { Schedule } from "./schedule.mjs"
import { Shul } from "./shul.mjs"

function main() {
    let shul = new Shul("Test Shul", [], [], null);

    let schedule = new Schedule(shul.getSettings());
    shul.setSchedule(schedule);
    
    shul.getSchedule().printSchedule();
}

main();