import { Admin } from "./admin.mts";
import { User } from "./user.mts";
import { Schedule } from "./schedule.mts";
import { Settings } from "./settings.mts";

export class Shul {
    /* @class repersents a shul and its congregation */


    /* @field name: string repersenting a shul's name */
    name: string;

    /* @field key: string (casted from random number) repersenting a shul's confirmation key to vefiy an administrator's association */
    key: string = (Math.floor(Math.random() * 90000000) + 10000000).toString();

    /* @field admins: array of Admin instances repersenting all of a shul's verified administrators */
    admins: Admin[];

    /* @field users: array of Users instances repersetning all of a shul's users (including administrators) */
    users: User[];

    /* @field schedule: instance of Schedule repersenting a shul's Shabbat and Yontif reading schedule */
    schedule: Schedule;

    /* @field url: string repersenting the url directing to a shul's website */
    url: string;

    /* @field donationUrl: string repersenting the url directing to a shul's online donation portal */
    donationUrl: string;


    settings: Settings;

    constructor(name: string, admins: Admin[], users: User[], schedule: Schedule, url: string, donationUrl: string, settings: Settings) {
        this.name = name;
        this.admins = admins;
        this.users = users;
        this.schedule = schedule;
        this.url = url;
        this.donationUrl = donationUrl;
        this.settings = settings;
    }

    /* Accesses shul's name */
    getName(): string {
        return this.name;
    }

    /* Mutates shul's name
     * @param name: string repersenting shul name to update field */
    setName(n: string): void {
        this.name = n;
    }

    /* Accesses Admin array */
    getAdmin(): Admin[] {
        return this.admins;
    }

    /* Accesses Users array */
    getUsers(): User[] {
        return this.users;
    }

    /* Adds a admin to Admin array
     * @param admin: instance of Admin to push to Admin array */
    addAdmin(admin: Admin) {
        this.admins.push(admin);
    }

    /* Adds a user to User array
     * @param user: instance of User to push to User array */
    addUser(user: User) {
        this.users.push(user);
    }

    /* Creates new Admin array excluding removed Admin, updates Admin array field
     * @param admin: instance of Admin to be removed */
    removeAdmin(admin: Admin) {
        let temp = [];

        for (let i = 0; i < this.admins.length; i++) {
            if (admin != this.admins[i]) {
                temp.push(this.admins[i]);
            }
        }

        this.admins = temp;
    }

    /* Creates new User array exlcuding removed User, updates User array field
     * @param user: instance of User to be removed */
    removeUser(user: User) {
        let temp = [];

        for (let i = 0; i < this.users.length; i++) {
            if (user != this.users[i]) {
                temp.push(this.users[i]);
            }
        }

        this.users = temp;
    }

    /* Accesses schedule */
    getSchedule(): Schedule {
        return this.schedule;
    }

    /* Mutates schedule
     * @param schedule: instance of Schedule to update field */
    setSchedule(schedule: Schedule): void {
        this.schedule = schedule;
    }

    /* Accesses URL */
    getUrl(): string {
        return this.url;
    }

    /* Mutates URL
     * @param url: string repersenting shul's website URL to update field */
    setUrl(url: string): void {
        this.url = url;
    }

    /* Accesses Donation URL */
    getDonationUrl() {
        return this.donationUrl;
    }

    /* Mutates Donation URL
     * @param url: string repersenting shul's donational portal URL to update field */
    setDonationUrl(url: string): void {
        this.donationUrl = url;
    }

    /* Accesses Admin key for shul */
    getKey(): string {
        return this.key;
    }

    /* Randomly sets a new key for shul and updates the key of each Admin to remain consistent */
    reassignKey(): void {
        let newKey: string = this.key;

        while (newKey === this.getKey()) {
            newKey = (Math.floor(Math.random() * 90000000) + 10000000).toString();
        }

        this.key = newKey;

        for (let i = 0; i < this.admins.length; i++) {
            newKey === this.getKey();
        }
    }

    /* Accesses shul's adminstration settings */
    getSettings(): Settings {
        return this.settings;
    }
}