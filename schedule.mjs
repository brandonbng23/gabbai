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
     * cal: a placeholder where a calendar of all Shabbatot and Yontifs will be stored 
     * holidays: records if a reading is a holiday (1) or not (0), indices aligns with cal 
     * yontifs: a map repersenting all special Torah readings. Each override a Shabbat Torah
     *      reading, but when set true, will spawn a seperate reading in the schedule when holiday  
     *      does not align with Shabbat
     * schedule: finalized linked list repersenting all readings */
    constructor(hebYear, a) {
        this.hebYear = hebYear;
        this.a = a;
        this.il = false; 
        this.cal = []; 
        this.holidays = []; 
        this.yontifs = {"rh1": false,           // Rosh Hashanah Day 1
                        "rh2": false,           // Rosh Hashanah Day 2
                        "yk": false,            // Yom Kippur
                        "sukkot1": false,       // Sukkot Day 1
                        "sukkot2": false,       // Sukkot Day 2
                        "sukkotCH": false,      // Chol HaMoed Sukkot Shabbat
                        "sukkotSA": false,      // Shemini Atzeret
                        "sukkotST": false,      // Simchat Torah
                        "pesach1": false,       // Pesach Day 1
                        "pesach2": false,       // Pesach Day 2
                        "pesachCH": false,      // Chol HaMoed Pesach Shabbat
                        "pesach7": false,       // Pesach Day 7
                        "pesach8": false,       // Pesach Day 8
                        "shavuot1": false,      // Shavuot Day 1
                        "shavuot2": false       // Shavuot Day 2
                    };

        this.resolveCalendar();
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

    /* Toggles state of each yontif as stored in the Yontifs field (a map). By
     * default, each yontif is set as false. See constructor for full yontif key codes.
     * y: string repersenting the name of a Yontif reading */
    toggleYontif(y) {
        if (y == "rh1") {
            this.yontifs.set("rh1", !this.yontifs.get("rh1"));
        } else if (y == "rh2") {
            this.yontifs.set("rh2", !this.yontifs.get("rh2"));
        } else if (y == "yk") {
            this.yontifs.set("yk", !this.yontifs.get("yk"));
        } else if (y == "sukkot1") {
            this.yontifs.set("sukkot1", !this.yontifs.get("sukkot1"));
        } else if (y == "sukkot2") {
            this.yontifs.set("sukkot2", !this.yontifs.get("sukkot2"));
        } else if (y == "sukkotCH") {
            this.yontifs.set("sukkotCH", !this.yontifs.get("sukkotCH"));
        } else if (y == "sukkotSA") {
            this.yontifs.set("sukkotSA", !this.yontifs.get("sukkotSA"));
        } else if (y == "sukkotST") {
            this.yontifs.set("sukkotST", !this.yontifs.get("sukkotST"));
        } else if (y == "pesach1") {
            this.yontifs.set("pesach1", !this.yontifs.get("pesach1"));
        } else if (y == "pesach2") {
            this.yontifs.set("pesach2", !this.yontifs.get("pesach2"));
        } else if (y == "pesachCH") {
            this.yontifs.set("pesachCH", !this.yontifs.get("pesachCH"));
        } else if (y == "pesach7") {
            this.yontifs.set("pesach7", !this.yontifs.get("pesach7"));
        } else if (y == "pesach8", true) {
            this.yontifs.set("pesach8", !this.yontifs.get("pesach8"));
        } else if (y == "shavuot1") {
            this.yontifs.set("shavuot1", !this.yontifs.get("shavuot1"));
        } else if (y == "shavuot2") {
            this.yontifs.set("shavuot2", !this.yontifs.get("shavuot2"));
        }
    }

    /* Finds the Yontif name based on yontif item. For example, "Pesach Day 7":
     * "pesach7" => returns "pesach"
     * y: string repersenting the name of a Yontif reading
     * @returns string repersenting Yontif name */
    getYontifName(y) {
        if (y.includes("rh")) {
            return "rh";
        } else if (y == yk) {
            return "yk";
        } else if (y.includes("sukkot")) {
            return "sukkot";
        } else if (y.includes("pesach")) {
            return "pesach";
        } else if (y.includes("shavuot")) {
            return "shavuot";
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
            sedrot: true,
            noMinorFast: true,
            noModern: true
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

        /* Map: Filter by Date
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
                this.holidays.push(1);
            } else if (day.sedra) {
                finalReading = day.sedra;
                this.holidays.push(0);
            }

            this.cal.push({
                date: date,
                reading: finalReading
            })  
        }
    }

    /* Helper function to create an array of all yontif parshot. Called with createSchedule() */

    /* Creates a schedule of parshot. Called within constructor. */
    createSchedule() {
        let parshaArr = parshaYear(this.hebYear, this.il); // @returns array of ParshaEvent
        let schedule = new LinkedList()

        for (let i = 0; i < this.cal.length; i++) {
            if (this.holidays[i] == 0) {
                schedule.append(new Parsha(parshaArr[i].getDesc().replace("Parashat ", ""), 
                this.hebYear, 
                new Readers(),
                this.il, 
                this.a,
                "Shabbat"));
            } else if (this.holidays[i] == 1) {
                schedule.append(new Parsha("",
                this.hebYear,
                new Readers(),
                this.il,
                this.a,
                "Yontif"));
            } 
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