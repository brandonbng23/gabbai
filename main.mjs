import { Schedule } from "./schedule.mjs"
import { Triennial } from "./triennial.mjs"

function main() {
    let schedule = new Schedule(5786, 7, {triennial: false, 
                                          triennialMaftir: false, 
                                          applyToYitro: false});
    schedule.printSchedule();
}

main();