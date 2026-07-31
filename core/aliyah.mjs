export class Aliyah {
    constructor(parsha, a, psukim, reader) {
        /* Class repersents one reading within a weekly group of readings (be it the parsha of the week or a
         * Yontif reading)
         *
         * @field parsha: string repersenting name of parsha associated with reading
         * @field a: integer repersenting aliyah number 1-9 of reading (1-7=aliyah 1-7, 8=maftir, 9=haftarah)
         * @field psukim: string repersenting chapters and verses associated with reading
         * @field reader: instance of reader repersenting reader registered for reading */
        this.parsha = parsha;
        this.a = a;
        this.psukim = psukim;
        this.reader = reader;
    }
}