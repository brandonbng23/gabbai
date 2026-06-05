import { Schedule } from "./schedule.mjs"
import { Triennial } from "./triennial.mjs"

function main() {
    let schedule = new Schedule(5786, 3, false, false, new Triennial(false, false, false, false));
    schedule.printSchedule();
}

main();