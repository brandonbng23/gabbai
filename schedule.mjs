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
import { Triennial } from "./triennial.mjs"

export class Schedule {
    /* Builds link list or parshot scheduled throughout the Parsha Year. All 54 
     * parshot and Holiday readings.
     *
     * @field hebYear: int repersening the year of the Hebrew calendar 
     * @field a: integer repersenting amount of aliyot (3, 5, or 7) - before maftir and haftarah
     * @field il: boolean repersenting if the schedule should follow the diasporic cycle (false) or 
     * the Israeli cycle (true), matching HebCal's logic ** @default: FALSE
     * @field cal: a placeholder where a calendar of all Shabbatot and Yontifs will be stored 
     * @field holidays: records if a reading is a holiday (1) or not (0), indices aligns with cal 
     * @field yontifs: an object repersenting all special Torah readings. Each override a Shabbat Torah
     * reading, but when set true, will spawn a seperate reading in the schedule when holiday  
     * does not align with Shabbat
     * @field tiennial: object repersenting triennail settings (see documentation below field initialization)
     * @field schedule: finalized linked list repersenting all readings */
    constructor(hebYear, a, triennial) {
        this.hebYear = hebYear;
        this.a = a;
        this.il = false; 
        this.cal = []; 
        this.special = []; 
        this.yontifs = {"rh1": false,               // Rosh Hashanah Day 1
                        "rh2": false,               // Rosh Hashanah Day 2
                        "yk": false,                // Yom Kippur
                        "sukkot1": false,           // Sukkot Day 1
                        "sukkot2": false,           // Sukkot Day 2
                        "sukkotSA": false,          // Shemini Atzeret
                        "sukkotST": false,          // Simchat Torah
                        "pesach1": false,           // Pesach Day 1
                        "pesach2": false,           // Pesach Day 2
                        "pesach7": false,           // Pesach Day 7
                        "pesach8": false,           // Pesach Day 8
                        "shavuot1": false,          // Shavuot Day 1
                        "shavuot2": false           // Shavuot Day 2
                    };
        this.triennial = triennial;

        // For testing
        this.toggleAllYontifs();

        // For contstructing
        this.resolveCalendar();
        this.activeSchedule = this.createSchedule();
    }

    /* Toggles state of IL field, which is false by default.
     * The first time this method is called, IL will be set true.
     * The second time thid ethod is called, IL will reset to false. Etc. */
    toggleIL() {
        this.il = !this.il;
    }

    /* Toggles state of each yontif as stored in the Yontifs field (an object). By
     * default, each yontif is set as false. See constructor for full yontif key codes.
     * @param y: string repersenting the name of a Yontif reading */
    toggleYontif(y) {
        if (y == "rh1") {
            this.yontifs["rh1"] = !this.yontifs["rh1"];
        } else if (y == "rh2") {
            this.yontifs["rh2"] = !this.yontifs["rh2"];
        } else if (y == "yk") {
            this.yontifs["yk"] = !this.yontifs["yk"];
        } else if (y == "sukkot1") {
            this.yontifs["sukkot1"] = !this.yontifs["sukkot1"];
        } else if (y == "sukkot2") {
            this.yontifs["sukkot2"] = !this.yontifs["sukkot2"];
        } else if (y == "sukkotSA") {
            this.yontifs["sukkotSA"] = !this.yontifs["sukkotSA"];
        } else if (y == "sukkotST") {
            this.yontifs["sukkotST"] = !this.yontifs["sukkotST"];
        } else if (y == "pesach1") {
            this.yontifs["pesach1"] = !this.yontifs["pesach1"];
        } else if (y == "pesach2") {
            this.yontifs["pesach2"] = !this.yontifs["pesach2"];
        } else if (y == "pesach7") {
            this.yontifs["pesach7"] = !this.yontifs["pesach7"];
        } else if (y == "pesach8") {
            this.yontifs["pesach8"] = !this.yontifs["pesach8"];
        } else if (y == "shavuot1") {
            this.yontifs["shavuot1"] = !this.yontifs["shavuot1"];
        } else if (y == "shavuot2") {
            this.yontifs["shavuot2"] = !this.yontifs["shavuot2"];
        }
    }

    /* For testing. Toggles all yontifs to the opposing state from their current state */
    toggleAllYontifs() {
        let yontifs = ["rh1", 
                   "rh2", 
                   "yk", 
                   "sukkot1", 
                   "sukkot2",  
                   "sukkotSA",
                   "sukkotST",
                   "pesach1",
                   "pesach2",
                   "pesach7",
                   "pesach8",
                   "shavuot1",
                   "shavuot2"];
        
        for (let y of yontifs) {
            this.toggleYontif(y);
        }
    }

    /* @returns an array repersenting all Yontifs set true in the Yontifs object.
     * Can be used as a helper function (see findYontif) */
    getYontifs() {
        let y = [];

        if (this.yontifs["rh1"]) {
            y.push("rh1");
        }

        if (this.yontifs["rh2"]) {
            y.push("rh2");
        }

        if (this.yontifs["yk"]) {
            y.push("yk");
        }

        if (this.yontifs["sukkot1"]) {
            y.push("sukkot1");
        }

        if (this.yontifs["sukkot2"]) {
            y.push("sukkot2");
        }

        if (this.yontifs["sukkotSA"]) {
            y.push("sukkotSA");
        }

        if (this.yontifs["sukkotST"]) {
            y.push("sukkotST");
        }

        if (this.yontifs["pesach1"]) {
            y.push("pesach1");
        }

        if (this.yontifs["pesach2"]) {
            y.push("pesach2");
        }

        if (this.yontifs["pesach7"]) {
            y.push("pesach7");
        }

        if (this.yontifs["pesach8"]) {
            y.push("pesach8")
        }

        if (this.yontifs["shavuot1"]) {
            y.push("shavuot1");
        }

        if (this.yontifs["shavuot2"]) {
            y.push("shavuot2");
        }

        return y;
    }

    /* Finds argued Yontif reading and returns if it set to true 
     * @param y: string repersenting the name of a Yontif reading
     * @returns boolean repersenting if Yontif reading is set to true (true) or not (false) */
    findYontif(y) {
        for (let yontif of this.getYontifs()) {
            if (y == yontif) {
                return true;
            }

            return false;
        }
    }

    /* Finds the Yontif name based on yontif item. For example, "Pesach Day 7":
     * "pesach7" => returns "pesach"
     * @param y: string repersenting the name of a Yontif reading
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
            year: this.hebYear,
            isHebrewYear: true,
            il: this.il,
            sedrot: true,
            noRoshChodesh: true,
            noSpecialShabbat:true,
            noMinorFast: true,
            noModern: true,
            shabbatMevarchim: false
        })
        return rawCal;
    }

    /* Filters only Shabbat readings, including Yontif when Yontif aligns with Shabbat,
     * and selected Yontifs to calendar */
    resolveCalendar() {
        let rawCal = this.getRawCalendar();

        // For viewing descriptions as provided by HebCal
        for (let ev of rawCal) {
            let desc = ev.getDesc().toLowerCase();
            
            /* if (!desc.includes("parashat")) {
                console.log(desc); 
            } */

            // Adding readings for Shabbatot to calendar
            if (desc.includes("parashat")) {
                this.cal.push(ev);
                this.special.push(0);

            // Adding readings for Yontifs on Shabbatot to calendar
            } else if (ev.getDate().greg().getDay() == 6) {
                if (desc.includes("rosh hashana") ||
                    desc.includes("yom kippur") ||
                    desc.includes("sukkot") ||
                    desc.includes("pesach") ||
                    desc.includes("shavuot")) {
                        this.cal.push(ev);
                        this.special.push(1);
                    }

            // Adding readings for selected weekday Yontifs to calendar
            } else {
                for (let y of this.getYontifs()) {
                    if (y == "rh1" && desc.includes("rosh hashana") && !desc.includes("i") && !desc.includes("e")) {
                        this.cal.push(ev);
                        this.special.push(1);
                    } else if (y == "rh2" && desc == "rosh hashana ii") {
                        this.cal.push(ev);
                        this.special.push(1);
                    } else if (y == "yk" && desc == "yom kippur") {
                        this.cal.push(ev);
                        this.special.push(1);
                    } else if (y == "sukkot1" && desc == "sukkot i") {
                        this.cal.push(ev);
                        this.special.push(1);
                    } else if (y == "sukkot2" && desc == "sukkot ii") {
                        this.cal.push(ev);
                        this.special.push(1);
                    } else if (y == "sukkotSA" && desc == "shmini atzeret") {
                        this.cal.push(ev);
                        this.special.push(1);
                    } else if (y == "sukkotST" && desc == "simchat torah") {
                        this.cal.push(ev);
                        this.special.push(1);
                    } else if (y == "pesach1" && desc == "pesach i") {
                        this.cal.push(ev);
                        this.special.push(1);
                    } else if (y == "pesach2" && desc == "pesach ii") {
                        this.cal.push(ev);
                        this.special.push(1);
                    } else if (y == "pesach7" && desc == "pesach vii") {
                        this.cal.push(ev);
                        this.special.push(1);
                    } else if (y == "pesach8" && desc == "pesach viii") {
                        this.cal.push(ev);
                        this.special.push(1);
                    } else if (y == "shavuot1" && desc == "shavuot i") {
                        this.cal.push(ev);
                        this.special.push(1);
                    } else if (y == "shavuot2" && desc == "shavuot ii") {
                        this.cal.push(ev);
                        this.special.push(1);
                    }
                }
            }
        }
    }

    /* Creates a schedule of parshot. Called within constructor. */
    createSchedule() {
        let parshaArr = parshaYear(this.hebYear, this.il); // @returns array of ParshaEvent
        let parshaIndex = 0; // Only increments for non-Yontif readings
        let schedule = new LinkedList()

        for (let i = 0; i < this.cal.length; i++) {
            if (this.special[i] == 0) {
                let desc = parshaArr[parshaIndex].getDesc().replace("Parashat ", "")
                schedule.append(new Parsha(desc, 
                this.hebYear, 
                new Readers(desc, this.triennial),
                this.il, 
                this.a,
                "Shabbat"),
                this.triennial);
                parshaIndex++;
            } else if (this.special[i] == 1) {
                let ev = this.cal[i];
                let desc = ev.getDesc()
                    .replace(this.hebYear, "")
                    .replace("(CH''M)", "Chol HaMoed")
                    .replace("  ", " ");

                if (desc.includes("Chol HaMoed")) {
                    desc = desc.replace("I", "")
                               .replace("I", "")
                               .replace("I", "")
                               .replace("V", "")
                               .replace("  ", " ")
                               .replace("  ", " ");

                }
                
                if (ev.getDate().greg().getDay() == 6) {
                    desc = desc.replace("Chol HaMoed", "Chol HaMoed Shabbat");
                }

                let parsha = new Parsha(desc,
                this.hebYear,
                new Readers(desc, this.triennial),
                this.il,
                this.a,
                desc,
                this.triennial); 

                parsha.setHebDate(ev.getDate());

                schedule.append(parsha);
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