import { User } from "./user.mts";
import { Settings } from "./settings.mts";
import { SimpleSchedule } from "./simpleSchedule.mts";
import type { SimpleScheduleData } from "./simpleSchedule.mts";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export class Aliyah {
    /* @class repersenting one reading within a weekly group of readings (aliyah, maftir, or haftarah for a weekday or yontif
     * reading). Manages each aliyah to record its reader and psukim. */

    /* @field desc: string repersenting name of parsha or Yontif associated with reading */
    desc: string;

    /* @field a: number repersenting aliyah number 1-9 of reading (1-7: aliyah, 8: maftir, 9: haftarah) */
    a: number;

    /* @field psukim: string repersenting chapter and verse range encompassing reading */
    psukim: string = "";

    /* @field reader: instance of User repersenting assigned reader. Set to `null if no User is assigned */
    reader: User | null;

    /* @field settings: instance of Settings to allow class access to administrator settings */
    settings: Settings;

    /* @field locked: boolean repersenting if a user (not actively assigned to reading) can register for reading (false) or access
     * is limited to an an administrator (true) */
    locked: boolean = false;

    /* @field flagged: boolean repersenting locked status of whole reading set. If true, aliyah acts as if it is locked while preserving
     * its individual locked state */
    flagged: boolean = false;

    /* @field type: string reperenting kind of reading: aliyah, maftir, or haftarah */
    type: string;

    /* Array of strings repersenting occassions to be observed that Shabbat e.g. Shabbat, Special Shabbatot, 
     * Yontif */
    occassions: string[];

    /* RO: boolean repersenting if reading occurs on special reading occassion */
    RO: boolean = false;

    constructor(desc: string, a: number, reader: User | null, occassions: string[], settings: Settings) {
        this.desc = desc;
        this.a = a;
        this.occassions = occassions;

        if (reader) {
            this.reader = reader;
        } else {
            this.reader = null;
        }

        this.settings = settings;

        if (this.a == 8) {
            this.type = "maftir";
        } else if (this.a == 9) {
            this.type = "haftarah";
        } else {
            this.type = "aliyah";
        }

        this.psukim = this.figurePsukim();
    }

    /* Access parsha or yontif name for which the aliyah belongs to
     * @returns string repersenting parsha or yontif name */
    getDesc(): string {
        return this.desc;
    }

    /* Access parhsa or yontif description and aliyah number in a single string
     * @returns string repersenting parsha or yontif name attatched with aliyah number 1-9
     * (1-7: aliyah 1-7, 8: maftir, 9: haftarah) */
    getName(): string {
        return this.desc + this.a;
    }

    /* Accesses aliyah number
     * @returns int 1-9 repersenting aliyah (1-7: aliyah 1-7, 8: maftir, 9: haftarah) */
    getAliyahNum(): number {
        return this.a;
    }

    /* Access reader registered to aliyah reading
     * @returns if assigned: instance of user, if unassigned: returns `null */
    getReader(): User | null {
        return this.reader;
    }

    /* Accesses locked field determining if a user (not an admin or user registered) 
    for reading can register for a reading
     * @returns boolean repersenting if aliyah is locked or not */
    getLockStatus(): boolean {
        return this.locked;
    }

    /* Mutates locked field to disable most users from registering for this aliyah */
    lock(): void {
        this.locked = true;
    }

    /* Mutates locked field to enable most users to register for this aliyah */
    unlock(): void {
        this.locked = false;
    }

    /* Mutates flagged field to mark entire reading set as locked */
    flag(): void {
        this.flagged = true;
    }

    /* Mutates flagged field to mark reading set as unlocked, reverting each aliyah to its own
     * locked status */
    unflag(): void {
        this.flagged = false;
    }

    /* ??? Mutates reader field to reset to field default string "available" */
    removeReader(): void {
        this.reader?.removeReading(this);
        this.reader = null;
        this.unlock();
    }

    /* Mutates reader field to set field to argued instance of reader 
     * @param u: instance of User for which reader field is to be set to */
    setReader(u: User) {
        this.reader = u;
        u.addReading(this);
        this.lock();
    }

    /* Returns year of triennail cycle (1, 2, or 3 for the first...third year of a 
     * triennial Torah reading cycle)
     * @returns integer repersenting first...third year of triennial cycle */
    calculateTriennial(): number {
        return ((this.settings.getHebYear() + 1) % 3) + 1;
    }

    /* Finds verses read for each aliyah according to schedule settings
     * @param a: int 1-9 repersenting an aliyah (1-7: aliyah 1-7, 8: maftir, 9: haftarah)
     * @param flag: boolean indicating control flow when the method is called recusively 
     * @returns: string repersenting verses to be read for argued aliyah */
    tradPsukim(a: number, flag: boolean): string | void {

        const specialShabbat =
            this.occassions.includes("Shabbat Shuva") ? "Shabbat Shuva" :
            this.occassions.includes("Shabbat Shirah") ? "Shabbat Shirah" :
            this.occassions.includes("Shabbat Shekalim") ? "Shabbat Shekalim" :
            this.occassions.includes("Shabbat Zachor") ? "Shabbat Zachor" :
            this.occassions.includes("Shabbat Parah") ? "Shabbat Parah" :
            this.occassions.includes("Shabbat HaChodesh") ? "Shabbat HaChodesh" :
            this.occassions.includes("Shabbat HaGadol") ? "Shabbat HaGadol" :
            this.occassions.includes("Shabbat Chazon") ? "Shabbat Chazon" :
            this.occassions.includes("Shabbat Nachamu") ? "Shabbat Nachamu" :
            null;

        const readingName = flag
            ? this.desc
            : (specialShabbat ?? this.desc);

        let __filename = fileURLToPath(import.meta.url);
        let __dirname = path.dirname(__filename);
        let csvPath = path.join(__dirname, "../data", "psukim.csv");

        let sheet = fs.readFileSync(csvPath, "utf8");
        let rows = sheet.split("\n");

        for (let row of rows) {
            let cells: string[] = row.split(",");

            if (cells[0].trim() !== readingName.trim()) {
                continue;
            }

            if (
                !flag &&
                a === this.settings.getAliyotCount() &&
                this.desc === "Chanukah VII Shabbat Rosh Chodesh" &&
                this.settings.getSpecialSeventh()
            ) {
                a = 7;
            }

            const psukim = cells[a]?.trim();

            if (psukim === "ref") {
                return this.tradPsukim(a, true);
            }

            this.RO = true;
            return psukim;
        }
}

    /* Helper function finding verses for double parshiyot when subscribing to the triennial
     * @param a: int 1-9 repersenting an aliyah (1-7: aliyah, 8: maftir, 9: haftarh)
     * @returns string repersenting verses to be read for argued aliyah */
    doublePsukim(a: number): string {
        const year = this.settings.getHebYear()
        const cycle = this.calculateTriennial();
        let pattern = "no pattern found";
        let thisDouble = "";
        const doubles = ["Vayakhel-Pekudei",
                        "Tazria-Metzora",
                        "Achrei Mot-Kedoshim",
                        "Behar-Bechukotai",
                        "Chukat-Balak",
                        "Matot-Masei"
                    ];

        const schedule: SimpleScheduleData[][] = (
            cycle === 1 ? ([new SimpleSchedule(this.settings, year).createSimpleSchedule(),
                            new SimpleSchedule(this.settings, year + 1).createSimpleSchedule(),
                            new SimpleSchedule(this.settings, year + 2).createSimpleSchedule()])

            : (cycle === 2 ? ([new SimpleSchedule(this.settings, year - 1).createSimpleSchedule(),
                               new SimpleSchedule(this.settings, year).createSimpleSchedule(),
                               new SimpleSchedule(this.settings, year + 1).createSimpleSchedule()])

            : [new SimpleSchedule(this.settings, year - 2).createSimpleSchedule(),
               new SimpleSchedule(this.settings, year - 1).createSimpleSchedule(),
               new SimpleSchedule(this.settings, year).createSimpleSchedule()])
        )

        if (["Vayakhel", "Pekudei"].includes(this.desc)) {
            thisDouble = doubles[0];              //Vayakhel-Pekudei
        } else if (["Tazria", "Metzora"].includes(this.desc)) {
            thisDouble = doubles[1];             //Tazria-Metzora
        } else if (["Achrei Mot", "Kedoshim"].includes(this.desc)) {
            thisDouble = doubles[2];          //Achrei Mot-Kedoshim
        } else if (["Behar", "Bechukotai"].includes(this.desc)) {
            thisDouble = doubles[3];           //Behar-Bechukotai
        } else if (["Chukat", "Balak"].includes(this.desc)) {
            thisDouble = doubles[4];             //Chukat-Balak
        } else if (["Matot", "Masei"].includes(this.desc)) {
            thisDouble = doubles[5];             //Matot-Masei
        }
        
        let year1 = false;          // Year 1 has doubled parsha (true) or split (false)
        for (let i = 0; i < schedule[0].length; i++) {
            if (schedule[0][i]["desc"].includes(thisDouble)) {
                year1 = true;
                break;
            }
        }

        let year2 = false;          // Year 2 has doubled parsha (true) or split (false)
        for (let i = 0; i < schedule[1].length; i++) {
            if (schedule[1][i]["desc"].includes(thisDouble)) {
                year2 = true;
                break;
            }
        }

        let year3 = false;          // Year 3 had doubled parsha (true) or split (false)
        for (let i = 0; i < schedule[2].length; i++) {
            if (schedule[2][i]["desc"].includes(thisDouble)) {
                year3 = true;
                break;
            }
        }

        if (thisDouble == doubles[0]) {          //Vayakhel-Pekudei
            if (year1 && year2 && !year3) {
                pattern = "A";
            } else if (year1 && !year2 && year3) {
                pattern = "B";
            } else if (year1 && !year2 && !year3) {
                pattern = "C";
            } else if (!year1 && !year2 && year3) {
                pattern = "D";
            } else if (!year1 && year2 && !year3) {
                pattern = "E";
            } else if (!year1 && year2 && year3) {
                pattern = "F";
            }
        } else if (thisDouble == doubles[1]) {   //Tazria-Metzora
            if (year1 && year2 && !year3) {
                pattern = "A";
            } else if (year1 && !year2 && year3) {
                pattern = "B";
            } else if (!year1 && year2 && year3) {
                pattern = "C";
            } else if (!year1 && year2 && !year3) {
                pattern = "D";
            }
        } else if (thisDouble == doubles[2]) {    //Achrei Mot-Kedoshim
            if (year1 && year2 && !year3) {
                pattern = "A";
            } else if (year1 && !year2 && year3) {
                pattern = "B";
            } else if (!year1 && year2 && year3) {
                pattern = "C";
            } else if (!year1 && year2 && !year3) {
                pattern = "D";
            }
        } else if (thisDouble == doubles[3]) {   //Behar-Bechukotai
            if (year1 && year2 && !year3) {
                pattern = "A";
            } else if (year1 && !year2 && year3) {
                pattern = "B";
            } else if (!year1 && year2 && year3) {
                pattern = "C";
            } else if (!year1 && year2 && !year3) {
                pattern = "D";
            }
        } else if (thisDouble == doubles[4]) {   //Chukat-Balak
            if (year1 && year2 && !year3) {
                pattern = "A";
            } else if (year1 && !year2 && year3) {
                pattern = "B";
            } else if (year1 && !year2 && !year3) {
                pattern = "C";
            } else if (!year1 && !year2 && year3) {
                pattern = "D";
            } else if (!year1 && year2 && !year3) {
                pattern = "E";
            } else if (!year1 && year2 && year3) {
                pattern = "F";
            } else if (!year1 && !year2 && !year3) {
                pattern = "G";
            }
        } else if (thisDouble == doubles[5]) {   //Matot-Masei
            if (year1 && year2 && !year3) {
                pattern = "A";
            } else if (year1 && !year2 && year3) {
                pattern = "B";
            } else if (!year1 && year2 && year3) {
                pattern = "C";
            }
        }

        let __filename = fileURLToPath(import.meta.url);
        let __dirname = path.dirname(__filename)
        let csvPath = path.join(__dirname, "../data", "double_triennial.csv")

        let sheet = fs.readFileSync(csvPath, "utf8");
        let rows = sheet.split("\n");

        for (let row of rows) {
            let cells = row.split(",");

            if (cells[0].trim() == this.desc) {
                if (cells[1].trim() == pattern) {
                    if (cells[2].trim()?.toString() == cycle.toString()) {
                        return cells[a+2].trim();
                    }
                }
            }
        }

        return "Verse Finding Failed";
    }

    /* Finds verses read for each aliyah according to schedule setting when subscribed to the triennail
     * @param a: int 1-9 repersenting an aliyah (1-7: aliyah 1-7, 8: maftir, 9: haftarah)
     * @returns: string repersenting verses to be read for argued aliyah
     * NOTE: refers to help function doublePsukim() when finding verses for a double parsha */
    triPsukim(a: number): string {
        let __filename = fileURLToPath(import.meta.url);
        let __dirname = path.dirname(__filename)
        let csvPath = path.join(__dirname, "../data", "triennial.csv")

        let sheet = fs.readFileSync(csvPath, "utf8");
        let rows = sheet.split("\n");
        let cycle = this.calculateTriennial();
        let verses = "";

        if (a < 8) {
            if (this.desc == "Vaetchanan" && this.settings.getVaetchanan()) {
                this.desc = "Vaetchanan T";
            } else if (this.desc == "Vaetchanan") {
                this.desc = "Vaetchanan F";
            } 
        } else if (this.desc.toLowerCase().includes("vaetchanan")) {
            this.desc = "Vaetchanan";
        }

        for (let row of rows) {
            let cells = row.split(",");

            if (this.settings.getMaftir() == "trad" && a == 8) {
                    return this.tradPsukim(8, false) ?? "";
                } else if (a == 9) {
                    return this.tradPsukim(9, false) ?? "";
                } else if (this.settings.getYitro() && this.desc == "Yitro") {
                    return this.tradPsukim(a, false) ?? "";
                } 

                if (cells[0] == this.desc) {
                    if (cycle == 1) {
                        verses = cells[a];
                    } else if (cycle == 2) {
                        verses = cells[a+8];
                    } else if (cycle == 3) {
                        verses = cells[a+16];
                    }

                    break;
                }
        }

        if (this.RO) {
            if (verses != "double") {
                verses = this.tradPsukim(a, false) ?? "";
            }
        }

        if (verses == "trad") {
            verses = this.tradPsukim(a, false) ?? "";
        } else if (verses == "double") {
            verses = this.doublePsukim(a);
        } 

        return verses;
    }

    /* Helper function to find verses for aliyah (according to fields)
     * @returns string repersenting verses
     * NOTE: Uses TradPsukim and TriPsukim for verse-finding */
    figurePsukim(): string {
        if (!this.settings.getTriennial()) {
            return this.tradPsukim(this.a, false) ?? "";
        } else {
            return this.triPsukim(this.a) ?? "";
        }
    }
}