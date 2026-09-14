import { Dnode } from "./dnode.mjs"

export class LinkedList {
    /* Class to connect nodes as a linked list
     *
     * @field head: repersents first node of linked list
     * @field tail: repersents last node of linked list */

    head: Dnode | null = null;
    tail: Dnode | null = null;

    constructor() {

    }

    access(): Dnode | void {
        if (this.head?.value) {
            return this.head.value;
        }
    }

    /* APPEND: Allows for a new node to be added at the end of the linked list. Corrects
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