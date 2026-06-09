import { User } from "./user.mjs"
import { Admin } from "./admin.mjs"
import { Schedule } from "./schedule.mjs"

export class Shul {
    /* Repersents a shul and its congregation
     * 
     * @field name: string repersenting a shul's name
     * @field key: string repersenting a shul's key to confirm that permissions of its administrators
     * @field admin: array of instances of Admin repersenting all of a shul's administraors
     * @field users: array of instances of User repersentaing all of a shul's users
     * @field schedule: instance of Schedule repersenting a shul's Shabbat and Yontif reading schedule
     * @field url: string repersenting the url of a shul's website
     * @field url: string repersenting the url of a shul's online donation portal
    */
    constructor(name, key, admin, users, schedule, url, donationUrl) {
        this.name = name;
        this.key = key;
        this.admin = admin;
        this.users = users;
        this.schedule = schedule;
        this.url = url;
        this.donationUrl = donationUrl;
    }

}