import { Settings } from "./settings.mts"
import { Aliyah } from "./aliyah.mts";
import { User } from "./user.mts";

export class ReadingSet {
    /* @class repersenting a set of readings - a collection of all 7 aliyot, maftir, and haftarah.
     * THis class will still be used even when less than 7 aliyot will be read */

    /* @field desc: string repersenting parsha or yontif name */
    desc: string;

    /* @field a: number of aliyot that will be read as part of this ReadingSet */
    a: number;

    /* @field settings: instance of Settings repersenting active administrator settings */
    settings: Settings;

    /* @field special: string repersenting name of occassion that requires special reading to occur */
    occassions: string[];

    /* @field hebYear: number repersenting active Hebrew Year */
    hebYear: number;

    /* @field aliyot: array of Aliyah instances repersenting all aliyot to be part of this ReadingSet */
    aliyot: Aliyah[];

    /* @field locked: boolean repersenting if this assignments for aliot within this reading set can be
     * edited by a (general) user (false) or not (true) */
    locked: boolean;

    constructor(desc: string, a: number, settings: Settings, occassions: string[], hebYear: number) {
        this.desc = desc;
        this.a = a;
        this.settings = settings;
        
        if (occassions) {
            this.occassions = occassions;
        } else {
            this.occassions = ["Shabbat"];
        }

        if (hebYear) {
            this.hebYear = hebYear;
        } else {
            this.hebYear = this.settings.getHebYear();
        }

        this.aliyot = [
                        new Aliyah(this.desc, 1, null, this.settings),
                        new Aliyah(this.desc, 2, null, this.settings),
                        new Aliyah(this.desc, 3, null, this.settings),
                        new Aliyah(this.desc, 4, null, this.settings),
                        new Aliyah(this.desc, 5, null, this.settings),
                        new Aliyah(this.desc, 6, null, this.settings),
                        new Aliyah(this.desc, 7, null, this.settings),
                        new Aliyah(this.desc, 8, null, this.settings),
                        new Aliyah(this.desc, 9, null, this.settings)        
        ]

        this.locked = false;
    }

    /* Sets locked status of entire ReadingSet as true. Flags individual readings to 
     * show as locked while preserving their original status */
    lock(): void {
        for (let aliyah of this.aliyot) {
            aliyah.flag();
        }

        this.locked = true;
    }

    /* Sets locked status of entire ReadingSet as false */
    unlock(): void {
        for (let aliyah of this.aliyot) {
            aliyah.unflag();
        }

        this.locked = false;
    }

    /* Returns boolean repersenting if reading set is locked (true) or not (false) */
    getLockStatus(): boolean {
        return this.locked;
    }

    /* Returns array of booleans repersenting if each aliyah is locked (true) or not (false) */
    getLockStatusArr(): boolean[] {
        return this.aliyot.map((a: Aliyah): boolean => a.getLockStatus());
    }

    /* Accesses reader assigned to argued aliyah
     * @param a: int 1-9 repersenting which aliyah's reader should be accessed (1-7: aliyah 1-7, 8: maftir, 9: haftarah) 
     * @returns instance of user (if field is not null) or field default string "available" */
    getReader(a: number): User | null {
        return this.aliyot[a-1].getReader();
    }

    /* Returns array of each aliyah's reader as a string */
    getReaderArr(): string[] {
        return this.aliyot.map((a: Aliyah): string => a.getReader()?.nameToString() ?? "");
    }

    /* Assigns (mutates) a reader to argued aliyah
     * @param a: int 1-9 repersenting which aliyah's reader should be mutated (1-7: aliyah 1-7, 8: maftir, 9: haftarah) */
    setReader(a: number, u: User): void {
        this.aliyot[a-1].setReader(u);
    }

    /* Removes (mutates) a reader from argued aliyah
     * @param a: int 1-9 repersenting which aliyah's reader should be removed (1-7: aliyah, 8: maftir, 9: haftarah) */
    removeReader(a: number): void {
        this.aliyot[a-1].removeReader();
    }

    /* Accesses psukim (chapter:verse range) read for argued aliyah
     * @param a: int 1-9 repersenting which aliyah's psukim should be accessed (1-7: aliyah 1-7, 8: maftir, 9: haftarah)
     * @returns: string repersenting psukim in a human-readable format */
    getPsukim(a: number): string {
        return this.aliyot[a-1]?.figurePsukim();
    }

    /* Maps and returns array of psukim (chapter:verse range) for all aliyot in reading set
     * @returns: array of strings repersenting psukim each in a human-readable format */
    getPsukimArr(): string[] {
        return this.aliyot.map((a: Aliyah): string => a.figurePsukim());
    }

    /* Returns book of Torah of parsha. If reading set contains aliyot from multiple books of Torah
     * and occassion is not Shabbat, 'Yontif' is returned instead */
    getBook(): string {
        const firstVerse: string = this.getPsukim(1);
        const psukim: string[] = this.getPsukimArr();

        const firstBook: string = firstVerse.includes("Genesis") ? "Genesis"
        : (firstVerse.includes("Exodus") ? "Exodus"
            : (firstVerse.includes("Leviticus") ? "Leviticus"
                : (firstVerse.includes("Numbers") ? "Numbers"
                    : "Deuteronomy")));

        for (let i = 0; i < psukim.length - 1; i++) {
            if (!psukim[i].includes(firstBook)) {
                  if (this.occassions.every((o: string) => !o.toLowerCase().includes("chanukah"))) {
                    return "Yontifs";
                }
            }
        }

        return firstBook;
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
    printReadingSet(a: number): void {
        let text = "";

        for (let i = 0; i < a+2; i++) {
            let verses = this.getPsukim(i+1);

            if (i < a) {
                text = "   Aliyah " + (i+1) + "        " + verses;
            } else if (i == a && this.settings.getMaftir() != "none") {
                text = "   Maftir          " + this.getPsukim(8);
            } else if (i == a+1) {
                text = "   Haftarah        " + this.getPsukim(9);
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

            if (this.getReader(i+1)) {
                text += this.getReader(i+1)?.nameToString() ?? "Available";
            } else {
                text += "available";
            }

            console.log(text);

            console.log("\n");
            
        }

        if (this.occassions) {
            this.occassions.map((o: string) => console.log("\n                   **" + o));
        }
    }
}