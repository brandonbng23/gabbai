import { HebrewCalendar, 
         HDate,
         parshaYear, 
         getHolidaysOnDate} from '@hebcal/core'
import { Settings } from "./settings.mts"
import { LinkedList } from "./linkedList.mts"

export class SimpleSchedule {
    /* @class repersenting a simplified schedule. To be used for internal use cases for efficiencey */

    /* @field settings: instance of Settings repersenting settings to apply to SimpleSchedule */
    settings: Settings;

    /* @field hebYear: number repersenting active Hebrew Year */
    hebYear: number;

    constructor(settings: Settings, hebYear: number) {
        this.settings = settings;

        if (hebYear) {
            this.hebYear = hebYear;
        } else {
            if (settings) {
                this.hebYear = this.settings.getHebYear();
            } else {
                this.hebYear = 1;
            }
        }
    }

    /* Creates a simple schedule retaining only parsha name and year 
     * @returns: LinkedList instance of Objects holding parsha name and year */
    createSimpleSchedule() {
        let parshaCal = parshaYear(this.hebYear, this.settings.getIL());
        let schedule = new LinkedList();

        for (let i = 0; i < parshaCal.length; i++) {
            schedule.append({desc: parshaCal[i]
                                        .getDesc()
                                        .trim(),
                             hebYear: this.hebYear
                        });
        }

        return schedule;
    }
}