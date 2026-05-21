import { HebrewCalendar, 
         Location,
         Event as HebcalEvent,
         ParshaEvent,
         HDate,
         parshaYear } from '@hebcal/core'

import { LinkedList } from "./linkedList.js";
import { Readers } from "./readers.js"
import { Parsha } from "./parsha.js"

export class Schedule {
    /* Builds link list or parshot scheduled throughout the Parsha Year. All 54 
     * parshot.
     *
     * hebYear: int repersening the year of the Hebrew calendar 
     * a: integer repersenting amount of aliyot (3, 5, or 7) - before maftir and haftarah
     * il: boolean repersenting if the schedule should follow the diasporic cycle (false) or 
     * the Israeli cycle (true), matching HebCal's logic ** @default: FALSE*/
    constructor(hebYear, a) {
        this.hebYear = hebYear;
        this.a = a;
        this.il = false; 
        this.activeSchedule = this.createSchedule();
    }

    /* Toggles state of IL field, which is false by default.
     * The first time this method is called, IL will be set true.
     * The second time thid ethod is called, IL will reset to false. Etc. */
    toggleIL() {
        if (this.il) {
            this.il = false;
        } else {
            this.il = true;
        }
    }

    /* Creates a schedule of parshot. Called within constructor. */
    createSchedule() {
        let parshaArr = parshaYear(this.hebYear, this.il); // @returns array of ParshaEvent
        let schedule = new LinkedList()

        for (let i = 0; i < parshaArr.length; i++) {
            schedule.append(new Parsha(parshaArr[i].getDesc().replace("Parashat ", ""), 
            this.hebYear, 
            new Readers(),
            this.il, 
            this.a));
        }

        return schedule;
    }

    /* Formats and prints an instance of schedule. Using methods of imported
    classes, loops through linked list of parshot (schedule) and prints parsha
    name, Hebrew date, Gregorian date, and readers for all aliyot, maftir, and
    haftarah */
    printSchedule() {
        let current = this.activeSchedule.head;
        while (current) {
            current.value.printParsha();
            console.log ("\n\n");
            current = current.next;
        } 
    }
    

}