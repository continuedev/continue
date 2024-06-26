/**
 * A class representing a queue for handling indexing tasks.
 * Ensures tasks are processed one at a time.
 */
class IndexingQueue {
    private queue: (() => Promise<void>)[] = [];
    private processing = false;
    private currentTaskIndex = 0;

    /**
     * Adds a new task to the queue and triggers processing.
     * 
     * @param task - A function returning a promise to be executed.
     */
    enqueue(task: () => Promise<void>) {
        this.queue.push(task);
        this._processQueue();
    }

    /**
     * Private method to process the tasks in the queue. This ensures
     * that only one task is processed at a time by maintaining a 
     * 'processing' flag.
     */
    private async _processQueue() {
        if (this.processing || this.queue.length === 0) {return;}

        this.processing = true;
        this.currentTaskIndex = this.queue.length - 1;
        const task = this.queue.shift()!;
        try {
            await task();
        } catch (error) {
            console.error("Error processing indexing task:", error);
        }
        this.processing = false;
        this._processQueue(); // Process the next task
    }

    /**
     * Returns the current length of the queue.
     * 
     * @returns The number of tasks currently in the queue.
     */
    getQueueLength(): number {
        return this.queue.length;
    }

    /**
    * Returns the current index of the task being processed.
    * 
    * @returns The index of the current task.
    */
    getCurrentTaskIndex(): number {
        return this.currentTaskIndex;
    }
}

export default IndexingQueue;
