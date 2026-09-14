import { Aliyah } from "./aliyah.mts"
import { Shul } from "./shul.mts"
import { Admin } from "./admin.mts"

export class User {
    /* @class Repersents a user in its most basic form */
    
    /* @field firstN: string repersenting a user's first name */
    firstN: string;

    /* @field lastN: string repersenting a user's last name */
    lastN: string;

    /* @field email: string repersenting a user's email (to be used for login and contact) */
    email: string;

    /* @field password: string repersenting a user's password (for logon) */
    password: string;

    /* @field readings: Array of Aliyah instances repersenting the readings a user has been assigned */
    readings: Aliyah[] = [];

    constructor(firstN: string, lastN: string, email: string, password: string) {
        this.firstN = firstN;
        this.lastN = lastN;
        this.email = email;
        this.password = password;
    }

    /* Accesses User's first name */
    getFirstN(): string {
        return this.firstN;
    }

    /* Mutates first name field to match input
    @param n: string repersenting first name to update field */
    setFirstN(n: string): void {
        this.firstN = n;
    }

    /* Accesses User's last name */
    getLastN(): string {
        return this.lastN;
    }

    /* Mutates last name field to match input
    @param n: string repersenting last name to update field */
    setLastN(n: string): void {
        this.lastN = n;
    }

    /* Assembles and formats first and last name fields as string: ex. "BEN COHEN" */
    nameToString(): string {
        return this.firstN + " " + this.lastN;
    }

    /* Accesses User's email address */
    getEmail():string {
        return this.email;
    }

    /* Mutates email field to match input
    @param a: string repersenting address of email to update field */
    setEmail(a: string): void {
        this.email = a; // future expansion: return false if string does not match email format "@", "."-com, etc.
    }

    /* Accesses User's password */
    getPassword(): string {
        return this.password;
    }

    /* Mutates password field to match input
    @param p: string repersenting address of password field */
    setPassword(p: string): void {
        this.password = p; // future expansion: return false is string does not match password format
    }

    /* Accesses User's assigned readings */
    getReadings(): Aliyah[] {
        return this.readings;
    }

    /* Adds reading to list of this.readings, list of assigned readings
     * @param r: Aliyah object repersenting reading to be added to this.readings */
    addReading(r: Aliyah): void {
        this.readings.push(r);
    }

    /* Removes specified reading from this.readings
     * @param r: String repersenting reading name (parsha or yontif name and aliyah number 1-9 in a single string)
     * to be removed from User's assigned reading list */
    removeReading(r: Aliyah): void {
        let newReadings = [];

        for (let i = 0; i < this.readings.length; i++) {
            if (this.readings[i].getName() != r) {
                newReadings.push(this.readings[i]);
            } 
        }

        this.readings = newReadings;
    }

    /* Converts an exisiting user to an admin. Removes exisiting user from shul's users array and adds an
     * appropriate instance of Admin to shul's admin array
     * @param user: instance of User repersenting existing user to become an Admin
     * @param title: string repsenting the title of the position this admin holds
     * @param shul: instance of Shul repersenting the shul for which this admin will administrate
     * @param key: repersents key to verify admin's association with shul */
    convertToAdmin(key: string, shul: Shul, title: string): Admin | null {
        if (key == shul?.getKey()) {
            shul?.removeUser(this);
            let newAdmin: Admin = new Admin(this.firstN,
                                     this.lastN,
                                     this.email,
                                     this.password,
                                     title,
                                     shul,
                                     key);
        
            shul?.addAdmin(newAdmin);
            return newAdmin;
        }
        return null;
    }
}