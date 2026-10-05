import { Settings } from "./settings.mts";
import { ReadingSet } from "./readingSet.mts";
import type { ParshaData } from "../interfaces/parshaData.mts"

import { HDate, 
         Sedra, 
         HebrewCalendar,
         HolidayEvent,
         flags,
         Event as HebcalEvent } from '@hebcal/core';

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export class Parsha {
    /* @class repersents a parsha (or other reading) organizing in a schedule as a linked list */

    /* @field settings: instance of Settings repersenting settings to apply to Parsha */
    settings: Settings;

    /* @field desc: string repersenting description (name) of Parsha read. When not Shabbat, this 
     * may be the reading occassion (occassion) instead */
    desc: string;

    /* @field hebYear: number repersenting active Hebrew Year */
    hebYear: number;

    /* @field readingSet: instance of ReadingSet repersenting the ReadingSet belonging to this parsha */
    readingSet: ReadingSet;

    /* @field occassion: string repersenting when this parsha will be read (shabbat or specific yontif, etc.) */
    sedra: boolean;

    /* @field a: number repersenting amount of aliyot (number of aliyot) to be read. Ranges from 
     * 1-7, not including Maftir and Haftarah. @default: 7 */
    a: number;

    /* @field il: boolean repersenting reading rattern. Subscribe to diasparic 
     * (false) or Israeli (true) reading pattern @default: false (diasparic) */
    il: boolean;

    /* @field hebDate: HDate repersenting the Hebrew date when this parsha will be read. 
     * IMPORTANT: HebDate should be passed in as null if  */
    hebDate: HDate | null;

    /* @field gregData: Date repersenting the Gregorian date when this parsha will be read */
    gregDate: Date | null = null;

    constructor(settings: Settings, desc: string, hebYear: number, a: number, sedra: boolean, hebDate: HDate | null) {
        this.settings = settings;
        this.il = this.settings.getIL();
        this.desc = desc;
        this.hebYear = hebYear;
        this.a = a;
        this.sedra = sedra;
        this.hebDate = hebDate;

        this.readingSet = new ReadingSet(this.desc, this.a, this.settings, this.findOccassions(), this.hebYear)

        if (!this.gregDate && this.hebDate) {
            this.gregDate = new HebcalEvent(this.hebDate, this.desc).greg();
        }
    }

    /* Accesses description (name) of parsha 
     * @returns string repersenting description (name) of parsha */
    getDesc(): string {
        return this.desc;
    }

    getHebDate(): HDate | null {
        return this.hebDate;
    }

    /* Mutates hebDate field
     * @param hebDate repersents an HDate to set hebDate field */
    setHebDate(hebDate: HDate): void {
        this.hebDate = hebDate;
    }

    /* Accesses active Hebrew year 
     * @returns number repersenting a Hebrew Year */
    getHebYear(): number {
        return this.hebYear;
    }

    findOccassions(): string[] {
        let occassions: string [] = [];
        let shabbat: boolean = false;

        // Identifying Yontifs
        if (this.desc.toLowerCase().includes("rosh hashana")) {
            occassions = ["Rosh Hashana"];
        } else if (this.desc.toLowerCase().includes("yom kippur")) {
            occassions = ["Yom Kippur"];
        } else if (this.desc.toLowerCase().includes("sukkot")) {
            occassions = ["Sukkot"];
        } else if (this.desc.toLowerCase().includes("shmini")) {
            occassions = ["Shmini Atzeret"];
        } else if (this.desc.toLowerCase().includes("simchat")) {
            occassions = ["Simchat Torah"];
        } else if (this.desc.toLowerCase().includes("pesach")) {
            occassions = ["Pesach"];
        } else if (this.desc.toLowerCase().includes("shavuot")) {
            occassions = ["Shavuot"]
        } 

        const holidays: HolidayEvent[] = HebrewCalendar.getHolidaysForYearArray(this.hebYear, this.il);   
        
        // Identifying Rosh Chodesh
        const roshChodesh: HolidayEvent[] = holidays.filter((h: HolidayEvent) => h.hasFlag("ROSH_CHODESH"));

        for (let ev of roshChodesh) {
            if (this.hebDate?.isSameDate(ev.getDate())) {
                occassions = [...occassions, "Rosh Chodesh"];
            }
        }

        // Identifying Special Shabbatot
        const specialShabbatot = holidays.filter((h: HolidayEvent) => h.hasFlag("SPECIAL_SHABBAT"));

        for (let ev of roshChodesh) {
            if (this.hebDate?.isSameDate(ev.getDate())) {
                occassions = [...occassions, ev.getDesc()];
                shabbat = true;
            }
        }

        // Identifying Chanukah
        const chanukah = holidays.filter((h: HolidayEvent) => h.hasFlag("CHANUKAH_CANDLES"));

        for (let ev of chanukah) {
            if (this.hebDate?.isSameDate(ev.getDate())) {
                occassions = [...occassions, ev.getDesc()];
            }
        }
 
        if (this.gregDate?.getDay() === 6 && !shabbat) {
            shabbat = true;
            occassions = [...occassions, "Shabbat"];
        }

        return occassions;
    }

    formatGregDateString(date: Date): string {
        const month = String(date.getMonth()+1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const year = String(date.getFullYear());

        return `${year}-${month}-${day}`
    }

    formatGregDateViewString(date: Date): string {
        const month = String(date.getMonth()).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const year = String(date.getFullYear());

        return `${
            +month === 0 ? "January" :
            (+month === 1 ? "February" :
                (+month === 2 ? "March" :
                    (+month === 3 ? "April" :
                        (+month === 4 ? "May" :
                            (+month === 5 ? "June" :
                                (+month === 6 ? "July" :
                                    (+month === 7 ? "August" :
                                        (+month === 8 ? "September" :
                                            (+month === 9 ? "October" :
                                                (+month === 10 ? "November" : "December")
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        } ${day}, ${year}`
    }

    formatHebDateViewString(date: HDate): string {
        const day = String(date.getDate());
        const month = String(date.getMonthName());
        const year = String(date.getFullYear());

        return `${day} ${month} ${year}`
    }

    getSearchTerms(): string[] {
        let __filename = fileURLToPath(import.meta.url);
        let __dirname = path.dirname(__filename)
        let csvPath = path.join(__dirname, "../data", "search_terms.csv")

        let sheet = fs.readFileSync(csvPath, "utf8");
        let rows = sheet.split(/\r?\n/);

        for (let row of rows) {
            let cells: string[] = row.split(", ").map((cell: string): string => cell.trim());
            
            if (cells[0].toLowerCase() === this.desc.toLowerCase() || this.desc.toLowerCase().includes(cells[0].toLowerCase())) {
                return cells;
            }
        }

        return [this.desc]
    }

    /* Returns parsha data for current parsha
     * @returns object retaining all current parsha data */
    getParshaData(id: number): ParshaData {
        if (!this.hebYear) {
            this.hebYear = this.settings.getHebYear();
        }

        if (!this.hebDate) {
            this.hebDate = new Sedra(this.hebYear, this.il).find(this.desc);
        }

        if (this.hebDate) {
            this.gregDate = new HebcalEvent(this.hebDate, this.desc).greg();
        }

        return {
            id: id,
            hDate: this.formatHebDateViewString(this.hebDate ?? new HDate()),
            gregDate: this.formatGregDateViewString(this.gregDate ?? new Date()),
            desc: this.desc,
            occassions: this.findOccassions(),
            psukim: this.readingSet.getPsukimArr(),
            book: this.readingSet.getBook(),
            parshaLockStatus: this.readingSet.getLockStatus(),
            aliyotLockStatus: this.readingSet.getLockStatusArr(),
            readers: this.readingSet.getReaderArr(),
            searchTerms: [...this.getSearchTerms(), ...this.findOccassions()],
            dateString: this.formatGregDateString(this.gregDate ?? new Date())
        };
    }

    /* Formats and prints an instance on Parsha
     * Parsha name, Hebrew date, Gregorian date, all readers for argued
     * aliyot */
    printParsha(): void {
        if (!this.hebYear) {
            this.hebYear = this.settings.getHebYear();
        }

        if (!this.hebDate) {
            this.hebDate = new Sedra(this.hebYear, this.il).find(this.desc);
        }

        if (this.hebDate) {
            this.gregDate = new HebcalEvent(this.hebDate, this.desc).greg();
        }

        console.log ("_______________________________________________________________________________________");
        if (this.desc != "Pinchas") {
            console.log("\n                   " + this.desc);
        } else {
            console.log("\n                   " + this.desc + "  (woof!)");     // Phineas!
        }
        console.log ("_______________________________________________________________________________________\n");

        console.log(this.hebDate + "   " + this.gregDate + "\n");
        this.readingSet.printReadingSet(this.a);
    }
}