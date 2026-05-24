import { User } from "./user.mjs"

export class Readers {
    /* Class repersent the weekly honors associated with the reading
     * of Torah on Shabbat. These include readers for each aliyot (1-7 but
     * can be toggled to regard the triennial), the maftir reading, and the
     * haftarah reading 
     
     * fields a1-a7: User repersenting reader of each aliyot (aliyot 1-7)
     * m: User repersent maftir reader
     * h: User repersenting haftarh reader 
     * @default All fields are set null by default. Readers will be assigned
     * when users register for an honor */
    constructor() {
        this.a1 = null; // First aliyah reader
        this.a2 = null; // Second aliyah reader
        this.a3 = null; // Third aliyah reader
        this.a4 = null; // Fourth aliyah reader
        this.a5 = null; // Fifth aliyah reader
        this.a6 = null; // Sixth aliyah reader
        this.a7 = null; // Seventh aliyah reader
        this.m = null; // Maftir reader
        this.h = null; // Haftarah reader
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

    /* Formats and prints an instance of Readers
     * All readers for a parsha reading are printed according to the argued
     * quantity of aliyot (either 3, 5, or 7). Maftir and haftarah are always
     * printed. First and last name or user registered to read is printed to
     * the right of the reading title. If available, "available" prints instead
     * @param a: integer repersenting quantity of aliyot. For ideal function,
     * int must be exactly 3, 5, or 7 */
    printReaders(a) {

        // Prints no matter quantity of aliyot argued
        if (this.a1) {
            console.log("   Aliyah 1:   " + this.a1.nameToString() + "\n");
        } else {
            console.log("   Aliyah 1:   available \n");
        }

        if (this.a2) {
            console.log("   Aliyah 2:   " + this.a2.nameToString() + "\n");
        } else {
            console.log("   Aliyah 2:   available \n");
        }

        if (this.a3) {
            console.log("   Aliyah 3:   " + this.a3.nameToString() + "\n");
        } else {
            console.log("   Aliyah 3:   availble \n");
        }

        // Prints only if 5 or 7 aliyot are argued
        if (a > 3) {
            if (this.a4) {
                console.log("   Aliyah 4:   " + this.a4.nameToString() + "\n");
            } else {
                console.log("   Aliyah 4:   available \n");
            }

            if (this.a5) {
                console.log("   Aliyah 5:   " + this.a5.nameToString() + "\n");
            } else {
                console.log("   Aliyah 5:   available \n");
            }
        }

        // Prints only if 7 aliyot are argued
        if (a > 5) {
            if (this.a6) {
                console.log("   Aliyah 6:   " + this.a6.nameToString() + "\n");
            } else {
                console.log("   Aliyah 6:   available \n");
            }

            if (this.a7) {
                console.log("   Aliyah 7:   " + this.a7.nameToString() + "\n");
            } else {
                console.log("   Aliyah 7:   available \n");
            }
        }

        // Maftir and Haftarah are always printed
        if (this.m) {
            console.log("   Maftir:     " + this.m.nameToString() + "\n");
        } else {
            console.log("   Maftir:     available \n");
        }

        if (this.h) {
            console.log("   Haftarh:   " + this.h.nameToString() + "\n");
        } else {
            console.log("   Haftarah:   available \n");
        }
    }
}