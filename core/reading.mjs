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
    }

    /* Accesses reader assigned to argued aliyah
     * @param a: int 1-9 repersenting which aliyah's reader should be accessed (1-7: aliyah 1-7, 8: maftir, 9: haftarah) 
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

    /* Mutates reader assigned to argued aliyah
     * @param a: int 1-9 repersenting whcih aliyah's reader should be mutated (1-7: aliyah 1-7, 8: maftir, 9: haftarah) */
    setReader(a) {
        if (a == 1) {
            this.aliyot[1].setReader(a);
        } else if (a == 2) {
            this.aliyot[2].setReader(a);
        } else if (a == 3) {
            this.aliyot[3].setReader(a); 
        } else if (a == 4) {
            this.aliyot[4].setReader(a);
        } else if (a == 5) {
            this.aliyot[5].setReader(a);
        } else if (a == 6) {
            this.aliyot[6].setReader(a);
        } else if (a == 7) {
            this.aliyot[7].setReader(a);
        } else if (a == 8) {
            this.aliyot[8].setReader(a);
        } else if (a == 9) {
            this.aliyot[9].setReader(a);
        }
    }

    /* Accesses psukim (chapter:verse range) read for argued aliyah
     * @param a: int 1-9 repersenting which aliyah's psukim should be accessed (1-7: aliyah 1-7, 8: maftir, 9: haftarah)
     * @returns: string repersenting psukim in a human-ready format */
    getPsukim(a) {
        if (a == 1) {
            return this.aliyot[1].figurePsukim();
        } else if (a == 2) {
            return this.aliyot[2].figurePsukim();
        } else if (a == 3) {
            return this.aliyot[3].figurePsukim();
        } else if (a == 4) {
            return this.aliyot[4].figurePsukim();
        } else if (a == 5) {
            return this.aliyot[5].figurePsukim();
        } else if (a == 6) {
            return this.aliyot[6].figurePsukim();
        } else if (a == 7) {
            return this.aliyot[7].figurePsukim();
        } else if (a == 8) {
            return this.aliyot[8].figurePsukim();
        } else if (a == 9) {
            return this.aliyot[9].figurePsukim();
        }
    }

    /* Formats and prints and instance of Reading
     * All readers for a reading are printed according to the argued quantity of
     * aliyot (int 1-7). Maftir is printed according to Maftir and Triennial subscriptions.
     * Haftarah is always printed. First and last name of user registed to aliyah is printed to
     * the right of the readin title. If no user is registered, field default string "available"
     * is printed instead.
     * @param a: int 1-7 repersenting how many aliyot should be read. Maftir is printed according
     * to administrator settings. Haftarah is always printed. 
     * NOTE: Method prints to console instead of a return */
    printReading(a) {
        let text = "";

        for (let i = 0; i < a+2; i++) {
            let verses = this.getPsukim(i);

            if (i < a) {
                test = "   Aliyah " + (i+1) + "        " + verses;
            } else if (i == a && this.settings.getMaftir() != "none") {
                text = "   Maftir          " + this.aliyot[8].getPsukim();
            } else if (i == a+1) {
                text = "   Haftarah        " + this.aliyot[9].getPsukim();
            }

            let len = text.length;

            if (text.length > 55) {
                while (text.length < 80) {
                    text += " ";
                }
            } else {
                while (text.length < 55) {
                    text += " ";
                }
            }

            text += this.aliyah(i).getReader()?.nameToString();
            console.log(text);

            console.log("\n");
            
        }

        if (this.special) {
            console.log("                   **" + this.special);
        }
    }
}