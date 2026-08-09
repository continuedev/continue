/**
 * @file Custom data structures.
 *
 * These are only used internally, meaning an end-user shouldn't
 * need to access anything here.
 *
 * @module utils/data-structures
 */
/**
 * Efficient Heap-based Implementation of a Priority Queue.
 * It uses an array-based binary heap, where the root is at index `0`, and the
 * children of node `i` are located at indices `2i + 1` and `2i + 2`, respectively.
 *
 * Adapted from the following sources:
 * - https://stackoverflow.com/a/42919752/13989043 (original)
 * - https://github.com/belladoreai/llama-tokenizer-js (minor improvements)
 */
export class PriorityQueue {
  /**
   * Create a new PriorityQueue.
   * @param {Function} comparator Comparator function to determine priority. Defaults to a MaxHeap.
   */
  constructor(comparator?: Function);
  _heap: any[];
  _comparator: Function;
  /**
   * The size of the queue
   */
  get size(): number;
  /**
   * Check if the queue is empty.
   * @returns {boolean} `true` if the queue is empty, `false` otherwise.
   */
  isEmpty(): boolean;
  /**
   * Return the element with the highest priority in the queue.
   * @returns {any} The highest priority element in the queue.
   */
  peek(): any;
  /**
   * Add one or more elements to the queue.
   * @param  {...any} values The values to push into the queue.
   * @returns {number} The new size of the queue.
   */
  push(...values: any[]): number;
  /**
   * Add multiple elements to the queue.
   * @param {any[]} values The values to push into the queue.
   * @returns {number} The new size of the queue.
   */
  extend(values: any[]): number;
  /**
   * Remove and return the element with the highest priority in the queue.
   * @returns {any} The element with the highest priority in the queue.
   */
  pop(): any;
  /**
   * Replace the element with the highest priority in the queue with a new value.
   * @param {*} value The new value.
   * @returns {*} The replaced value.
   */
  replace(value: any): any;
  /**
   * Compute the index for the parent of the node at index `i`.
   * @param {number} i The index of the node to get the parent of.
   * @returns {number} The index of the parent node.
   * @private
   */
  private _parent;
  /**
   * Compute the index for the left child of the node at index `i`.
   * @param {number} i The index of the node to get the left child of.
   * @returns {number} The index of the left child.
   * @private
   */
  private _left;
  /**
   * Compute the index for the right child of the node at index `i`.
   * @param {number} i The index of the node to get the right child of.
   * @returns {number} The index of the right child.
   * @private
   */
  private _right;
  /**
   * Check if the element at index `i` is greater than the element at index `j`.
   * @param {number} i The index of the first element to compare.
   * @param {number} j The index of the second element to compare.
   * @returns {boolean} `true` if the element at index `i` is greater than the element at index `j`, `false` otherwise.
   * @private
   */
  private _greater;
  /**
   * Swap the elements at indices `i` and `j`.
   * @param {number} i The index of the first element to swap.
   * @param {number} j The index of the second element to swap.
   * @private
   */
  private _swap;
  /**
   * Maintain the heap property by updating positions in the heap,
   * starting at the last element and moving up the heap.
   * @private
   */
  private _siftUp;
  /**
   * Maintain the heap property by updating positions in the heap,
   * starting at the first element and moving down the heap.
   * @private
   */
  private _siftDown;
}
/**
 * A trie structure to efficiently store and search for strings.
 */
export class CharTrie {
  root: CharTrieNode;
  /**
   * Adds one or more `texts` to the trie.
   * @param {string[]} texts The strings to add to the trie.
   */
  extend(texts: string[]): void;
  /**
   * Adds text to the trie.
   * @param {string} text The string to add to the trie.
   */
  push(text: string): void;
  /**
   * Searches the trie for all strings with a common prefix of `text`.
   * @param {string} text The common prefix to search for.
   * @yields {string} Each string in the trie that has `text` as a prefix.
   */
  commonPrefixSearch(text: string): Generator<string, void, unknown>;
}
/**
 * A lattice data structure to be used for tokenization.
 */
export class TokenLattice {
  /**
   * Creates a new TokenLattice instance.
   *
   * @param {string} sentence The input sentence to be tokenized.
   * @param {number} bosTokenId The beginning-of-sequence token ID.
   * @param {number} eosTokenId The end-of-sequence token ID.
   */
  constructor(sentence: string, bosTokenId: number, eosTokenId: number);
  sentence: string;
  len: number;
  bosTokenId: number;
  eosTokenId: number;
  nodes: TokenLatticeNode[];
  beginNodes: any[][];
  endNodes: any[][];
  /**
   * Inserts a new token node into the token lattice.
   *
   * @param {number} pos The starting position of the token.
   * @param {number} length The length of the token.
   * @param {number} score The score of the token.
   * @param {number} tokenId The token ID of the token.
   */
  insert(pos: number, length: number, score: number, tokenId: number): void;
  /**
   * Implements the Viterbi algorithm to compute the most likely sequence of tokens.
   *
   * @returns {TokenLatticeNode[]} The array of nodes representing the most likely sequence of tokens.
   */
  viterbi(): TokenLatticeNode[];
  /**
   * @param {TokenLatticeNode} node
   * @returns {string} The array of nodes representing the most likely sequence of tokens.
   */
  piece(node: TokenLatticeNode): string;
  /**
   * @returns {Array} The array of nodes representing the most likely sequence of tokens.
   */
  tokens(): any[];
  /**
   * @returns {Array} The array of nodes representing the most likely sequence of tokens.
   */
  tokenIds(): any[];
}
/**
 * Represents a node in a character trie.
 */
declare class CharTrieNode {
  /**
   * Returns a new `CharTrieNode` instance with default values.
   * @returns {CharTrieNode} A new `CharTrieNode` instance with `isLeaf` set to `false` and an empty `children` map.
   */
  static default(): CharTrieNode;
  /**
   * Create a new CharTrieNode.
   * @param {boolean} isLeaf Whether the node is a leaf node or not.
   * @param {Map<string, CharTrieNode>} children A map containing the node's children, where the key is a character and the value is a `CharTrieNode`.
   */
  constructor(isLeaf: boolean, children: Map<string, CharTrieNode>);
  isLeaf: boolean;
  children: Map<string, CharTrieNode>;
}
declare class TokenLatticeNode {
  /**
   * Represents a node in a token lattice for a given sentence.
   * @param {number} tokenId The ID of the token associated with this node.
   * @param {number} nodeId The ID of this node.
   * @param {number} pos The starting position of the token in the sentence.
   * @param {number} length The length of the token.
   * @param {number} score The score associated with the token.
   */
  constructor(
    tokenId: number,
    nodeId: number,
    pos: number,
    length: number,
    score: number,
  );
  tokenId: number;
  nodeId: number;
  pos: number;
  length: number;
  score: number;
  prev: any;
  backtraceScore: number;
  /**
   * Returns a clone of this node.
   * @returns {TokenLatticeNode} A clone of this node.
   */
  clone(): TokenLatticeNode;
}
export {};
//# sourceMappingURL=data-structures.d.ts.map
