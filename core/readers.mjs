import { Sedra } from '@hebcal/core'
import { SimpleSchedule } from "./simpleSchedule.mjs"

import fs from "fs"
import path from "path";
import { fileURLToPath } from "url";

export class Readers {
    /* Class repersent the weekly honors associated with the reading
     * of Torah on Shabbat. These include readers for each aliyot (1-7 but
     * can be toggled to regard the triennial), the maftir reading, and the
     * haftarah reading. For each reading, these verses are displayed according
     * to schedule settings
     
     * @field parsha: string repersenting name of parsha associated with reading
     * @field triennial: instance of triennail repersenting schedule triennial settings
     * @field special: string repersenting name of occassion that employs a special reading
     * @field fields a1-a7: Objects repersenting registed user and assigned verses for each aliyot (aliyot 1-7)
     * @field m: Objects repersenting registed user and assigned verses for maftir
     * @field h: Objects repersenting registed user and assigned verses for haftarah
     * @default All fields are set null by default. Readers will be assigned
     * when users register for an honor 
     * 
     * @field RO: boolean repersenting if a reading is special (true) or not (false)
     * @field hebYear: Hebrew Year when reading will take place */

    constructor(desc, settings, special, hebYear) {
        this.desc = desc;
        this.settings = settings;
        this.special = special;
        this.a1 = {user: null, verses: null};       // First aliyah reader
        this.a2 = {user: null, verses: null};       // Second aliyah reader
        this.a3 = {user: null, verses: null};       // Third aliyah reader
        this.a4 = {user: null, verses: null};       // Fourth aliyah reader
        this.a5 = {user: null, verses: null};       // Fifth aliyah reader
        this.a6 = {user: null, verses: null};       // Sixth aliyah reader
        this.a7 = {user: null, verses: null};       // Seventh aliyah reader
        this.m = {user: null, verses: null};        // Maftir reader
        this.h = {user: null, verses: null};        // Haftarah reader
        this.RO = false;                            
        this.hebYear = hebYear;
    }

    /* Accesses reader assigned to a reading
     * @param r: int 1-9 repersenting reader (1-7 => aliyot 1-7, 8 => 
     * maftir, 9 => haftarh) */
    getReader(r) {
        if (r == 1) {
            return this.a1.user;
        } else if (r == 2) {
            return this.a2.user;
        } else if (r == 3) {
            return this.a3.user;
        } else if (r == 4) {
            return this.a4.user;
        } else if (r == 5) {
            return this.a5.user;
        } else if (r == 6) {
            return this.a6.user;
        } else if (r == 7) {
            return this.a7.user;
        } else if (r == 8) { // maftir
            return this.m.user;
        } else if (r == 9) { // haftara
            return this.h.user;
        } else { // input r did not match possible options
            return;
        }
    }

    getPsukim(r) {
        if (r == 1) {
            return this.a1.verses;
        } else if (r == 2) {
            return this.a2.verses;
        } else if (r == 3) {
            return this.a3.verses;
        } else if (r == 4) {
            return this.a4.verses;
        } else if (r == 5) {
            return this.a5.verses;
        } else if (r == 6) {
            return this.a6.verses;
        } else if (r == 7) {
            return this.a7.verses;
        } else if (r == 8) {
            return this.m.verses;
        } else if (r == 9) {
            return this.h.verses;
        }
    }

    /* Mutates the reader assigned to a reading
     * @param r: int 1-9 repersenting reader (1-7 => aliyot 1-7, 8 =>
     * maftir, 9 => haftarah)
     * @param user: User repersenting reader assigned to a reading */
    setReader(r, user) {
        if (r == 1) {
            this.a1.user = user;
            user.addReading({desc: this.desc,
                             aliyah: r,
                             verses: this.a1.verses
            })
        } else if (r == 2) {
            this.a2.user = user;
            user.addReading({desc: this.desc,
                             aliyah: r,
                             verses: this.a2.verses
            })
        } else if (r == 3) {
            this.a3.user = user;
            user.addReading({desc: this.desc,
                             aliyah: r,
                             verses: this.a3.verses
            })
        } else if (r == 4) {
            this.a4.user = user;
            user.addReading({desc: this.desc,
                             aliyah: r,
                             verses: this.a4.verses
            })
        } else if (r == 5) {
            this.a5.user = user;
            user.addReading({desc: this.desc,
                             aliyah: r,
                             verses: this.a5.verses
            })
        } else if (r == 6) {
            this.a6.user = user;
            user.addReading({desc: this.desc,
                             aliyah: r,
                             verses: this.a6.verses
            })
        } else if (r == 7) {
            this.a7.user = user;
            user.addReading({desc: this.desc,
                             aliyah: r,
                             verses: this.a7.verses
            })
        } else if (r == 8) { // maftir
            this.m.user = user;
            user.addReading({desc: this.desc,
                             aliyah: r,
                             verses: this.a8.verses
            })
        } else if (r == 9) { // haftarah
            this.h.user = user;
            user.addReading({desc: this.desc,
                             aliyah: 4,
                             verses: this.a9.verses
            })
        } else { // input r did not match possible options
            return;
        }
    }

    /* Returns reader data for one reader
     * @param a: aliyot (1-9) for which data should be returned
     * @returns: object retaining all reader data */
    getReaderData(a) {
        let verses = "";

        if (!this.settings.getTriennial()) {
            verses = this.tradPsukim(a, false);
        } else {
            verses = this.triPsukim(a);
        }

        return {
            user: this.getReader(a)["user"],
            verses: verses,
            occassion: this.special
        };
    }

    /* Returns reader for data for all readers of parsha
     * @param a: number repersenting quanitity of aliyot (1-7). Maftir and haftarah readers formulated as adminstrator settings allow
     * @returns array of object retaining reader data for all argued readers */
    getReadersData(a) {
        let data = [];
        let verses = "";

        for (let i = 0; i < a+2; i++) {
            this.RO = false;

            if (!this.settings.getTriennial()) {
                verses = this.tradPsukim(i+1, false);
            } else {
                verses = this.triPsukim(i+1);
            }

            let special = this.special;

            data.push({
                aliyah: i+1,
                user: this.getReader(i+1),
                verses: verses,
                special: special
            });
        }

        return data;
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

            if (!this.settings.getTriennial()) {
                verses = this.tradPsukim(i+1, false);
            } else {
                verses = this.triPsukim(i+1);
            }

            if (i < a) {
                text = "   Aliyah " + (i+1) + "        " + verses;
            } else if (i == a && this.settings.getMaftir() != "none") {
                if (!this.settings.getTriennial() || this.settings.getMaftir() == "trad") {
                    text = "   Maftir          " + this.tradPsukim(8, false);
                } else {
                    text = "   Maftir          " + this.triPsukim(8);
                }
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
                text += this.getReader(i+1)["user"].nameToString();
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