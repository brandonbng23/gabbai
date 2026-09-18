import { User } from "./user.mts"
import { Shul } from "./shul.mts"

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
    setKey(key: string) {
        this.key = key;
    }

    /* Revokes an existing Admin's administrator privelages
     * param r: boolean. If r is set true, administrator privelages will be revoked but admin will retain
     * user privelages. If r is set false, administraor and user privelages will be revoked. */
    revokeAdmin(r: boolean): void {
        this.shul.removeAdmin(this);
        if (r) {
            this.shul?.addUser(new User(this.firstN, this.lastN, this.email, this.password));
        }
    }

    /* Converts an exisiting user to an admin. Removes exisiting user from shul's users array and adds an
     * appropriate instance of Admin to shul's admin array
     * @param user: instance of User repersenting existing user to become an Admin
     * @param title: string repsenting the title of the position this admin holds
     * @param shul: instance of Shul repersenting the shul for which this admin will administrate
     * @param key: repersents key to verify admin's association with shul */
    covertToAdmin(u: User, key: string, title: string, shul: Shul): Admin | null {
        if (key === this.shul.getKey()) {
            const newAdmin: Admin = new Admin(
                                                u.firstN,
                                                u.lastN,
                                                u.email,
                                                u.password,
                                                title,
                                                shul,
                                                key
            )

            shul.addAdmin(newAdmin);
            return newAdmin;
        }

        return null;

    }
}