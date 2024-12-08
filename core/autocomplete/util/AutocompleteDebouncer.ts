import { v4 as uuidv4 } from "uuid";
export class AutocompleteDebouncer {
  private debounceTimeout: NodeJS.Timeout | undefined = undefined;
  private debouncing = false;
  private lastUUID: string | undefined = undefined;

  /** When called the first time, this method returns false immediately. If the method is called afterwards within the debounce delay,
   * the method waits for debounceDelay and checks if no other request has been made in the meantime. If no other request has been made,
   * the method returns false. If another request has been made, the method returns true.
   */
  async delayAndShouldDebounce(debounceDelay: number): Promise<boolean> {
    // Debounce
    const uuid = uuidv4();
    this.lastUUID = uuid;

    // Debounce
    if (this.debouncing) {
      this.debounceTimeout?.refresh();
      const lastUUID = await new Promise((resolve) =>
        setTimeout(() => {
          resolve(this.lastUUID);
        }, debounceDelay),
      );
      if (uuid !== lastUUID) {
        return true;
      }
    } else {
      this.debouncing = true;
      this.debounceTimeout = setTimeout(async () => {
        this.debouncing = false;
      }, debounceDelay);
    }

    return false;
  }
}
