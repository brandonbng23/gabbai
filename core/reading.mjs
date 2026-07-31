import { Aliyah } from "./aliyah.mjs";

export class Reading {
    /* Class repersenting a reading (collection of 9 aliyot including maftir and haftarah)
     * NOTE: This class is still used even when administrator settings constrict number of aliyot to be 
     * less than 7
     * 
     * @field desc: string repersenting parsha or Yontif name
     * @field settings: instance of settings repersenting administrator settings
     * @field aliyot: object of Aliyah instances (numbered 1-9) repersenting each aliyah of reading 
     * @field special: string repersenting name of occassion that requires special reading to occur 
     * @field hebYear: Hebrew year when reading will occur */
    constructor(desc, settings, special, hebYear) {
        this.desc = desc;
        this.settings = settings;
        
        if (special) {
            this.special = special;
        } else {
            this.special = "";
        }

        if (hebYear) {
            this.hebYear = hebYear;
        } else {
            this.hebYear = this.settings.getHebYear();
        }

        this.aliyot = {1: new Aliyah(this.desc, 1, null, this.settings),        // First aliyah
                       2: new Aliyah(this.desc, 2, null, this.settings),        // Second aliyah
                       3: new Aliyah(this.desc, 3, null, this.settings),        // Third aliyah
                       4: new Aliyah(this.desc, 4, null, this.settings),        // Fourth aliyah
                       5: new Aliyah(this.desc, 5, null, this.settings),        // Fifth aliyah
                       6: new Aliyah(this.desc, 6, null, this.settings),        // Sixth aliyah
                       7: new Aliyah(this.desc, 7, null, this.settings),        // Seventh aliyah
                       8: new Aliyah(this.desc, 8, null, this.settings),        // Mafitr
                       9: new Aliyah(this.desc, 9, null, this.settings)         // Haftarah
        }

        this.RO = false;
    }

    /* Accesses reader assigned to argued aliyah
     * @param a: int 1-9 repersenting aliyah (1-7: aliyah 1-7, 8: maftir, 9: haftarah)
     * @returns instance of user (if field is not null) or field default string "available" */
    getReader(a) {
        if (a == 1) {
            return this.aliyot[1].getReader();
        } else if (a == 2) {
            return this.aliyot[2].getReader();
        } else if (a == 3) {
            return this.aliyot[3].getReader();
        } else if (a == 4) {
            return this.aliyot[4].getReader();
        } else if (a == 5) {
            return this.aliyot[5].getReader();
        } else if (a == 6) {
            return this.aliyot[6].getReader();
        } else if (a == 7) {
            return this.aliyot[7].getReader();
        } else if (a == 8) {
            return this.aliyot[8].getReader();
        } else if (a == 9) {
            return this.aliyot[9].getReader();
        }
    }
}