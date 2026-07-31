import { Reader } from "./settings.mjs";
import { Settings } from "./readers.mjs";

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

export class Aliyah {
    constructor(desc, a, reader, settings) {
        /* Class repersents one reading within a weekly group of readings (be it the parsha of the week or a
         * Yontif reading). Manges each aliyah to record its reader and psukim.
         *
         * @field desc: string repersenting name of parsha or Yontif associated with reading
         * @field a: integer repersenting aliyah number 1-9 of reading (1-7: aliyah 1-7, 8: maftir, 9: haftarah)
         * @field psukim: string repersenting chapters and verses associated with reading
         * @field reader: instance of reader repersenting reader registered for reading 
         * @field settings: instance of Settings to access administration settings */
        this.desc = desc;
        this.a = a;

        if (reader) {
            this.reader = reader;
        } else {
            this.reader = "available";
        }

        this.settings = settings;
    }

    /* Returns year of triennail cycle (1, 2, or 3 for the first...third year of a 
     * triennial Torah reading cycle)
     * @returns integer repersenting first...third year of triennial cycle */
    calculateTriennial() {
        return ((this.settings.getHebYear() + 1) % 3) + 1;
    }

    /* Finds verses read for each aliyah according to schedule settings
     * @param a: int 1-9 repersenting an aliyah (1-7: aliyah 1-7, 8: maftir, 9: haftarah)
     * @param flag: boolean indicating control flow when the method is called recusively 
     * @returns: string repersenting verses to be read for argued aliyah */
    tradPsukim(a, flag) {
            let __filename = fileURLToPath(import.meta.url);
            let __dirname = path.dirname(__filename)
            let csvPath = path.join(__dirname, "../data", "psukim.csv")
    
            let sheet = fs.readFileSync(csvPath, "utf8");
            let rows = sheet.split("\n");
    
            for (let row of rows) {
                let cells = row.split(",");
    
                if (!this.special?.trim() || flag) {
                    if (cells[0] == this.desc) {
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

    /* Helper function finding verses for double parshiyot when subscribing to the triennial
     * @param a: int 1-9 repersenting an aliyah (1-7: aliyah, 8: maftir, 9: haftarh)
     * @returns string repersenting verses to be read for argued aliyah */
    doublePsukim(a) {
        let year = this.settings.getHebYear()
        let cycle = this.calculateTriennial();
        let schedule = [];
        let pattern = "no pattern found";
        let thisDouble = "";
        let doubles = ["Vayakhel-Pekudei",
                        "Tazria-Metzora",
                        "Achrei Mot-Kedoshim",
                        "Behar-Bechukotai",
                        "Chukat-Balak",
                        "Matot-Masei"
                    ];

        if (cycle == 1) {
            schedule.push(new SimpleSchedule(this.settings, year).createSimpleSchedule());
            schedule.push(new SimpleSchedule(this.settings, year+1).createSimpleSchedule());
            schedule.push(new SimpleSchedule(this.settings, year+2).createSimpleSchedule());

        } else if (cycle == 2) {
            schedule.push(new SimpleSchedule(this.settings, year-1).createSimpleSchedule());
            schedule.push(new SimpleSchedule(this.settings, year).createSimpleSchedule());
            schedule.push(new SimpleSchedule(this.settings, year+1).createSimpleSchedule());

        } else if (cycle == 3) {
            schedule.push(new SimpleSchedule(this.settings, year-2).createSimpleSchedule());
            schedule.push(new SimpleSchedule(this.settings, year-1).createSimpleSchedule());
            schedule.push(new SimpleSchedule(this.settings, year).createSimpleSchedule());

        }

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
        let current = schedule[0].head;
        while (current) {
            if (current.value["desc"].includes(thisDouble)) {
                year1 = true;
                break;
            }

            current = current.next;            
        }

        let year2 = false;          // Year 2 has doubled parsha (true) or split (false)
        current = schedule[1].head;
        while(current) {
            if (current.value["desc"].includes(thisDouble)) {
                year2 = true;
                break;
            }

            current = current.next;
        }

        let year3 = false;          // Year 3 had doubled parsha (true) or split (false)
        current = schedule[2].head;
        while (current) {
            if (current.value["desc"].includes(thisDouble)) {
                year3 = true;
                break;
            }

            current = current.next;
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
    triPsukim(a) {
        let __filename = fileURLToPath(import.meta.url);
        let __dirname = path.dirname(__filename)
        let csvPath = path.join(__dirname, "../data", "triennial.csv")

        let sheet = fs.readFileSync(csvPath, "utf8");
        let rows = sheet.split("\n");
        let cycle = this.calculateTriennial(5786);
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
                    return this.tradPsukim(8, false);
                } else if (a == 9) {
                    return this.tradPsukim(9, false);
                } else if (this.settings.getYitro() && this.dewsc == "Yitro") {
                    return this.tradPsukim(a, false);
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

        if (this.special) {
            if (verses != "double") {
                verses = this.tradPsukim(a, false);
            }
        }

        if (verses == "trad") {
            verses = this.tradPsukim(a, false);
        } else if (verses == "double") {
            verses = this.doublePsukim(a);
        } 

        return verses;
    }

    /* Helper function to find verses for aliyah (according to fields)
     * @returns string repersenting verses
     * NOTE: Uses TradPsukim and TriPsukim for verse-finding */
    figurePsukim() {
        if (!this.settings.getTriennial()) {
            return this.tradPsukim(this.a, false);
        } else {
            return this.triPsukim(this.a);
        }
    }

    /* Helper function to find user data (according to fields)
     * @returns User object (if field is not NULL) or field default string (placeholder) */
    figureReaderData() {
        if (this.reader instanceof user) {
            return this.reader.getUserData();
        } else {
            return this.reader;
        }
    }

    /* @returns aliyah data as an object according to fields and figuration methods
     * NOTE: Uses figurePsukim and figureReaderData() (figuration methods) to find respective data */
    getAliyahData() {
        return {
            event: this.desc,
            aliyahNum: this.a,
            psukim: this.figurePsukim(),
            reader: this.figureReaderData()
        }
    }
}