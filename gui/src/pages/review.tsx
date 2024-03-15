import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid";
import { ReviewResult } from "core/review/review";
import { getBasename } from "core/util";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";
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
      {open && <p className="px-4"> {props.result.message} </p>}
    </div>
  );
}

function Review() {
  useNavigationListener();
  const navigate = useNavigate();
  const dispatch = useDispatch();

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
    <div>
      <h1>Code Review</h1>

      <div>
        {reviewResults.map((result, index) => {
          return <FileResult result={result} key={index} />;
        })}
      </div>
    </div>
  );
}

export default Review;
