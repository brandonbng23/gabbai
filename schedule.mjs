import { HebrewCalendar, 
         HDate,
         parshaYear, 
         getHolidaysOnDate} from '@hebcal/core'

import { LinkedList } from "./linkedList.mjs";
import { Readers } from "./readers.mjs"
import { Parsha } from "./parsha.mjs"
import { Settings } from "./settings.mjs"

export class Schedule {
    /* Builds link list or parshot scheduled throughout the Parsha Year. All 54 
     * parshot and Holiday readings.
     *
     * @field hebYear: int repersening the year of the Hebrew calendar 
     * @field a: integer repersenting amount of aliyot (before maftir and haftarah)
     * @field respect: boolean dictating if Yontifs will follow traditional amount of aliyot (true) or the
     * argued amount of aliyot (false; If the argued amount of aliyot is greater than the amount of aliyot for 
     * a Yontif, the traditional quantity will be respectedd)
     * @field hhRespect: boolean dictating if High Holidays will follow traditional amount of aliyot (true) or the
     * amount of aliyot argued (false; If the argued amount of aliyot is greater than the amount of aliyot for the 
     * High Holiday, the traditional quanity will be respected) - !!NOTE: High Holidays only include Rosh Hashana (all days),
     * Yom Kippur, and Simchat Torah
     * @field il: boolean repersenting if the schedule should follow the diasporic cycle (false) or 
     * the Israeli cycle (true), matching HebCal's logic ** @default: FALSE
     * @field cal: a placeholder where a calendar of all Shabbatot and Yontifs will be stored 
     * @field holidays: records if a reading is a holiday (1) or not (0), indices aligns with cal 
     * @field yontifs: an object repersenting all special Torah readings. Each override a Shabbat Torah
     * reading, but when set true, will spawn a seperate reading in the schedule when holiday  
     * does not align with Shabbat
     * @field tiennial: object repersenting triennail settings (see documentation below field initialization)
     * @field schedule: finalized linked list repersenting all readings */
    constructor(settings) {
       this.settings = settings;
        this.special = []; 
        this.cal = []; 
    }

    /* @returns an array repersenting all Yontifs set true in the Yontifs object.
     * Can be used as a helper function (see findYontif) */
    getYontifs() {
        let y = [];

        if (this.settings.getYontif("rh1")) {
            y.push("rh1");
        }

        if (this.settings.getYontif("rh2")) {
            y.push("rh2");
        }

        if (this.settings.getYontif("yk")) {
            y.push("yk");
        }

        if (this.settings.getYontif("sukkot1")) {
            y.push("sukkot1");
        }

        if (this.settings.getYontif("sukkot2")) {
            y.push("sukkot2");
        }

        if (this.settings.getYontif("sukkotSA")) {
            y.push("sukkotSA");
        }

        if (this.settings.getYontif("sukkotST")) {
            y.push("sukkotST");
        }

        if (this.settings.getYontif("pesach1")) {
            y.push("pesach1");
        }

        if (this.settings.getYontif("pesach2")) {
            y.push("pesach2");
        }

        if (this.settings.getYontif("pesach7")) {
            y.push("pesach7");
        }

        if (this.settings.getYontif("pesach8")) {
            y.push("pesach8")
        }

        if (this.settings.getYontif("shavuot1")) {
            y.push("shavuot1");
        }

        if (this.settings.getYontif("shavuot2")) {
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

    /* Helper function that fetches Hebrew calendar including weekly Torah readings
     * @returns Event Array accordingly */
    getRawCalendar() {
        let rawCal = HebrewCalendar.calendar({
            year: this.settings.getHebYear(),
            isHebrewYear: true,
            il: this.settings.getIL(),
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

    /* Calculates how many aliyot will be read according to argued settings pertaining to Shabbat
     * and Yontif readings
     * @param desc: string repersenting name of reading occassion
     * @returns integer (3-7) repersenting how many aliyot will be read, not including Maftir and Haftarah */
    calculateAliyot(desc) {
            // 5 Aliyot Yontifs
            if (["Sukkot I",
                 "Sukkot II",
                 "Shmini Atzeret",
                 "Pesach I",
                 "Pesach II",
                 "Pesach VII",
                 "Pesach VII",
                 "Shavuot I",
                 "Shavuot II"].includes(desc)) {
                if (this.settings.getYRespect()) {
                    return 5;
                } else if (this.settings.getAliyotCount() > 5) {
                    return 5;
                }
            }
            
            // Rosh Hashana (5 Aliyot High Holiday)
            if (desc.includes("Rosh Hashana")) {
                if (this.settings.getYRespect() || this.settings.getHhRespect()) {
                    return 5;
                } else if (this.settings.getAliyotCount() > 5) {
                    return 5;
                }
            }

            // Yom Kippur (6 Aliyot High Holiday)
            if (desc == "Yom Kippur") {
                if (this.settings.getYRespect() || this.settings.getHhRespect()) {
                    return 6;
                } else if (this.settings.getAliyotCount() > 6) {
                    return 6;
                }
            }
            
            // Simchat Torah (7 Aliyot High Holiday)
            if (desc == "Simchat Torah") {
                if (this.respect || this.hhRespect) {
                    return 7;
                } 
            }
                    
        return this.settings.getAliyotCount();
    }

    readingOccassion(parsha) {
        let occassions = getHolidaysOnDate(parsha.getDate());

        if (occassions) {
            for (let i = 0; i < occassions.length; i++) {
                occassions[i] = occassions[i].getDesc().toLowerCase().trim();
            }
        }

        let ROs = ["Shabbat Shuva",
                   "Shabbat Shekalim",
                   "Shabbat Zachor",
                   "Shabbat Parah",
                   "Shabbat HaChodesh",
                   "Shabbat HaGadol"];

        for (let i = 0; i < ROs.length; i++) {
            for (let j = 0; j < occassions?.length; j++) {
                if (ROs[i].toLowerCase() == occassions[j]) {
                    return ROs[i];
                }
            }
        } 

        let hasChodesh = occassions?.some(o => o.includes("rosh chodesh"));
        let hasChanukah = occassions?.some(o => o.includes("chanukah"));

        if (hasChodesh && hasChanukah) {
            return "Chanukah VII Shabbat Rosh Chodesh";
        } 

        if (hasChanukah) {
            if (parsha.getDate().greg().getDay() == 6) {
                if (occassions.some(o => o.includes("1"))) {
                    return "Chanukah I Shabbat";
                } else if (occassions.some(o => o.includes("2"))) {
                    return "Chanukah II Shabbat";
                } else if (occassions.some(o => o.includes("3"))) {
                    return "Chanukah III Shabbat";
                } else if (occassions.some(o => o.includes("4"))) {
                    return "Chanukah IV Shabbat";
                } else if (occassions.some(o => o.includes("5"))) {
                    return "Chanukah V Shabbat";
                } else if (occassions.some(o => o.includes("7"))) {
                    return "Chanukah VII Shabbat";
                } else if (occassions.some(o => o.includes("8"))) {
                    return "Chanukah VIII Shabbat";
                }
            }
        }

        if (hasChodesh && parsha.getDate().greg().getDay() == 6) {
            return "Shabbat Rosh Chodesh"
        }

        let day = parsha.getDate().greg();
        let nextDay = new Date(day.getFullYear(), day.getMonth(), day.getDate()+1);
        let hday = new HDate(nextDay);
        let nextDayOcassions = getHolidaysOnDate(hday);
        let hasMacharChodesh = nextDayOcassions?.some(o => o?.getDesc().toLowerCase().trim().includes("rosh chodesh"));

        if (hasMacharChodesh) {
            return "Shabbat Machar Chodesh"
        }

        return "";
    }

    /* Creates a simplifedc schedule of parshiyot for algorithmic use */
    createSimpleSchedule() {
        this.resolveCalendar();
        let parshaArr = parshaYear (this.settings.getHebYear(), this.settings.getIL()); // @returns array of ParshaEvent
        let parshaIndex = 0; // Only increments for non-Yontif readings
        let simpleSchedule = new LinkedList();

        for (let i = 0; i < this.cal.length; i++) {
            if (this.special[i] == 0) {
                let reading = parshaArr[parshaIndex];
                let desc = reading.getDesc().replace("Parashat ", "");

                simpleSchedule.append({desc: desc,
                                       hebYear: this.settings.getHebYear()
                                      })
            } else if (this.special[i] == 1) {
                let ev = this.cal[i];
                let desc = ev.getDesc()
                      .replace(this.settings.getHebYear(), "")
                      .replace("(CH''M", "Chol HaMoed")
                      .replace("  ", " ");
                
                if (desc.includes("Chol HaMoed")) {
                    desc = desc.replace("I", "")
                               .replace("I", "")
                               .replace("I", "")
                               .replace("V", "")
                               .replace("  ", " ")
                               .replace("  ", " ");
                }

                desc = desc.trim();

                if (ev.getDate().greg().getDay() == 6) {
                    desc = desc.replace("Chol HaMoed", "Chol HaMoed Shabbat");
                    if (!desc.includes("Shabbat")) {
                        desc += "Shabbat";
                    }

                    if (desc.includes("IS")) {
                        desc = desc.replace("IS", "I S");
                    }

                    simpleSchedule.append({desc: desc,
                                           hebYear: this.settings.getHebYear()
                                         });
                } else {
                    simpleSchedule.append({desc: desc,
                                           hebYear: this.settings.getHebYear()
                                         });
                }
                    
                }
            }

            return simpleSchedule;
        }

        

    /* Creates a schedule of parshiyot */
    createSchedule() {
        this.resolveCalendar();
        let parshaArr = parshaYear(this.settings.getHebYear(), this.settings.getIL()); // @returns array of ParshaEvent
        let parshaIndex = 0; // Only increments for non-Yontif readings
        let schedule = new LinkedList()

        for (let i = 0; i < this.cal.length; i++) {
            if (this.special[i] == 0) {
                let reading = parshaArr[parshaIndex];
                let desc = reading.getDesc().replace("Parashat ", "");

                schedule.append(new Parsha(desc, 
                this.settings.getHebYear(), 
                new Readers(desc, this.settings, this.readingOccassion(reading)),
                this.settings.getIL(), 
                this.calculateAliyot(desc),
                "Shabbat"),
                this.settings.getFullTriennial());
                parshaIndex++;
            } else if (this.special[i] == 1) {
                let ev = this.cal[i];
                let desc = ev.getDesc()
                    .replace(this.settings.getHebYear(), "")
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

                desc = desc.trim();

                if (ev.getDate().greg().getDay() == 6) {
                    desc = desc.replace("Chol HaMoed", "Chol HaMoed Shabbat");
                    if (!desc.includes("Shabbat")) {
                        desc += "Shabbat";
                    }

                    if (desc.includes("IS")) {
                        desc = desc.replace("IS", "I S");
                    }

                    let parsha = new Parsha(desc,
                                            this.settings.getHebYear(),
                                            new Readers(desc, this.settings, ""),
                                            this.settings.getIL(),
                                            this.calculateAliyot(desc),
                                            desc,
                                            this.settings.getFullTriennial()); 

                    parsha.setHebDate(ev.getDate());
                    schedule.append(parsha);
                    
                } else {
                    let parsha = new Parsha(desc, 
                                            this.settings.getHebYear(), 
                                            new Readers(desc, this.settings, ""), 
                                            this.settings.getIL(), 
                                            this.calculateAliyot(desc), 
                                            desc, 
                                            this.settings.getFullTriennial());
                    
                    parsha.setHebDate(ev.getDate());
                    schedule.append(parsha);
                }    
            } 
        }

        return schedule;
    } 

    /* Formats and prints an instance of schedule. Using methods of imported
    classes, loops through linked list of parshot (schedule) and prints parsha
    name, Hebrew date, Gregorian date, and readers for all aliyot, maftir, and
    haftarah */
    printSchedule() {
        this.settings.getFullTriennial().printTriennial();
        console.log("\n");

        let current = this.createSchedule().head;
        while (current) {
            current.value.printParsha();
            console.log ("\n\n");
            current = current.next;
        } 
    }
}