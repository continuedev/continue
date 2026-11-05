import { selectCacheSetting } from "../../redux/selectors/selectCacheSetting";
import type { JSONContent } from "@tiptap/react";
import { useEffect, useState } from "react";
import { useNow } from "../../hooks/useNow";
import { useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";
import {
  formatTokens,
  formatUsd,
  perMessageCost,
} from "../../util/cacheNotices";
import { LARGE_MESSAGE_TOKENS } from "../../util/cacheSafeguards";
import { promptCacheStatus } from "../../util/promptCache";
import { NoticeBar } from "./NoticeBar";
import { useMainEditor } from "./TipTapEditor";
import { processEditorContent } from "./TipTapEditor/utils/processEditorContent";

/** A rough token count for one image. Real counts depend on its size. */
const TOKENS_PER_IMAGE = 1_500;
const CHARS_PER_TOKEN = 4;

/**
 * A rough size of what the user has typed, pasted or attached as code blocks
 * and images. Files added with @ are only fetched when the message is sent, so
 * they are not counted.
 */
export function estimateEditorTokens(editorState: JSONContent): number {
  const { parts } = processEditorContent(editorState);
  let tokens = 0;
  for (const part of parts) {
    if (part.type === "text") {
      tokens += Math.ceil(part.text.length / CHARS_PER_TOKEN);
    } else if (part.type === "imageUrl") {
      tokens += TOKENS_PER_IMAGE;
    }
  }
  return tokens;
}

/** The notice itself, separate from the editor so it can be tested alone. */
export function LargeMessageNoticeView(props: {
  tokens: number;
  onDismiss: () => void;
}) {
  const model = useAppSelector(selectSelectedChatModel);
  const setting = useAppSelector(selectCacheSetting);
  const state = useAppSelector((s) => s.session.promptCache);
  const now = useNow();
  if (!model) return null;

  const status = promptCacheStatus(
    model,
    setting,
    state ?? { escalated: false },
    now,
  );
  const cost = perMessageCost(model, props.tokens, status.ttl);
  const size = `about ${formatTokens(props.tokens)} tokens`;
  const text =
    status.on && cost
      ? `This message is ${size}. Sending it writes it to the prompt cache (about ${formatUsd(cost.coldUsd)}), and every later message in this session re-reads it (about ${formatUsd(cost.warmUsd)} each).`
      : `This message is ${size}. It is sent again with every later message in this session.`;

  return (
    <NoticeBar testId="large-message-notice" onDismiss={props.onDismiss}>
      <span>
        {text} Attaching only the relevant part, or starting a new session for
        an unrelated task, costs less.
      </span>
    </NoticeBar>
  );
}

/**
 * Shown above the input while the draft is big enough to matter. Dismissed
 * for that draft; a new draft that crosses the size shows it again.
 */
export function LargeMessageNotice() {
  const { mainEditor } = useMainEditor();
  const [tokens, setTokens] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | undefined>();

  useEffect(() => {
    if (!mainEditor) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      // Counting runs on every keystroke, so wait until typing pauses.
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = estimateEditorTokens(mainEditor.getJSON());
        setTokens(next);
        if (next < LARGE_MESSAGE_TOKENS) setDismissedAt(undefined);
      }, 300);
    };
    mainEditor.on("update", update);
    update();
    return () => {
      clearTimeout(timer);
      mainEditor.off("update", update);
    };
  }, [mainEditor]);

  if (tokens < LARGE_MESSAGE_TOKENS || dismissedAt !== undefined) return null;
  return (
    <LargeMessageNoticeView
      tokens={tokens}
      onDismiss={() => setDismissedAt(tokens)}
    />
  );
}
