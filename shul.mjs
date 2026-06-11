import { Settings } from "./settings.mjs"

export class Shul {
    /* Repersents a shul and its congregation
     * 
     * @field name: string repersenting a shul's name
     * @field key: string repersenting a shul's key to confirm that permissions of its administrators
     * @field admin: array of instances of Admin repersenting all of a shul's administraors
     * @field users: array of instances of User repersentaing all of a shul's users
     * @field schedule: instance of Schedule repersenting a shul's Shabbat and Yontif reading schedule
     * @field url: string repersenting the url of a shul's website
     * @field url: string repersenting the url of a shul's online donation portal */
    constructor(name, admin, users, schedule, url, donationUrl, settings) {
        this.name = name;
        this.key = Math.floor(Math.random() * 90000000) + 10000000;
        this.admin = admin;
        this.users = users;
        this.schedule = schedule;
        this.url = url;
        this.donationUrl = donationUrl;
        this.settings = settings;
    }

    /* Accesses shul's name */
    getName() {
        return this.name;
    }

    /* Mutates shul's name
     * @param name: string repersenting shul name to update field */
    setName(name) {
        this.name = name;
    }

    /* Accesses Admin array */
    getAdmin() {
        return this.admin;
    }

    /* Accesses Users array */
    getUsers() {
        return this.users;
    }

    /* Adds a admin to Admin array
     * @param admin: instance of Admin to push to Admin array */
    addAdmin(admin) {
        this.admin.push(admin);
    }

    /* Adds a user to User array
     * @param user: instance of User to push to User array */
    addUser(user) {
        this.users.push(user);
    }

    /* Creates new Admin array excluding removed Admin, updates Admin array field
     * @param admin: instance of Admin to be removed */
    removeAdmin(admin) {
        let temp = [];

        for (let i = 0; i < this.admin.length; i++) {
            if (admin !== this.admin[i]) {
                temp.push(this.admin[i]);
            }
        }

        this.admin = temp;
    }

    /* Creates new User array exlcuding removed User, updates User array field
     * @param user: instance of User to be removed */
    removeUser(user) {
        let temp = [];

        for (let i = 0; i < this.users.length; i++) {
            if (user !== this.users[i]) {
                temp.push(this.users[i]);
            }
        }

        this.users = temp;
    }

    /* Accesses schedule */
    getSchedule() {
        return this.schedule;
    }

    /* Mutates schedule
     * @param schedule: instance of Schedule to update field */
    setSchedule(schedule) {
        this.schedule = schedule;
    }

    /* Accesses URL */
    getUrl() {
        return this.url;
    }

    /* Mutates URL
     * @param url: string repersenting shul's website URL to update field */
    setUrl(url) {
        this.url = url;
    }

    /* Accesses Donation URL */
    getDonationUrl() {
        return this.donationUrl;
    }

    /* Mutates Donation URL
     * @param url: string repersenting shul's donational portal URL to update field */
    setDonationUrl(url) {
        this.donationUrl = url;
    }

    /* Accesses Admin key for shul */
    getKey() {
        return this.key;
    }

    /* Randomly sets a new key for shul and updates the key of each Admin to remain consistent */
    reassignKey() {
        newKey = this.key;

        while (newKey == this.key()) {
            newKey = Math.floor(Math.random() * 90000000) + 10000000;
        }

        this.key = newKey;

        for (let i = 0; i < this.admin.length; i++) {
            this.admin[i].setKey() == this.key();
        }
    }

    /* Accesses shul's adminstration settings */
    getSettings() {
        return this.settings;
    }

}