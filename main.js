import { HebrewCalendar, 
         Location,
         Event as HebcalEvent,
         ParshaEvent,
         HDate,
         parshaYear } from '@hebcal/core'

import { Schedule } from "./schedule.js"
import { Interface } from "./interface.js"

function main() {
    new Schedule(5786, 7).printSchedule();
    // new Interface(new Schedule(5786, 3), true);
}

main();