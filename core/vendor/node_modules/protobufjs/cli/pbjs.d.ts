type pbjsCallback = (err: Error|null, output?: string) => void;

/**
 * Runs pbjs programmatically.
 * @param {string[]} args Command line arguments
 * @param {function(?Error, string=)} [callback] Optional completion callback
 * @returns {number|undefined} Exit code, if known
 */
export function main(args: string[], callback?: pbjsCallback): number|undefined;
