import { HebrewCalendar, 
         Location,
         Event as HebcalEvent,
         ParshaEvent,
         HDate,
         parshaYear } from '@hebcal/core'

import { Schedule } from "./schedule.mjs"

function main() {
    new Schedule(5786, 7).printSchedule();
}

main();