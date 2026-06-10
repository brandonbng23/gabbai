import { Schedule } from "./schedule.mjs"
import { Triennial } from "./triennial.mjs"
import { Shul } from "./shul.mjs"
import { Settings } from "./settings.mjs"

function main() {
    let triennial = new Triennial(false, false, false, false);
    let schedule = new Schedule(5786, 3, false, false, triennial);
    let shul = new Shul("Test Shul", [], [], schedule);
    shul.getSchedule().printSchedule();
}

main();