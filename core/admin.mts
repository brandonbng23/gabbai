import { User } from "./user.mjs"
import { Shul } from "./shul.mjs"

export class Admin extends User {
    /* @class Admin: repersents a user who has been granted administrator access for their associated shul. An administrator
     * is granted permission to accesses and modify a shul's reading schedule, its settings, and the shul's profile */

    /* @field title: string repersenting an administrator's title for which they hold with their associated shul */
    title: string;

    /* @field shul: instance of Shul class repersenting the Shul an administrator is associated */
    shul: Shul;

    /* field key: string repersenting the key belonging to an administor's associated shul. Used for association verfication.
     * Note that a key is unique to each shul, not each administrator (a shul can have multiple administrators) */ 
    key: string;

    constructor(firstN: string, lastN: string, email: string, password: string, title: string, shul: Shul, key: string) {
        super(firstN, lastN, email, password);
        this.title = title;
        this.shul = shul;
        this.key = key;
    }

    /* Mutates key field
     * @param key: key for which the key field will mutate to */
    setKey(key) {
        this.key = key;
    }

    /* Revokes an existing Admin's administrator privelages
     * param r: boolean. If r is set true, administrator privelages will be revoked but admin will retain
     * user privelages. If r is set false, administraor and user privelages will be revoked. */
    revokeAdmin(r) {
        this.shul.removeAdmin();
        if (r) {
            this.shul?.(new User(this.firstN, this.lastN, this.email, this.password));
        }
    }

    /* Returns all administrator data for current administrator
     * @returns object retaining administrator data */
    getAdminData() {
        return {
            firstN: this.firstN,
            lastN: this.lastN,
            email: this.email,
            password: this.password,
            title: this.title,
            shul: this.shul,
            key: this.key
        };
    }
}