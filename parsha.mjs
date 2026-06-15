import { Sedra, 
         Event as HebcalEvent } from '@hebcal/core'

// Update class to find settings from settings class, not fields

export class Parsha {
    /* Repersents a parsha as organized in a schedule linked list
     *
     * @field info: uses data from HebCal library to identify and document parsha
     * @field readers: repersents readers of each reading of parsha (aliyot 1-7, maftir,
     * haftarah) 
     * @field occassion: repersents when parsha will be read (shabbat, specific yontif) */
    constructor(settings, name, hebYear, readers, a, occassion) {
        this.settings = settings;
        this.triennial = this.settings.getFullTriennial();
        this.il = this.settings.getIL();
        this.name = name;
        this.hebYear = hebYear;
        this.readers = readers;
        this.a = a;
        this.occassion = occassion;
        this.hebDate = null;
        this.gregDate = null;
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
    getParshaData() {
        return {
            name: this.name,
            aliyotCount: this.a,
            occassion: this.occassion,
            hebDate: this.hebDate,
            gregDate: this.gregDate,
            readers: this.readers.getReadersData()
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
        this.readers.printReaders(this.a);
    }
}