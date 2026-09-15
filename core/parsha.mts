import { Settings } from "./settings.mts";
import { ReadingSet } from "./readingSet.mts";
import { Triennial } from "../interfaces/triennial.mts"
import { HDate, 
         Sedra, 
         Event as HebcalEvent } from '@hebcal/core';

// Update class to find settings from settings class, not fields

export class Parsha {
    /* Repersents a parsha as organized in a schedule linked list
     *
     * @field info: uses data from HebCal library to identify and document parsha
     * @field readers: repersents readers of each reading of parsha (aliyot 1-7, maftir,
     * haftarah) 
     * @field occassion: repersents when parsha will be read (shabbat, specific yontif) */

    /* @field settings: instance of Settings repersenting settings to apply to Parsha */
    settings: Settings;

    /* @field desc: string repersenting description (name) of Parsha read. When not Shabbat, this 
     * may be the reading occassion (occassion) instead */
    desc: string;
    hebYear: number;
    readingSet: ReadingSet;
    occassion: string;
    a: number;
    triennial: Triennial;
    il: boolean;
    hebDate: HDate | null = null;
    gregData: Date | null = null;

    constructor(settings: Settings, desc: string, hebYear: number, readingSet: ReadingSet, a: number, occassion: string) {
        this.settings = settings;
        this.triennial = this.settings.getFullTriennial();
        this.il = this.settings.getIL();
        this.desc = desc;
        this.hebYear = hebYear;
        this.readingSet = readingSet;
        this.a = a;
        this.occassion = occassion;
    }

    getName() {
        return this.name;
    }

    getHebYear() {
        return this.hebYear;
    }

    /* Accesses occassion field
    @returns string repersenting occassion when parsha will be read */
    getOccassion() {
        return this.occassion;
    }

    /* Mutates hebDate field
     * @param hebDate repersents an HDate to set hebDate field */
    setHebDate(hebDate) {
        this.hebDate = hebDate;
    }

    /* Returns parsha data for current parsha
     * @returns object retaining all current parsha data */
    getParshaData(id) {
        if (!this.hebYear) {
            this.hebYear = this.settings.getHebYear();
        }

        if (!this.hebDate) {
            this.hebDate = new Sedra(this.hebYear, this.il).find(this.name);
        }

        if (this.hebDate) {
            this.gregDate = new HebcalEvent(this.hebDate, this.name).greg();
        }

        return {
            id: this.hebYear + "_" + id,
            name: this.name,
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
    printParsha() {
        if (!this.hebYear) {
            this.hebYear = this.settings.getHebYear();
        }

        if (!this.hebDate) {
            this.hebDate = new Sedra(this.hebYear, this.il).find(this.name);
        }

        if (this.hebDate) {
            this.gregDate = new HebcalEvent(this.hebDate, this.name).greg();
        }

        console.log ("_______________________________________________________________________________________");
        if (this.name != "Pinchas") {
            console.log("\n                   " + this.name);
        } else {
            console.log("\n                   " + this.name + "  (woof!)");     // Phineas!
        }
        console.log ("_______________________________________________________________________________________\n");

        console.log(this.hebDate + "   " + this.gregDate + "\n");
        this.readingSet.printReadingSet(this.a);
    }
}