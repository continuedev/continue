import { Box, Text } from "ink";
import React, { useEffect, useState } from "react";

import { services } from "../../services/index.js";
import { ResourceUsage } from "../../services/ResourceMonitoringService.js";

interface ResourceDebugBarProps {
  visible: boolean;
}

function formatBytes(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${(bytes / 1024).toFixed(1)}KB`;
}

function formatPercent(percent: number): string {
  return `${Math.round(percent)}%`;
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ResourceDebugBar({ visible }: ResourceDebugBarProps) {
  const [resourceData, setResourceData] = useState<ResourceUsage | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!visible) return;

    const updateResourceData = () => {
      try {
        const usage = services.resourceMonitoring.getCurrentResourceUsage();
        setResourceData(usage);
        setIsError(false);
      } catch {
        setIsError(true);
      }
    };

    // Initial update
    updateResourceData();

    // Update every 2 seconds
    const intervalId = setInterval(updateResourceData, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [visible]);

  if (!visible) {
    return null;
  }

  if (isError) {
    return (
      <Box paddingX={1}>
        <Text color="red">Resource monitoring error</Text>
      </Box>
    );
  }

  if (!resourceData) {
    return null;
  }

  const memoryPercent =
    (resourceData.memory.rss / resourceData.system.totalMemory) * 100;
  const cpuPercent = resourceData.cpu.percent || 0;
  const heapPercent =
    (resourceData.memory.heapUsed / resourceData.memory.heapTotal) * 100;

  // Color coding based on usage levels
  const getMemoryColor = () => {
    if (memoryPercent > 80) return "red";
    if (memoryPercent > 60) return "yellow";
    return "green";
  };

  const getCpuColor = () => {
    if (cpuPercent > 80) return "red";
    if (cpuPercent > 60) return "yellow";
    return "green";
  };

  const getEventLoopColor = () => {
    if (resourceData.eventLoop.lag > 100) return "red";
    if (resourceData.eventLoop.lag > 50) return "yellow";
    return "green";
  };

  return (
    <Box paddingX={1}>
      <Text color="gray">Debug: </Text>

      <Text color={getMemoryColor()}>
        MEM: {formatBytes(resourceData.memory.rss)}
      </Text>
      <Text color="gray"> | </Text>

      <Text color="gray">HEAP: {formatPercent(heapPercent)}</Text>
      <Text color="gray"> | </Text>

      <Text color={getCpuColor()}>CPU: {formatPercent(cpuPercent)}</Text>
      <Text color="gray"> | </Text>

      <Text color={getEventLoopColor()}>
        LAG: {formatTime(resourceData.eventLoop.lag)}
      </Text>

      {resourceData.fileDescriptors && (
        <>
          <Text color="gray"> | </Text>
          <Text color="gray">FD: {resourceData.fileDescriptors}</Text>
        </>
      )}

      <Text color="gray"> | </Text>
      <Text color="gray">
        UP: {formatTime(resourceData.system.uptime * 1000)}
      </Text>
    </Box>
  );
}

export function ResourceDebugDetails({ visible }: { visible: boolean }) {
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    if (!visible) return;

    const updateData = () => {
      try {
        const summaryData = services.resourceMonitoring.getResourceSummary();
        setSummary(summaryData);
      } catch {
        // Handle error silently
      }
    };

    updateData();
    const intervalId = setInterval(updateData, 3000);

    return () => clearInterval(intervalId);
  }, [visible]);

  if (!visible || !summary) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="gray"
      paddingX={1}
      marginTop={1}
    >
      <Text color="cyan" bold>
        Resource Usage Summary
      </Text>

      <Box marginTop={1}>
        <Text color="gray">Current: </Text>
        <Text>{formatBytes(summary.current.memory.rss)} mem, </Text>
        <Text>{formatPercent(summary.current.cpu.percent || 0)} cpu</Text>
      </Box>

      <Box>
        <Text color="gray">Peak: </Text>
        <Text>{formatBytes(summary.peak.memory)} mem, </Text>
        <Text>{formatPercent(summary.peak.cpu)} cpu</Text>
      </Box>

      <Box>
        <Text color="gray">Average: </Text>
        <Text>{formatBytes(summary.average.memory)} mem, </Text>
        <Text>{formatPercent(summary.average.cpu)} cpu</Text>
      </Box>
    </Box>
  );
}
