import { HebrewCalendar, 
         Location,
         Event as HebcalEvent,
         ParshaEvent,
         HDate,
         parshaYear, 
         HolidayEvent} from '@hebcal/core'

import { LinkedList } from "./linkedList.mjs";
import { Readers } from "./readers.mjs"
import { Parsha } from "./parsha.mjs"

export class Schedule {
    /* Builds link list or parshot scheduled throughout the Parsha Year. All 54 
     * parshot and Holiday readings.
     *
     * hebYear: int repersening the year of the Hebrew calendar 
     * a: integer repersenting amount of aliyot (3, 5, or 7) - before maftir and haftarah
     * il: boolean repersenting if the schedule should follow the diasporic cycle (false) or 
     * the Israeli cycle (true), matching HebCal's logic ** @default: FALSE
     * cal: a placeholder where a calendar of all Shabbatot and Yontifs will be stored */
    constructor(hebYear, a) {
        this.hebYear = hebYear;
        this.a = a;
        this.il = false; 
        this.cal = this.getCalendar();
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

    /* Returns year of triennail cycle (1, 2, or 3 for the first...third year of a 
     * triennial Torah reading cycle)
     * @returns integer repersenting first...third year of triennial cycle */
    calculateTriennial() {
        return (this.hebYear % 3) + 1
    }

    /* Helper function that fetches Hebrew calendar including weekly Torah readings
     * @returns Event Array accordingly */
    getRawCalendar() {
        let rawCal = HebrewCalendar.calendar({
            sedrot: true
        })
        return rawCal;
    }

    /* Filters and assigns readings based on Shabbat and Yontif conflicts
     * Uses getRawCalendar() method as a helper function */
    resolveCalendar() {
        let rawCal = this.getRawCalendar();

        // Arrays of classified events by event 'type'
        let sedrot = [];
        let yontifs = [];

        // Classification 
        for (let i = 0; i < rawCal.length; i++) {
            let event = rawCal[i];

            if (event instanceof ParshaEvent) {
                sedrot.push(event);
            } else if (event instanceof HolidayEvent) {
                yontifs.push(event);
            }
        }

        /* Filter by Date
         * Resolves conflicts between Yontifs and Shabbos */
        let byDate = {};

        // Sedrot
        for (let i = 0; i < sedrot.length; i++) {
            let dateKey = sedrot[i].getDate().greg().toISOString().slice(0, 10);

            if (!byDate[dateKey]) {
                byDate[dateKey] = {sedra: null, holiday: null};
            }

            byDate[dateKey].sedra = sedrot[i];
        }

        // Yontifs
        for (let i = 0; i < yontifs.length; i++) {
            let dateKey = yontifs[i].getDate().greg().toISOString().slice(0, 10);

            if (!byDate[dateKey]) {
                byDate[dateKey] = {sedra: null, holiday: null};
            }

            byDate[dateKey].holiday = yontifs[i];
        }

        // Conflict Resolution
        for (let date in byDate) {
            let day = byDate[date];

            let finalReading = null;

            // A Yontif will always trump a regular reading
            if (day.holiday) {
                finalReading = day.holiday;
            } else if (day.sedra) {
                finalReading = day.sedra;
            }

            this.cal.push({
                date: date,
                reading: finalReading
            })
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