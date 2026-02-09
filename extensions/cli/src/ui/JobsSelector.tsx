import { Box, Text, useInput } from "ink";
import React, { useEffect, useState } from "react";

import {
  BackgroundJob,
  backgroundJobManager,
} from "../services/BackgroundJobManager.js";
import { truncateOutputFromStart } from "../util/truncateOutput.js";

import { defaultBoxStyles } from "./styles.js";

interface JobsSelectorProps {
  onCancel: () => void;
}

type ViewMode = "list" | "detail";

function getStatusColor(status: BackgroundJob["status"]): string {
  if (status === "running" || status === "pending") return "yellow";
  if (status === "completed") return "green";
  return "red";
}

function formatDuration(job: BackgroundJob): string {
  const endTime = job.endTime ? job.endTime.getTime() : Date.now();
  return `${Math.round((endTime - job.startTime.getTime()) / 1000)}s`;
}

export function JobsSelector({ onCancel }: JobsSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedJob, setSelectedJob] = useState<BackgroundJob | null>(null);
  const [jobs, setJobs] = useState(() => backgroundJobManager.getAllJobs());

  // Refetch the job details every 1 second
  useEffect(() => {
    const interval = setInterval(() => {
      if (viewMode === "detail" && selectedJob) {
        const freshJob = backgroundJobManager.getJob(selectedJob.id);
        if (freshJob) {
          setSelectedJob(freshJob);
        }
      } else {
        setJobs(backgroundJobManager.getAllJobs());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useInput((input, key) => {
    // Handle key input when viewing job details
    if (viewMode === "detail") {
      // Go back to list view
      if (key.escape || input === "b") {
        setViewMode("list");
        setSelectedJob(null);
        return;
      }
      // Cancel the selected job if it's still active
      if (input === "x" && selectedJob) {
        const job = backgroundJobManager.getJob(selectedJob.id);
        if (job && (job.status === "running" || job.status === "pending")) {
          backgroundJobManager.cancelJob(selectedJob.id);
        }
        return;
      }
      return;
    }

    // Handle key input when viewing job list
    if (key.escape || (key.ctrl && input === "c")) {
      onCancel();
      return;
    }

    // Navigate up and down the job list
    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : jobs.length - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < jobs.length - 1 ? prev + 1 : 0));
      return;
    }

    // Select a job to view its details
    if (key.return && jobs[selectedIndex]) {
      setSelectedJob(jobs[selectedIndex]);
      setViewMode("detail");
      return;
    }
  });

  if (jobs.length === 0) {
    return (
      <Box {...defaultBoxStyles("blue")}>
        <Text color="blue" bold>
          Background Jobs
        </Text>
        <Text> </Text>
        <Text color="gray">No background jobs</Text>
        <Text> </Text>
        <Text color="gray">Press Esc to go back</Text>
      </Box>
    );
  }

  if (viewMode === "detail" && selectedJob) {
    const freshJob = selectedJob;
    const { output: lastOutput } = truncateOutputFromStart(freshJob.output, {
      maxLines: 10,
      maxChars: 2000,
    });

    return (
      <Box {...defaultBoxStyles("blue")} flexDirection="column">
        <Text color="blue" bold>
          Job Details
        </Text>
        <Text color="gray">Press Esc/b to go back, x to cancel job</Text>
        <Text> </Text>

        <Box flexDirection="row" gap={1}>
          <Text color="gray">ID:</Text>
          <Text color="cyan">{freshJob.id}</Text>
        </Box>

        <Box flexDirection="row" gap={1}>
          <Text color="gray">Status:</Text>
          <Text color={getStatusColor(freshJob.status)}>{freshJob.status}</Text>
        </Box>

        <Box flexDirection="row" gap={1}>
          <Text color="gray">Duration:</Text>
          <Text>{formatDuration(freshJob)}</Text>
        </Box>

        <Box flexDirection="row" gap={1}>
          <Text color="gray">Command:</Text>
          <Text>{freshJob.command}</Text>
        </Box>

        {freshJob.exitCode !== null && (
          <Box flexDirection="row" gap={1}>
            <Text color="gray">Exit Code:</Text>
            <Text color={freshJob.exitCode === 0 ? "green" : "red"}>
              {freshJob.exitCode}
            </Text>
          </Box>
        )}

        {freshJob.error && (
          <Box flexDirection="row" gap={1}>
            <Text color="gray">Error:</Text>
            <Text color="red">{freshJob.error}</Text>
          </Box>
        )}

        <Text> </Text>
        <Text color="gray">Last 10 lines of output:</Text>
        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <Text>{lastOutput || "(no output)"}</Text>
        </Box>
      </Box>
    );
  }

  // List screen
  return (
    <Box {...defaultBoxStyles("blue")}>
      <Text color="blue" bold>
        Background Jobs ({jobs.length})
      </Text>
      <Text color="gray">
        ↑/↓ to navigate, Enter to view details, Esc to exit
      </Text>
      <Text> </Text>

      {jobs.map((job, index) => {
        const isSelected = index === selectedIndex;
        const prefix = isSelected ? "❯ " : "  ";

        return (
          <Box key={job.id} flexDirection="row" gap={1}>
            <Text color={isSelected ? "cyan" : undefined}>{prefix}</Text>
            <Text color={getStatusColor(job.status)}>
              {job.status.padEnd(10)}
            </Text>
            <Text color="cyan">{job.id}</Text>
            <Text color="gray">({formatDuration(job)})</Text>
            <Text>
              {job.command.substring(0, 30)}
              {job.command.length > 30 ? "..." : ""}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
