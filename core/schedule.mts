import { HebrewCalendar, 
         HDate,
         parshaYear, 
         ParshaEvent,
         getHolidaysOnDate,
         Event,
         HolidayEvent } from '@hebcal/core'
import { LinkedList } from "./linkedList.mts";
import { ReadingSet } from "./readingSet.mts"
import { Parsha } from "./parsha.mts"
import { Settings } from "./settings.mts"

export class Schedule {
    /* @class building a LinkedList (instance) of schedule parshiyot throughout a year
     * repersenting all 54 regular parshiyot and observed yontifs */

    /* @field settings: instance of Settings repersenting settings to apply to Parsha */
    settings: Settings;

    /* @field hebYear: number repersenting active Hebrew Year */
    hebYear: number;

    /* @field special: array of numbers (0 or 1) to track which calendar events are `special` or not. Elements
     * directly correspond to elements of this.cal array */
    special: number[] = [];

    /* @field cal: array of Events (HebCal) creating a calendar of all events */
    cal: Event[] = [];

    /* @field Schedule: instance of LinkedList to create a schedule of all instances of Parsha */
    schedule: LinkedList;

    constructor(settings: Settings, hebYear: number) {
        this.settings = settings;
        
        if (hebYear) {
            this.hebYear = hebYear;
        } else {
            if (settings) {
                this.hebYear = this.settings.getHebYear();
            } else {
                this.hebYear = 1;   // Will formulate for year 1 (marked as such year) and be obviously unintuitive
            }
        }

        this.schedule = this.createSchedule();
    }

    /* @returns an array repersenting all Yontifs set true in the Yontifs object.
     * Can be used as a helper function (see findYontif) */
    getYontifs(): string[] {
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
    findYontif(y: string): boolean {
        for (let yontif of this.getYontifs()) {
            if (y == yontif) {
                return true;
            }
        }
        return false;
    }

    /* Helper function that fetches Hebrew calendar including weekly Torah readings
     * @returns Event Array accordingly */
    getRawCalendar(): Event[] {
        const rawCal = HebrewCalendar.calendar({
            year: this.hebYear,
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
        const rawCal = this.getRawCalendar();

        // For viewing descriptions as provided by HebCal
        for (let ev of rawCal) {
            let desc = ev.getDesc().toLowerCase();

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
     * @returns integer (3-7) repersenting how many aliyot will be read, not including maftir and haftarah */
    calculateAliyot(desc: string): number {
            // 5 Aliyot Yontifs
            if (["Sukkot I",
                 "Sukkot II",
                 "Shmini Atzeret",
                 "Pesach I",
                 "Pesach II",
                 "Pesach VII",
                 "Pesach VIII",
                 "Shavuot I",
                 "Shavuot II"].includes(desc) && !desc.includes("Shabbat")) {
                if (this.settings.getYRespect()) {
                    return 5;
                } else if (this.settings.getAliyotCount() > 5) {
                    return 5;
                } 

            // 5 Aliyot Yontif Shabbat (excluding Rosh Hashana)
            } else if (desc.includes("Shabbat") &&
                !(desc.includes("Rosh Hashana") || desc.includes("Yom Kippur")) || desc.includes("Simchat Torah")) {
                
                if (this.settings.getYRespect()) {
                    return 7;
                }
            }
            
            // Rosh Hashana (5 Aliyot High Holiday)
            if (desc.includes("Rosh Hashana") && !desc.includes("Shabbat")) {
                if (this.settings.getYRespect() || this.settings.getHhRespect()) {
                    return 5;
                } else if (this.settings.getAliyotCount() > 5) {
                    return 5;
                }

            // Rosh Hashana Shabbat
            } else if (desc.includes("Rosh Hashana") && desc.includes("Shabbat")) {
                if (this.settings.getYRespect() || this.settings.getHhRespect()) {
                    return 7;
                } 
            }

            // Yom Kippur (6 Aliyot High Holiday)
            if (desc == "Yom Kippur") {
                if (this.settings.getYRespect() || this.settings.getHhRespect()) {
                    return 6;
                } else if (this.settings.getAliyotCount() > 6) {
                    return 6;
                }

            // Yom Kippur Shabbat
            } else if (desc == "Yom Kippur Shabbat") {
                if (this.settings.getYRespect() || this.settings.getHhRespect()) {
                    return 7;
                }
            }
            
            // Simchat Torah (7 Aliyot High Holiday)
            if (desc == "Simchat Torah") {
                if (this.settings.getYRespect() || this.settings.getHhRespect()) {
                    return 7;
                } 
            }
                    
        return this.settings.getAliyotCount();
    }

    readingOccassion(parsha: ParshaEvent): string {
        const tempDate: HDate | null = parsha.getDate();
        const occassionsUnRefined: HolidayEvent[] | undefined = tempDate ? getHolidaysOnDate(tempDate) : [];
        const occassions: HolidayEvent[] = occassionsUnRefined === undefined ? [] : occassionsUnRefined;

        const occassions_asStrings = occassions.map((h: HolidayEvent): string => h.getDesc().toLowerCase().trim());

        const ROs = ["Shabbat Shuva",
                   "Shabbat Shekalim",
                   "Shabbat Zachor",
                   "Shabbat Parah",
                   "Shabbat HaChodesh",
                   "Shabbat HaGadol"];

        for (let i = 0; i < ROs.length; i++) {
            for (let j = 0; j < occassions?.length; j++) {
                if (ROs[i].toLowerCase() === occassions_asStrings[j]) {
                    return ROs[i];
                }
            }
        } 

        const hasChodesh = occassions_asStrings?.some(o => o.includes("rosh chodesh"));
        const hasChanukah = occassions_asStrings?.some((o: string) => o.includes("chanukah"));

        if (hasChodesh && hasChanukah) {
            return "Chanukah VII Shabbat Rosh Chodesh";
        } 

        if (hasChanukah) {
            if (parsha.getDate().greg().getDay() === 6) {
                if (occassions_asStrings.some((o: string) => o.includes("1"))) {
                    return "Chanukah I Shabbat";
                } else if (occassions_asStrings.some((o: string) => o.includes("2"))) {
                    return "Chanukah II Shabbat";
                } else if (occassions_asStrings.some((o: string) => o.includes("3"))) {
                    return "Chanukah III Shabbat";
                } else if (occassions_asStrings.some((o: string) => o.includes("4"))) {
                    return "Chanukah IV Shabbat";
                } else if (occassions_asStrings.some((o: string) => o.includes("5"))) {
                    return "Chanukah V Shabbat";
                } else if (occassions_asStrings.some((o: string) => o.includes("7"))) {
                    return "Chanukah VII Shabbat";
                } else if (occassions_asStrings.some((o: string) => o.includes("8"))) {
                    return "Chanukah VIII Shabbat";
                }
            }
        }

        // Determines if given Shabbat is occurance of Shabbat Rosh Chodesh
        if (hasChodesh && parsha.getDate().greg().getDay() == 6) {
            return "Shabbat Rosh Chodesh";
        }

        // Determines if given Shabbat is occurance of Shabbat Machar Chodesh
        const day: Date = parsha.getDate()?.greg() ?? null;

        const nextDay: Date = new Date(day.getFullYear(), day.getMonth(), day.getDate()+1);
        const hday: HDate = new HDate(nextDay);
        const nextDayOccassion: HolidayEvent[] = getHolidaysOnDate(hday) ?? [];
        return nextDayOccassion?.some(o => o?.getDesc().toLowerCase().trim().includes("rosh chodesh")) ? "Shabbat Machar Chodesh" : "";
    }        

    /* Creates a schedule of parshiyot */
    createSchedule() {
        this.resolveCalendar();
        const parshaArr = parshaYear(this.hebYear, this.settings.getIL());    // @returns array of ParshaEvent
        const schedule = new LinkedList();
        let parshaIndex = 0;                                                  // Only increments for non-Yontif readings

        for (let i = 0; i < this.cal.length; i++) {
            if (this.special[i] == 0) {
                let reading = parshaArr[parshaIndex];
                let desc = reading.getDesc().replace("Parashat ", "");

                schedule.append(new Parsha(this.settings,
                                           desc, 
                                           this.hebYear, 
                                           new ReadingSet(desc,
                                                          this.calculateAliyot(desc),
                                                          this.settings,
                                                          this.readingOccassion(reading),
                                                          this.hebYear),
                                this.calculateAliyot(desc),
                                "Shabbat"));

                parshaIndex++;
            } else if (this.special[i] == 1) {
                let ev = this.cal[i];
                let desc = ev.getDesc()
                    .replace(this.hebYear.toString(), "")
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
                    desc = desc.replace(this.hebYear.toString(), "");
                    desc = desc.replace("Chol HaMoed", "Chol HaMoed Shabbat");
                    if (!desc.includes("Shabbat")) {
                        desc += "Shabbat";
                    }

                    if (desc.includes("IS")) {
                        desc = desc.replace("IS", "I S");
                    }

                    if (desc.includes("aS")) {
                        desc = desc.replace("aS", "a S");
                    }

                    let parsha = new Parsha(this.settings,
                                            desc,
                                            this.hebYear,
                                            new ReadingSet(desc, 
                                                        this.calculateAliyot(desc),
                                                        this.settings, 
                                                        "", 
                                                        this.hebYear),
                                            this.calculateAliyot(desc),
                                            desc);

                    parsha.setHebDate(ev.getDate());
                    schedule.append(parsha);
                    
                } else {
                    let parsha = new Parsha(this.settings,
                                            desc, 
                                            this.hebYear, 
                                            new ReadingSet(desc, 
                                                        this.calculateAliyot(desc),
                                                        this.settings, 
                                                        "", 
                                                        this.hebYear), 
                                            this.calculateAliyot(desc), 
                                            desc);

                    parsha.setHebDate(ev.getDate());
                    schedule.append(parsha);
                }    
            } 
        }

        return schedule;
    } 

    /* Returns all schedule data for parshiyot schedule
     * @returns object retaining all schedule data */
    getScheduleData() {
        let data = [];
        let counter = 1;

        let current = this.schedule.head;
        while (current) {
            let event = current.value.getParshaData(counter);

            data.push({
                id: event.id,
                name: event.name,
                aliyotCount: event.aliyotCount,
                occassion: event.occassion,
                hebDate: event.hebDate,
                gregDate: event.gregDate,
                readings: event.readingSet.getReadingSetData()
            });


            counter++;
            current = current.next;
        }

        return data;
    }

    /* Formats and prints an instance of schedule. Using methods of imported
    classes, loops through linked list of parshot (schedule) and prints parsha
    name, Hebrew date, Gregorian date, and readers for all aliyot, maftir, and
    haftarah. For console debugging. */
    printSchedule() {
        console.log("Hebrew Year: " + this.settings.getHebYear());
        this.settings.printTriennial();
        console.log("\n");

        let current = this.schedule.head;
        while (current) {
            current.value.printParsha();
            console.log ("\n\n");
            current = current.next;
        } 
    }
}