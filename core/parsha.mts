import { Settings } from "./settings.mts";
import { ReadingSet } from "./readingSet.mts";
import type { ParshaData } from "../interfaces/parshaData.mts"

import { HDate, 
         Sedra, 
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

    /* @field occassion: string repersenting when this parsha will be read (shabbat or specific yotnif, etc.) */
    occassion: string;

    /* @field a: number repersenting amount of aliyot (number of aliyot) to be read. Ranges from 
     * 1-7, not including Maftir and Haftarah. @default: 7 */
    a: number;

    /* @field il: boolean repersenting reading rattern. Subscribe to diasparic 
     * (false) or Israeli (true) reading pattern @default: false (diasparic) */
    il: boolean;

    /* @field hebDate: HDate repersenting the Hebrew date when this parsha will be read */
    hebDate: HDate | null = null;

    /* @field gregData: Date repersenting the Gregorian date when this parsha will be read */
    gregDate: Date | null = null;

    constructor(settings: Settings, desc: string, hebYear: number, readingSet: ReadingSet, a: number, occassion: string) {
        this.settings = settings;
        this.il = this.settings.getIL();
        this.desc = desc;
        this.hebYear = hebYear;
        this.readingSet = readingSet;
        this.a = a;
        this.occassion = occassion;
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

    /* Accesses occassion field
    @returns string repersenting occassion when parsha will be read */
    getOccassion(): string {
        return this.occassion;
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

    getSearchTerms(): string[] | void {
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
            occassion: this.getOccassion(),
            psukim: this.readingSet.getPsukimArr(),
            book: this.readingSet.getBook(),
            parshaLockStatus: this.readingSet.getLockStatus(),
            aliyotLockStatus: this.readingSet.getLockStatusArr(),
            readers: this.readingSet.getReaderArr(),
            searchTerms: this.getSearchTerms() ?? [this.desc],
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