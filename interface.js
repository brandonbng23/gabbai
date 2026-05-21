import readline from "readline" 

import { User } from "./user.js"
import { Schedule } from "./schedule.js"


export class Interface {
    /* Builds interface to view and register for a reading 
     *
     * Schedule: repersents an instance of schedule */
    constructor(schedule, debug) {
        this.schedule = schedule; 
        this.debug = debug;

        if (this.debug) {
            this.printMenu();
        }

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    /* Builds and prints menu for user to interface with.
     * Calls next display according to user's selection  */
    printMenu() {
        new User("a", "b", "c", "d");
        let input;
        console.log("__________________________________________________________________");
        console.log("\n               Enter a letter to take its action");
        console.log("__________________________________________________________________\n");
        console.log("   A:  Search Parshot\n");
        console.log("   B:  Search Parshot by Name \n");
        console.log("   C:  View all Parshot \n");
        console.log("   D:  Register as a reader\n");
        console.log("   E:  Quit\n");
        this.rl.question("   Enter:  ", (answer) => {
            input = answer;
        });
    }

    printSearchByDate() {
        let input;
        console.log("__________________________________________________________________");
        console.log("\n               Enter a date to search");
        console.log("__________________________________________________________________");
    }
}