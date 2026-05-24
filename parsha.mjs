import { Sedra, 
    HDate, 
    Event as HebcalEvent } from '@hebcal/core'

import { Readers } from "./readers.mjs"

export class Parsha {
    /* Repersents a parsha as organized in a schedule linked list
     *
     * info: uses data from HebCal library to identify and document parsha
     * readers: repersents readers of each reading of parsha (aliyot 1-7, maftir,
     * haftarah) */
    constructor(name, hebYear, readers, il, a) {
        this.name = name;
        this.hebYear = hebYear;
        this.il = il;
        this.readers = readers;
        this.a = a;
    }

    /* Formats and prints an instance on Parsha
     * Parsha name, Hebrew date, Gregorian date, all readers for argued
     * aliyot */
    printParsha() {
        let hebDate = new Sedra(this.hebYear, this.il).find(this.name);
        let gregDate = null;

        if (hebDate) {
            gregDate = new HebcalEvent(hebDate, this.name).greg();
        }

        console.log ("__________________________________________________________________");
        if (this.name != "Pinchas") {
            console.log("\n               " + this.name);
        } else {
            console.log("\n               " + this.name + "  (woof!)"); // Phineas!
        }
        console.log ("__________________________________________________________________\n");


        console.log(hebDate + "   " + gregDate + "\n");
        console.log(this.readers.printReaders(this.a));
    }
}