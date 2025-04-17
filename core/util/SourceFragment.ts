export class SourceFragment {
  private lines: string[];

  /**
   * Creates a new SourceFragment from a string.
   * @param text A chunk of source code to encapsulate
   */
  constructor(text: string) {
    // Break the incoming text into an array of lines once,
    // so all further operations can work on indexed lines.
    this.lines = text.split(/\r?\n/);
  }

  /**
   * Gets the number of lines in this fragment.
   * @param options Optional settings
   * @param options.range Optional range to limit the fragment
   * @param options.ignoreWhitespace If true, ignores whitespace and empty lines
   * @returns The number of lines in this fragment
   */
  public getLineCount(options?: {
    range?: SourceFragmentRange;
    ignoreWhitespace?: boolean;
  }): number {
    const { range, ignoreWhitespace = false } = options || {};

    // If caller doesn’t want any slicing or trimming, use a fast path
    if (!range && !ignoreWhitespace) return this.lines.length;

    // Delegate to getAsLines, which handles both slicing and trimming,
    // and count the resulting lines.
    return this.getAsLines(options).length;
  }

  /**
   * Gets a new SourceFragment containing the specified portion of this fragment.
   * @param options Optional settings
   * @param options.range Optional range to limit the fragment
   * @param options.ignoreWhitespace If true, ignores whitespace and empty lines
   * @returns A new SourceFragment containing the specified range or a copy of the entire fragment
   */
  public getAsFragment(options?: {
    range?: SourceFragmentRange;
    ignoreWhitespace?: boolean;
  }): SourceFragment {
    // Reuse getAsText to build the substring, then wrap back into a fragment.
    const text = this.getAsText(options);
    return new SourceFragment(text);
  }

  /**
   * Gets the text of this fragment. If a range is given, it will return the
   * text between startLine and endLine (inclusive), with startLineOffset applied
   * to the first line and endLineLimit applied to the final line.
   * @param options Optional settings
   * @param options.range Optional range to limit the fragment
   * @param options.ignoreWhitespace If true, ignores whitespace and empty lines
   * @returns Text from the specified range or entire text
   */
  public getAsText(options?: {
    range?: SourceFragmentRange;
    ignoreWhitespace?: boolean;
  }): string {
    // Join the selected lines back into a single text block.
    return this.getAsLines(options).join("\n");
  }

  /**
   * Gets the lines of this fragment as an array.
   * @param options Optional settings
   * @param options.range Optional range to limit the fragment
   * @param options.ignoreWhitespace If true, ignores whitespace and empty lines
   * @returns A copy of the lines array
   */
  public getAsLines(options?: {
    range?: SourceFragmentRange | null;
    ignoreWhitespace?: boolean;
  }): string[] {
    const { range, ignoreWhitespace = false } = options || {};

    // If no range slicing, just apply whitespace rules to the full array.
    if (!range)
      return adjustLinesForWhitespace(this.lines, { ignoreWhitespace });

    // Pull range parameters and clamp them to valid bounds.
    let {
      startLine = 0,
      startLineOffset = 0,
      endLine = Infinity,
      endLineLimit = Infinity,
    } = range;

    // Ensure indices are within [0, last line].
    startLine = Math.max(0, startLine);
    startLineOffset = Math.max(0, startLineOffset);
    endLine = Math.min(endLine, this.lines.length - 1);
    endLineLimit = Math.min(endLineLimit, this.lines[endLine].length);

    // Slice out the desired lines, then apply whitespace trimming if requested.
    const selectedLines = adjustLinesForWhitespace(
      this.lines.slice(startLine, endLine + 1),
      { ignoreWhitespace },
    );

    // If after trimming there’s nothing, return early.
    if (selectedLines.length === 0) return [];

    // Clamp offsets against actual line lengths post-trim.
    startLineOffset = Math.min(startLineOffset, selectedLines[0].length);
    endLineLimit = Math.min(endLineLimit, this.lines[endLine].length);

    // Remove characters before the offset on the first line.
    selectedLines[0] = selectedLines[0].substring(startLineOffset);

    // Similarly, truncate the last line at the endLineLimit.
    const lastIndex = selectedLines.length - 1;
    const lastLine = selectedLines[lastIndex];
    selectedLines[lastIndex] = lastLine.substring(0, endLineLimit);

    return selectedLines;
  }

  /**
   * Returns the first maxLines lines of the fragment.
   * @param maxLines The maximum number of lines to return
   * @param options Optional settings
   * @param options.ignoreWhitespace If true, trims whitespace and omits blank lines
   * @returns The first maxLines lines
   */
  public head(
    maxLines = Infinity,
    options?: { ignoreWhitespace?: boolean },
  ): string[] {
    const { ignoreWhitespace = false } = options || {};

    // Pre-filter lines for whitespace behavior before slicing.
    const lines = adjustLinesForWhitespace(this.lines, { ignoreWhitespace });

    // Limit to as many lines as exist or requested.
    const numberOfLines = Math.min(maxLines, lines.length);
    if (numberOfLines === 0) return [];
    return lines.slice(0, numberOfLines);
  }

  /**
   * Returns the last maxLines lines of the fragment.
   * @param maxLines The maximum number of lines to return
   * @param options Optional settings
   * @param options.ignoreWhitespace If true, trims whitespace and omits blank lines
   * @returns The last maxLines lines of the fragment
   */
  public tail(
    maxLines = Infinity,
    options?: { ignoreWhitespace?: boolean },
  ): string[] {
    const { ignoreWhitespace = false } = options || {};

    // Same filtering as head, but we’ll take from the end.
    const lines = adjustLinesForWhitespace(this.lines, { ignoreWhitespace });

    const numberOfLines = Math.min(maxLines, lines.length);
    if (numberOfLines === 0) return [];
    return lines.slice(-numberOfLines);
  }

  /**
   * Yields progressively larger suffixes of the text, starting from the last
   * line, up to maxLines.
   * @param maxLines The maximum number of lines to return
   * @param options Optional settings
   * @param options.ignoreWhitespace If true, trims whitespace and omits blank lines
   * @returns A generator of progressively larger suffixes of the text
   */
  public *trailingLines(
    maxLines = Infinity,
    options?: { ignoreWhitespace?: boolean },
  ): Generator<string[]> {
    // Compute the tail once, then yield 1-line suffix, 2-line suffix, etc.
    const lines = this.tail(maxLines, options);

    for (let count = 1; count <= lines.length; count++)
      yield lines.slice(-count);
  }

  /**
   * Yields up to maxLines lines, either forward or backward.
   * @param options Optional settings
   * @param options.backward If true, starts from the last line and moves up
   * @param options.maxLines Maximum number of lines to yield
   * @param options.ignoreWhitespace If true, trims whitespace and omits blank lines
   * @returns A generator yielding lines one by one
   */
  public *iterateLines(
    options: {
      backward?: boolean;
      maxLines?: number;
      ignoreWhitespace?: boolean;
    } = {},
  ): Generator<string> {
    const {
      backward = false,
      maxLines = Infinity,
      ignoreWhitespace = false,
    } = options;
    // Cap number of lines to the fragment’s length.
    const numberOfLines = Math.min(maxLines, this.lines.length);

    let linesCounted = 0;

    // Determine iteration start/end/step based on direction.
    const startIndex = backward ? this.lines.length - 1 : 0;
    const endIndex = backward ? 0 : this.lines.length - 1;
    const step = backward ? -1 : 1;

    for (
      let i = startIndex;
      backward ? i >= endIndex : i <= endIndex;
      i += step
    ) {
      // Optionally trim each line, skipping empties when requested.
      let line = ignoreWhitespace ? this.lines[i].trim() : this.lines[i];
      if (ignoreWhitespace && line.length === 0) continue;

      yield line;
      linesCounted++;
      if (linesCounted >= numberOfLines) break;
    }
  }

  /**
   * If this fragment ends with the start of another fragment, return the
   * remaining portion of the other fragment.
   * @param referenceFragment The full fragment representing the completion
   * @param options Optional settings
   * @param options.ignoreWhitespace If true, ignores whitespace and blank lines when comparing (default: true)
   * @param options.mergeWhitespace If true, handles whitespace merging between fragments
   * @returns The remaining fragment of referenceFragment not yet present in this one,
   *          or null if this fragment doesn't match the start of referenceFragment
   */
  public getRemainingCompletion(
    referenceFragment: SourceFragment,
    options?: { ignoreWhitespace?: boolean; mergeWhitespace?: boolean },
  ): SourceFragment | null {
    const { ignoreWhitespace = true, mergeWhitespace = false } = options || {};

    // Delegate the matching logic to a helper class to keep this method clean.
    const completion = new SourceFragmentCompletion(this, referenceFragment);
    return completion.getRemainingFragment({
      ignoreWhitespace,
      mergeWhitespace,
    });
  }

  /**
   * Checks if this fragment ends with the start of another fragment.
   * @param referenceFragment The full fragment to compare against
   * @param options Optional settings
   * @param options.ignoreWhitespace If true, ignores whitespace and blank lines when comparing
   * @returns true if this fragment ends with the start of the full fragment
   */
  public endsWithStartOf(
    referenceFragment: SourceFragment,
    options?: { ignoreWhitespace?: boolean },
  ): boolean {
    // True if getRemainingCompletion returns non-null (i.e. a valid suffix).
    return this.getRemainingCompletion(referenceFragment, options) !== null;
  }

  /**
   * Checks if this fragment ends with the full content of another SourceFragment.
   * @param referenceFragment The fragment to compare against
   * @param options Optional settings
   * @param options.ignoreWhitespace If true, ignores whitespace and blank lines when comparing (default: true)
   * @returns True if this fragment ends with the other fragment
   */
  public endsWith(
    referenceFragment: SourceFragment,
    options?: { ignoreWhitespace?: boolean },
  ): boolean {
    const { ignoreWhitespace = true } = options || {};

    // Grab the lines to compare (prefix) and the last N lines of this fragment.
    const referenceLines = referenceFragment.getAsLines({ ignoreWhitespace });
    const endLines = this.tail(referenceLines.length, { ignoreWhitespace });

    // If the candidate suffix is longer than what we have, it can't match.
    if (referenceLines.length > endLines.length) return false;

    // Compare line by line for exact equality.
    for (let i = 0; i < referenceLines.length; i++) {
      if (referenceLines[i] !== endLines[i]) return false;
    }

    return true;
  }

  /**
   * Returns a new fragment that is truncated by removing overlap with another fragment
   * @param options Configuration for truncation
   * @param options.suffix Optional fragment to check for overlap with this fragment
   * @param options.range Optional range to limit the fragment
   * @param options.ignoreWhitespace If true, ignores whitespace when checking for overlap (default: true)
   * @param options.matchFromStart If true, requires matches to start at the beginning of lines (default: false)
   * @returns A new truncated SourceFragment
   */
  public getAsTruncatedFragment(options: {
    suffix?: SourceFragment;
    range?: SourceFragmentRange;
    ignoreWhitespace?: boolean;
    matchFromStart?: boolean;
  }): SourceFragment {
    const {
      suffix,
      range,
      ignoreWhitespace = true,
      matchFromStart = false,
    } = options;

    // First, apply any range slicing.
    let fragmentToTruncate = this.getAsFragment({ range });
    if (!suffix) return fragmentToTruncate;

    // Prepare the suffix lines for matching logic.
    const suffixLines = suffix.getAsLines({ ignoreWhitespace });
    if (suffixLines.length === 0) return fragmentToTruncate;

    // Identify the prefix we need to match on the first non-empty suffix line.
    const prefixToMatch = ignoreWhitespace
      ? suffixLines[0].trim()
      : suffixLines[0];
    const prefixLength = prefixToMatch.length;

    // Track best overlap match so we can cut precisely where overlap begins.
    let longestedMatchedLength = -1;
    let bestMatchLineIndex = -1;
    let bestMatchStartOffset = 0;

    let countedCharacters = 0;
    let lineIndex = 0;

    // Iterate through lines of our truncated fragment to find the deepest overlap.
    for (const line of fragmentToTruncate.iterateLines()) {
      const match = matchLineToCompletion(prefixToMatch, line, {
        ignoreWhitespace,
        matchFromStart,
      });
      if (match) {
        // Compute how many characters we’ve gone through to reach this point.
        const matchLength = countedCharacters + match.endOffset;
        if (matchLength > longestedMatchedLength) {
          longestedMatchedLength = matchLength;
          bestMatchLineIndex = lineIndex;
          bestMatchStartOffset = match.startOffset;
        }
      }
      countedCharacters += line.length + 1; // +1 for the newline separator
      lineIndex++;
    }

    // If no overlap found, just return the sliced fragment.
    if (bestMatchLineIndex < 0) return fragmentToTruncate;

    // Build a new range that cuts right where overlap starts.
    const adjustedRange: SourceFragmentRange = {
      startLine: 0,
      endLine: bestMatchLineIndex,
      endLineLimit: bestMatchStartOffset,
    };

    // Truncate everything before the overlap.
    return fragmentToTruncate.getAsFragment({ range: adjustedRange });
  }
}

/**
 * Private helper class to handle source fragment completion operations.
 */
class SourceFragmentCompletion {
  private sourceFragment: SourceFragment;
  private referenceFragment: SourceFragment;

  constructor(
    sourceFragment: SourceFragment,
    referenceFragment: SourceFragment,
  ) {
    this.sourceFragment = sourceFragment;
    this.referenceFragment = referenceFragment;
  }

  /**
   * Returns the tail of the reference fragment that hasn’t yet been matched
   * by the source fragment.
   *
   * @param options.ignoreWhitespace  
   *   If true, whitespace is ignored when finding the match (leading/trailing
   *   blank lines don’t prevent a match).
   * @param options.mergeWhitespace  
   *   If true, any trailing blank/indent-only lines in the source fragment are
   *   absorbed into the returned fragment.
   * @returns
   *   A `SourceFragment` for the unmatched portion, or `null` if there’s no match.
   */
  public getRemainingFragment(options: {
    ignoreWhitespace: boolean;
    mergeWhitespace: boolean;
  }): SourceFragment | null {
    const { ignoreWhitespace, mergeWhitespace } = options;

    let range;

    // We need to return null if the source fragment doesn't match
    const matchingRange = this.findMatchingRange(options);
    if (!matchingRange) return null;

    // If merging whitespace is requested, we may be able to absorb whitespace
    // at the seams in some cases between what is matched and what is left to
    // to complete. This lets leading indent on the line get counted as part
    // of the completion even if ignoreWhitespace is true.
    if (mergeWhitespace) {
      range = this.findIndentationMergeRange({ ignoreWhitespace });
      if (range) return this.referenceFragment.getAsFragment({ range });
    }

    // If the source fragment is empty, we should just return the entire reference fragment
    // If true,matchingRange at this point covers the entire reference fragment, but no
    // need to actually use it
    if (this.sourceFragment.getLineCount({ ignoreWhitespace }) === 0)
      return this.referenceFragment.getAsFragment();

    // If we ignore whitespace for matching, we still can't ignore it in the
    // output range, we still need to preserve any leading whitespace in the
    // returned fragment. Adjust the range so that whitespace the user has
    // already typed is attributed to the source fragment, not the completion.
    if (ignoreWhitespace) {
      const maxLines = Math.min(
        this.sourceFragment.getLineCount(),
        this.referenceFragment.getLineCount(),
      );

      range = this.offsetRangeByWhitespace(
        matchingRange,
        maxLines,
        mergeWhitespace,
      );
      if (!range) return null;
    } else {
      range = matchingRange;
    }

    return this.referenceFragment.getAsFragment({ range });
  }

  /**
   * Finds the best matching range between the source prefix and reference lines.
   */
  private findMatchingRange(options: {
    ignoreWhitespace: boolean;
  }): SourceFragmentRange | null {
    let bestMatchedRange: SourceFragmentRange | null = null;
    let longestMatchLength = -1;

    const { ignoreWhitespace } = options;

    // If the source fragment is empty, we should match the entire reference
    // fragment
    if (this.sourceFragment.getLineCount({ ignoreWhitespace }) === 0) {
      const [lastLine = ""] = this.referenceFragment.tail(1);

      return {
        startLine: 0,
        startLineOffset: 0,
        endLine: this.referenceFragment.getLineCount() - 1,
        endLineLimit: lastLine.length,
      };
    }

    const completionLines = this.referenceFragment.getAsLines();
    // Only consider as many lines as both fragments share at most.
    const maxLines = Math.min(
      this.sourceFragment.getLineCount(),
      this.referenceFragment.getLineCount(),
    );

    // Look at every possible trailing suffix of sourceFragment up to maxLines.
    for (const tail of this.sourceFragment.trailingLines(maxLines, {
      ignoreWhitespace,
    })) {
      // Try to align that tail against completionLines.
      const range = matchLinesToCompletion(tail, completionLines, {
        ignoreWhitespace,
        matchFromStart: true,
      });

      if (!range) continue;

      // Calculate how deep into the completion we matched.
      let matchLength = 0;
      for (let i = 0; i < range.startLine!; i++)
        matchLength += completionLines[i].length + 1;
      matchLength += range.startLineOffset!;

      // Keep the largest match (farthest into the completion).
      if (matchLength < longestMatchLength) continue;
      bestMatchedRange = range;
      longestMatchLength = matchLength;
    }

    return bestMatchedRange;
  }

  /**
   * Adjusts a completion range to account for trailing blank lines and
   * indentation in the source fragment.
   *
   * This method walks backward through up to `maxLines` of the source
   * fragment (preserving whitespace) to count:
   *   - `ignorableLines`: blank lines to skip entirely
   *   - `ignorableSpaces`: columns of trailing whitespace on the first
   *     blank or non-blank line encountered
   *
   * If `mergeWhitespace` is true, a blank but non-empty line contributes
   * its full length as `ignorableSpaces`; otherwise blank lines only
   * increment `ignorableLines`. When a non-blank line is reached, its
   * trailing indentation (or the last line’s indentation) becomes
   * `ignorableSpaces`.
   *
   * The original `range` is then offset by:
   *   - advancing `startLine` by `ignorableLines`
   *   - resetting `startLineOffset` to 0 if lines were skipped
   *   - adding `ignorableSpaces` to `startLineOffset`
   *
   * @param range
   *   The initial `SourceFragmentRange` to adjust.
   * @param maxLines
   *   The maximum number of lines to examine in the source fragment.
   * @param mergeWhitespace
   *   If true, capture whitespace on a blank but non-empty line as
   *   additional offset; otherwise treat blank lines purely as ignorable.
   * @returns
   *   A new `SourceFragmentRange` with its `startLine` and/or
   *   `startLineOffset` shifted to exclude trailing blanks and include
   *   any merged indentation.
   */
  private offsetRangeByWhitespace(
    range: SourceFragmentRange,
    maxLines: number,
    mergeWhitespace: boolean,
  ): SourceFragmentRange | null {
    let ignorableLines = 0;
    let ignorableSpaces = 0;

    // Walk backward through the original source to count trailing blanks/spaces.
    let iterateOptions = { backward: true, maxLines, ignoreWhitespace: false };
    for (const line of this.sourceFragment.iterateLines(iterateOptions)) {
      const lineIsBlank = line.trim().length === 0;
      const lineIsEmpty = line.length === 0;

      if (lineIsBlank) {
        // If merging whitespace, capture any whitespace on blank lines as ignorable indentation
        if (!lineIsEmpty && mergeWhitespace) {
          ignorableSpaces = line.length;
          break;
        }

        // otherwise, just ignore those blank lines wholesale
        ignorableLines++;
        continue;
      }

      // For the non-blank line we encounter, deduce how much trailing indentation it has
      // and absorb that amount of space from the remaining completion range
      const fullIndent = findLineIndent(line, { backward: true });
      const [lastLine] = this.sourceFragment.tail(1);
      const existingIndent = findLineIndent(lastLine, { backward: true });
      ignorableSpaces = existingIndent > 0 ? existingIndent : fullIndent;
      break;
    }

    const adjustedRange = { ...range };
    if (ignorableLines > 0) {
      adjustedRange.startLine! += ignorableLines;
      adjustedRange.startLineOffset! = 0;
    }
    if (ignorableSpaces > 0) adjustedRange.startLineOffset! += ignorableSpaces;

    return adjustedRange;
  }

  /**
   * Identifies trailing indentation-only lines in the source fragment and
   * merges that whitespace onto the start of the reference fragment,
   * returning a range that spans from the first indent-only source line
   * through the end of the reference fragment.
   *
   * This method iterates backward through the source fragment’s lines
   * (whitespace preserved) until it encounters non-blank content. Every
   * blank line forms the merge region. If `ignoreWhitespace` is true, the merge
   * width is capped to the indentation level of the matching line in the
   * reference fragment; otherwise it uses the full source indentation. The
   * resulting range
   * has:
   *   - `startLine`: index of the first indent-only source line
   *   - `startLineOffset`: number of columns of whitespace to merge
   *   - `endLine`: index of the last line in the reference fragment
   *   - `endLineLimit`: length of that last reference line
   *
   * Note: if source and reference fragments aren’t separated by blank or
   * whitespace-only lines, the computed range may not correspond to valid
   * code boundaries. It's important to call findMatchingRange first to
   * ensure there is a valid range to merge
   *
   * @param options.ignoreWhitespace
   *   When true, limit the merge width to the reference fragment’s
   *   indentation at the corresponding line; otherwise use the full source
   *   whitespace width.
   * @returns A `SourceFragmentRange` describing where to merge the indentation,
   *   or `null` if no trailing indent-only lines are found.
   */
  private findIndentationMergeRange(options: {
    ignoreWhitespace: boolean;
  }): SourceFragmentRange | null {
    const { ignoreWhitespace } = options;

    // walk backward through the source fragment looking
    // for all the candidate lines to merge with the reference
    let startLine = this.sourceFragment.getLineCount() - 1;
    for (const line of this.sourceFragment.iterateLines({
      backward: true,
      ignoreWhitespace: false,
    })) {
      const lineIsBlank = line.trim().length === 0;
      const lineIsEmpty = line.length === 0;

      if (lineIsEmpty) {
        startLine--;
        continue;
      }

      if (!lineIsBlank) break;

      // we’ve hit an indent-only line
      let startLineOffset;
      if (ignoreWhitespace) {
        // If we ignore whitespace, get indentation from the reference fragment
        let lineNumber;
        let range: SourceFragmentRange | undefined;
        if (startLine < this.referenceFragment.getLineCount())
          lineNumber = startLine;
        else lineNumber = this.referenceFragment.getLineCount() - 1;

        range = { startLine: lineNumber, endLine: lineNumber };

        const [referenceLine] = this.referenceFragment.getAsLines({ range });
        const referenceIndent = findLineIndent(referenceLine);

        startLineOffset = Math.min(line.length, referenceIndent);
      } else {
        startLineOffset = line.length;
      }

      const endLine = this.referenceFragment.getLineCount() - 1;
      const [lastLine] = this.referenceFragment.tail(1);

      return {
        startLine,
        startLineOffset,
        endLine,
        endLineLimit: lastLine.length,
      };
    }

    return null;
  }
}

type MatchOffset = {
  startOffset: number;
  endOffset: number;
};

/**
 * Helper function to match a single line prefix to a full line
 * and calculate the correct offset position.
 * @param lineFragment Part of the line to match
 * @param referenceLine The raw line from the full completion text
 * @param options.ignoreWhitespace If true, allows mid-line matches where the trimmed prefix sits on whitespace (default: true)
 * @param options.matchFromStart If true, requires exact start-of-line matches in exact mode (default: false)
 * @returns a MatchOffset object containing the start and end offsets of the matched line fragment in referenceLine, or null if no match
 */
function matchLineToCompletion(
  lineFragment: string,
  referenceLine: string,
  options?: { ignoreWhitespace?: boolean; matchFromStart?: boolean },
): MatchOffset | null {
  const { ignoreWhitespace = true, matchFromStart = false } = options || {};

  const lineFragmentLength = lineFragment.length;

  let match: MatchOffset | null = null;

  if (ignoreWhitespace) {
    // If the line is blank, return the full line
    if (lineFragment.trim().length === 0)
      return { startOffset: 0, endOffset: lineFragmentLength };

    const leadingIndentation = findLineIndent(referenceLine);
    const content = referenceLine.slice(leadingIndentation);

    // Scan across the line to find any matching slice of text.
    for (
      let startOffset = 0;
      startOffset + lineFragmentLength <= content.length;
      startOffset++
    ) {
      const endOffset = startOffset + lineFragmentLength;

      if (content.slice(startOffset, endOffset) === lineFragment) {
        match = { startOffset, endOffset };
        break;
      }

      if (matchFromStart) break;
    }

    if (!match) return null;

    // Translate back to full-line offset by adding back the leading indentation
    match.startOffset += leadingIndentation;
    match.endOffset += leadingIndentation;

    return match;
  }

  // From here on whitespace shouldn't be ignored

  if (matchFromStart) {
    // Require the line fragment to be at the start of the line
    if (!referenceLine.startsWith(lineFragment)) return null;

    return { startOffset: 0, endOffset: lineFragmentLength };
  }

  // Find where in the line the fragment is
  for (
    let startOffset = 0;
    startOffset + lineFragmentLength <= referenceLine.length;
    startOffset++
  ) {
    const endOffset = startOffset + lineFragmentLength;
    if (referenceLine.slice(startOffset, endOffset) === lineFragment) {
      match = { startOffset, endOffset };
      break;
    }
  }

  return match;
}

/**
 * Matches a list of lines to a list of reference lines and returns the
 * range of the reference lines that match the lines.
 * @param linesToMatch The list of lines to match
 * @param referenceLines The list of reference lines to match against
 * @param options.ignoreWhitespace If true, ignores whitespace when comparing (default: true)
 * @param options.matchFromStart If true, requires matches to start at the beginning of lines (default: true)
 * @returns The range of the reference lines that match the referencelines, or null if no match
 */
function matchLinesToCompletion(
  linesToMatch: string[],
  referenceLines: string[],
  options?: { ignoreWhitespace?: boolean; matchFromStart?: boolean },
): SourceFragmentRange | null {
  const { ignoreWhitespace = true, matchFromStart = true } = options || {};

  interface LineMapping {
    full: string;
    trimmed: string;
    index: number;
  }

  // Prepare mappings of reference lines to their trimmed equivalents if needed.
  const mappedReferenceLines: LineMapping[] = referenceLines
    .map((line, lineIndex) => ({
      full: line,
      trimmed: ignoreWhitespace ? line.trim() : line,
      index: lineIndex,
    }))
    // Optionally drop blank lines from matching.
    .filter((mapping) => !ignoreWhitespace || mapping.trimmed.length > 0);

  if (linesToMatch.length > mappedReferenceLines.length) return null;

  // If prefix is empty, we match everything.
  if (linesToMatch.length === 0) {
    const lastMapping = mappedReferenceLines[mappedReferenceLines.length - 1];
    return {
      startLine: 0,
      endLine: mappedReferenceLines.length - 1,
      startLineOffset: 0,
      endLineLimit: lastMapping.full.length,
    };
  }

  // Ensure all but the last line to match, match exactly in order.
  for (let i = 0; i < linesToMatch.length - 1; i++)
    if (mappedReferenceLines[i].trimmed !== linesToMatch[i]) return null;

  // For the last line to match, find the exact offset in that full line.
  const indexOfLastLineToMatch = linesToMatch.length - 1;
  const lastLineMapping = mappedReferenceLines[indexOfLastLineToMatch];
  const match = matchLineToCompletion(
    linesToMatch[indexOfLastLineToMatch],
    lastLineMapping.full,
    { ignoreWhitespace, matchFromStart },
  );
  if (!match) return null;

  // End at the last line in the reference text.
  const finalLineIndex =
    mappedReferenceLines[mappedReferenceLines.length - 1].index;
  return {
    startLine: lastLineMapping.index,
    startLineOffset: match.endOffset,
    endLine: finalLineIndex,
    endLineLimit: referenceLines[finalLineIndex].length,
  };
}

/**
 * Helper function to adjust lines based on whitespace options
 * @param lines Array of lines to process
 * @param options Optional settings
 * @param options.ignoreWhitespace If true, removes blank lines and trims non blank lines
 * @returns Processed array of lines
 */
function adjustLinesForWhitespace(
  lines: string[],
  options: { ignoreWhitespace: boolean },
): string[] {
  const { ignoreWhitespace = true } = options;
  // Apply trimming per line, then drop any that become empty when requested.
  return lines
    .map((line) => (ignoreWhitespace ? line.trim() : line))
    .filter((line) => (ignoreWhitespace ? line.length > 0 : true));
}

/**
 * Finds the indentation of a line.
 * @param line The line to find the indentation of
 * @param options.backward If true, find the indentation of the line from the end (default: false)
 * @returns The indentation of the line
 */
function findLineIndent(line: string, options?: { backward: boolean }): number {
  const { backward = false } = options || {};

  const trimmedLine = backward ? line.trimEnd() : line.trimStart();

  return line.length - trimmedLine.length;
}

export interface SourceFragmentRange {
  startLine: number;
  endLine: number;
  startLineOffset?: number;
  endLineLimit?: number;
}
