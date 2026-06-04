import { Sedra, 
    HDate, 
    Event as HebcalEvent } from '@hebcal/core'

import { Readers } from "./readers.mjs"
import { Triennial } from "./triennial.mjs"

export class Parsha {
    /* Repersents a parsha as organized in a schedule linked list
     *
     * @field info: uses data from HebCal library to identify and document parsha
     * @field readers: repersents readers of each reading of parsha (aliyot 1-7, maftir,
     * haftarah) 
     * @field occassion: repersents when parsha will be read (shabbat, specific yontif) */
    constructor(name, hebYear, readers, il, a, occassion, triennial) {
        this.name = name;
        this.hebYear = hebYear;
        this.il = il;
        this.readers = readers;
        this.a = a;
        this.occassion = occassion;
        this.triennial = this.triennial;
        this.hebDate = null;
        this.gregDate = null;
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

    /* Formats and prints an instance on Parsha
     * Parsha name, Hebrew date, Gregorian date, all readers for argued
     * aliyot */
    printParsha() {
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
            console.log("\n                   " + this.name + "  (woof!)"); // Phineas!
        }
        console.log ("_______________________________________________________________________________________\n");

        console.log(this.hebDate + "   " + this.gregDate + "\n");
        console.log(this.readers.printReaders(this.a));
    }
}