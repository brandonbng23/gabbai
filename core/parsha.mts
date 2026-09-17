import { Settings } from "./settings.mts";
import { ReadingSet } from "./readingSet.mts";
import { HDate, 
         Sedra, 
         Event as HebcalEvent } from '@hebcal/core';

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

    /* Returns parsha data for current parsha
     * @returns object retaining all current parsha data */
    getParshaData(id: number) {
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
            id: this.hebYear + "_" + id,
            name: this.desc,
            aliyotCount: this.a,
            occassion: this.occassion,
            hebDate: this.hebDate,
            gregDate: this.gregDate,
            aliyot: this.readingSet,
            readingSet: this.readingSet
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