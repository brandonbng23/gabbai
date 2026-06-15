import { HebrewCalendar, 
         HDate,
         parshaYear, 
         getHolidaysOnDate} from '@hebcal/core'

import { Settings } from "./settings.mjs"
import { LinkedList } from "./linkedList.mjs"

export class SimpleSchedule {
    /* Builds a very simple schedule to accesses only a Parsha name and year. Exists as its own
     * class to avoid redcursion within the Schedule class.
     *
     * @field settings: instance of Settings to retain administrator's settings,
     * namely diaspara (false) or Israeli (true) settings
     * @field hebYear (optional): number repersenting the Hebrew Year for which to formulate a
     * schedule upon */
    constructor(settings, hebYear) {
        this.settings = settings;

        if (hebYear) {
            this.hebYear = hebYear;
        } else {
            if (settings) {
                this.hebYear = this.settings.getHebYear();
            } else {
                this.hebYear = 1;
            }
        }
    }

    /* Creates raw calendar of parshiyot
     * @returns array of ParshaEvents */
    getRawCalendar() {
        return HebrewCalendar.calendar({
               year: this.hebYear,
               isHebrewYear: true,
               il: this.settings.getIL(),
               sedrot: true,
               noHolidays: true,
               noSpecialShabbat: true,
               noMinorFast: true,
               noModern: true,
               shabbatMevarchim: false
        })
    }

    /* Creates a simple schedule retaining only parsha name and year 
     * @returns: LinkedList instance of Objects holding parsha name and year */
    createSimpleSchedule() {
        let rawCal = this.getRawCalendar();
        let schedule = new LinkedList();

        for (let i = 0; i < rawCal.length; i++) {
            schedule.append({desc: rawCal[i]
                                   .getDesc()
                                   .toLowerCase(),
                             hebYear: this.hebYear
                        });
        }

        return schedule;
    }
}