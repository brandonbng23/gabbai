import { Dnode } from "./dnode.mts"

export class LinkedList {
    /* @class repersenting a linked list */

    /* @field head: repersents active node (Dnode) of a linked list */
    head: Dnode | null = null;

    /* @field tail: repersents next node (Dnode) relative to active node of a linked list */
    tail: Dnode | null = null;

    constructor() {

    }

    /* Returns value, if applicable, held by active node of a linked list */
    access(): Dnode | void {
        if (this.head?.value) {
            return this.head.value;
        }
    }

    /* Allows for a new node to be added at the end of the linked list. Corrects
     * tail to be appended node, and for the previous tail of the list to precede this node.
     * @param: value repersents the data stored at this node */
    append(value: any): void {
        const newNode = new Dnode(value);

        if (!this.head) {
            this.head = newNode;
            this.tail = newNode;
            return;
        }

        if (this.tail?.next) {
            this.tail.next = newNode;
        }

        newNode.prev = this.tail;
        this.tail = newNode;
    }

    /* Returns next node in linked list, if such node exists */
    next(): any {
        let current: any = this.head;
        if (current.next) {
            return current.next;
        }
        return null;
    }

    /* Returns previous node in linked list, if such node exists */
    prev(): any {
        let current = this.head;
        if (current?.prev) {
            return current.prev;
        }
        return null;
    }
}