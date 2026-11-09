import { afterEach, describe, expect, it } from "vitest";

import {
  formatReplyTally,
  getTruncatedReplies,
  recordTruncatedReply,
  resetReplyTally,
} from "./replyTally.js";

afterEach(() => resetReplyTally());

describe("reply tally", () => {
  it("says nothing until a reply was cut off", () => {
    expect(getTruncatedReplies()).toBe(0);
    expect(formatReplyTally()).toBeUndefined();
  });

  it("counts cut-off replies and reports them", () => {
    recordTruncatedReply();
    recordTruncatedReply();
    expect(getTruncatedReplies()).toBe(2);
    expect(formatReplyTally()).toBe("Replies cut off at the output limit: 2");
  });
});
