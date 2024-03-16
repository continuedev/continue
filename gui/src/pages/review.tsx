import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { ReviewResult } from "core/review/review";
import { getBasename } from "core/util";
import { useEffect, useState } from "react";
import styled from "styled-components";
import { Button } from "../components";
import StyledMarkdownPreview from "../components/markdown/StyledMarkdownPreview";
import { useNavigationListener } from "../hooks/useNavigationListener";
import { useWebviewListener } from "../hooks/useWebviewListener";
import { ideRequest } from "../util/ide";

const FileHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px;
  padding-left: 10px;
  padding-right: 10px;
  border-top: 0.5px solid #888;
  border-bottom: 0.5px solid #888;
  cursor: pointer;

  &:hover {
    background-color: #8883;
  }
`;

interface FileHeaderProps {
  result: ReviewResult;
}

function FileResult(props: FileHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <FileHeader onClick={() => setOpen((prev) => !prev)}>
        {open ? (
          <ChevronDownIcon width="1.2em" height="1.2em" />
        ) : (
          <ChevronRightIcon width="1.2em" height="1.2em" />
        )}

        {props.result.status === "pending" ? (
          <ClockIcon width="1.2em" height="1.2em" color="yellow" />
        ) : props.result.status === "good" ? (
          <CheckCircleIcon width="1.2em" height="1.2em" color="lightgreen" />
        ) : (
          <XCircleIcon width="1.2em" height="1.2em" color="red" />
        )}

        {getBasename(props.result.filepath, 2)}
      </FileHeader>
      {open && (
        <StyledMarkdownPreview
          showCodeBorder={true}
          source={props.result.message}
        ></StyledMarkdownPreview>
      )}
    </div>
  );
}

function Review() {
  useNavigationListener();
  const [reviewResults, setReviewResults] = useState<ReviewResult[]>([]);

  useEffect(() => {
    ideRequest("review/getResults", undefined).then((results) => {
      setReviewResults(results);
    });
  }, []);

  useWebviewListener("review/update", async (updates) => {
    setReviewResults((prevs) => {
      const finalResults = [];
      for (const prev of prevs) {
        const updated = updates.find(
          (update) => update.filepath === prev.filepath,
        );
        if (updated !== undefined) {
          finalResults.push(updated);
        } else {
          finalResults.push(prev);
        }
      }
      return finalResults;
    });
  });

  return (
    <div className="px-2">
      <h2>Code Review (experimental)</h2>
      <Button
        onClick={() => {
          ideRequest("review/redoAll", undefined);
        }}
      >
        Redo All
      </Button>

      <div>
        {reviewResults.length > 0 ? (
          reviewResults.map((result, index) => {
            return <FileResult result={result} key={index} />;
          })
        ) : (
          <i>
            Results will appear after you have changed files within this git
            repository
          </i>
        )}
      </div>
    </div>
  );
}

export default Review;
