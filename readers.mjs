import fs from "fs"

export class Readers {
    /* Class repersent the weekly honors associated with the reading
     * of Torah on Shabbat. These include readers for each aliyot (1-7 but
     * can be toggled to regard the triennial), the maftir reading, and the
     * haftarah reading. For each reading, these verses are displayed according
     * to schedule settings
     
     * @field parsha: string repersenting name of parsha associated with reading
     * @field triennial: instance of triennail repersenting schedule triennial settings
     * @field special: string repersenting name of occassion that employs a special reading
     * @field fields a1-a7: User repersenting reader of each aliyot (aliyot 1-7)
     * @field m: User repersent maftir reader
     * @field h: User repersenting haftarh reader 
     * @default All fields are set null by default. Readers will be assigned
     * when users register for an honor */
    constructor(parsha, settings, special) {
        this.settings = settings;
        this.parsha = parsha;
        this.special = special;
        this.a1 = null; // First aliyah reader
        this.a2 = null; // Second aliyah reader
        this.a3 = null; // Third aliyah reader
        this.a4 = null; // Fourth aliyah reader
        this.a5 = null; // Fifth aliyah reader
        this.a6 = null; // Sixth aliyah reader
        this.a7 = null; // Seventh aliyah reader
        this.m = null; // Maftir reader
        this.h = null; // Haftarah reader
        this.RO = false; // Boolean repersenting if a reading is special or not
    }

    /* Accesses reader assigned to a reading
     * @param r: int 1-9 repersenting reader (1-7 => aliyot 1-7, 8 => 
     * maftir, 9 => haftarh) */
    getReader(r) {
        if (r == 1) {
            return this.a1;
        } else if (r == 2) {
            return this.a2;
        } else if (r == 3) {
            return this.a3;
        } else if (r == 4) {
            return this.a4;
        } else if (r == 5) {
            return this.a5;
        } else if (r == 6) {
            return this.a6
        } else if (r == 7) {
            return this.a7
        } else if (r == 8) { // maftir
            return this.m;
        } else if (r == 9) { // haftara
            return this.h;
        } else { // input r did not match possible options
            return;
        }
    }

    /* Mutates the reader assigned to a reading
     * @param r: int 1-9 repersenting reader (1-7 => aliyot 1-7, 8 =>
     * maftir, 9 => haftarah)
     * @param user: User repersenting reader assigned to a reading */
    setReader(r, user) {
        if (r == 1) {
            this.a1 = user;
        } else if (r == 2) {
            this.a2 = user;
        } else if (r == 3) {
            this.a3 = user;
        } else if (r == 4) {
            this.a4 = user;
        } else if (r == 5) {
            this.a5 = user;
        } else if (r == 6) {
            this.a6 = user;
        } else if (r == 7) {
            this.a7 = user;
        } else if (r == 8) { // maftir
            this.m = user;
        } else if (r == 9) { // haftarah
            this.h = user;
        } else { // input r did not match possible options
            return;
        }
    }

    /* Finds verses read for each aliyah according to schedule settings
     * @param a: int 1-9 repersenting an aliyah (1-7: aliyah 1-7, 8: maftir, 9: haftarah)
     * @param flag: boolean indicating control flow when the method is called recusively 
     * @returns: string repersenting verses to be read for argued aliyah */

    /* Returns year of triennail cycle (1, 2, or 3 for the first...third year of a 
     * triennial Torah reading cycle)
     * @returns integer repersenting first...third year of triennial cycle */
    calculateTriennial() {
        return ((this.settings.getHebYear() + 1) % 3) + 1;
    }

    tradPsukim(a, flag) {
        let sheet = fs.readFileSync("./psukim.csv", "utf8");
        let rows = sheet.split("\n");

        for (let row of rows) {
            let cells = row.split(",");

            if (!this.special?.trim() || flag) {
                    if (cells[0] == this.parsha) {
                        return cells[a]?.trim();
                    }
                } else {
                    if (cells[0].trim() == this.special) {
                        if (a == this.settings.getAliyotCount() && 
                            this.special == "Chanukah VII Shabbat Rosh Chodesh" &&
                            this.settings.getSpecialSeventh()) {
                            a = 7;
                        }

                    if (cells[a].trim() == "ref") {
                        return this.tradPsukim(a, true);
                        
                    } else {
                        this.RO = true;
                        return cells[a].trim();
                    }
                }
            }
        }
    }

    triPsukim(a) {
        let sheet = fs.readFileSync("./triennial.csv", "utf8");
        let rows = sheet.split("\n");
        let cycle = this.calculateTriennial(5786);
        let verses = "";

        if (this.parsha == "Vaetchanan" && this.settings.getVaetchanan()) {
            this.parsha = "Vaetchanan T";
        } else if (this.parsha == "Vaetchanan") {
            this.parsha = "Vaetchanan F";
        } 

        for (let row of rows) {
            let cells = row.split(",");

            if (!this.special?.trim()) {
                if (this.settings.getMaftir() == "trad" && a == 8) {
                    return this.tradPsukim(8, false);
                } else if (a == 9) {
                    return this.tradPsukim(9, false);
                } else if (this.settings.getYitro() && this.parsha == "Yitro") {
                    return this.tradPsukim(a, false);
                } 

                if (cells[0] == this.parsha) {
                    if (cycle == 1) {
                        verses = cells[a];
                    } else if (cycle == 2) {
                        verses = cells[a+8];
                    } else if (cycle == 3) {
                        verses = cells[a+16];
                    }
                } 
            } else {
                return this.tradPsukim(a, false);
            }
        }

        if (verses == "trad") {
            return this.tradPsukim(a, false);
        } else if (verses == "double") {
            return "Currently Unavailable";
        } else {
            return verses;
        }
    }
    

    /* Formats and prints an instance of Readers
     * All readers for a parsha reading are printed according to the argued
     * quantity of aliyot (either 3, 5, or 7). Maftir and haftarah are always
     * printed. First and last name or user registered to read is printed to
     * the right of the reading title. If available, "available" prints instead
     * @param a: integer repersenting quantity of aliyot. For ideal function,
     * int must be exactly 3, 5, or 7 */
    printReaders(a) {
        let text = "";

        for (let i = 0; i < a+2; i++) {
            this.RO = false;
            let verses = "";

            if (!this.settings.getFullTriennial()) {
                verses = this.tradPsukim(i+1, false);
            } else {
                verses = this.triPsukim(i+1);
            }

            if (i < a) {
                text = "   Aliyah " + (i+1) + "        " + verses;
            } else if (i == a && this.settings.getMaftir() != "none") {
                if (!this.settings.getFullTriennial() || this.settings.getMaftir() == "trad") {
                    text = "   Maftir          " + this.tradPsukim(8, false);
                }
                text = "   Maftir          " + this.triPsukim(8);
            } else if (i == a+1) {
                text = "   Haftarah        " + this.tradPsukim(9, false);
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

            if (this.getReader(a)) {
                text += this.getReader(i+1).nameToString();
            } else {
                text += "available";
            }

            console.log(text);

            if (this.RO) {
                console.log("                   **" + this.special);
            } 

            console.log("\n");
        }
    }
}