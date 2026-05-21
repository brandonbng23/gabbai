import { Dnode } from "./dnode.js"

export class LinkedList {

    /* head: repersents first node of linked list
     * tail: repersents last node of linked list */
    constructor() {
        this.head = null;
        this.tail = null;
    }

    access() {
        return this.head.value;
    }

    /* APPEND: Allows for a new node to be added at the end of the linked list. Corrects
     * tail to be appended node, and for the previous tail of the list to precede this node.
     * @param: value repersents the data stored at this node */
    append(value) {
        const newNode = new Dnode(value);

        if (!this.head) {
            this.head = newNode;
            this.tail = newNode;
            return;
        }

        this.tail.next = newNode;
        newNode.prev = this.tail;
        this.tail = newNode;
    }

    /* Returns next node in linked list, if such node exists */
    next() {
        let current = this.head;
        if (current.next) {
            return current.next;
        }
        return null;
    }

    /* Returns previous node in linked list, if such node exists */
    prev() {
        let current = this.head;
        if (current.prev) {
            return current.prev;
        }
        return null;
    }
}