import { Schedule } from "./schedule.mjs"

function main() {
    let schedule = new Schedule(5786, 7, {triennial: false, 
                                          triennialMaftir: false, 
                                          applyToYitro: false});
    schedule.printSchedule();
}

main();