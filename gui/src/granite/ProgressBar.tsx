import React, { useEffect, useState } from "react";
import { ProgressData } from "core/granite/commons/progressData";
import { formatSize, formatTime } from 'core/granite/commons/textUtils';
import { MB } from "core/granite/commons/sizeUtils";

// The ProgressBar component
const ProgressBar: React.FC<{ data: ProgressData; id: string }> = ({ data, id }) => {
  const [speed, setSpeed] = useState(0); // MB/s
  const [, setElapsedTime] = useState(0); // Time since start in seconds
  const [previousCompleted, setPreviousCompleted] = useState(data.completed); // Store previous completed value to calculate speed
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [speedHistory, setSpeedHistory] = useState<number[]>([]);

  const SPEED_HISTORY_LENGTH = 50; // Number of data points to use for smoothing

  const [status, setStatus] = useState("");
  const [completedSize, setCompletedSize] = useState("0 MB");
  const [totalSize, setTotalSize] = useState("0 MB");
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [estimatedCompletion, setEstimatedCompletion] = useState("0s");

  useEffect(() => {
    if (data.key !== id) {
      return;
    }
    const now = Date.now();
    const timeDiff = (now - lastUpdateTime) / 1000; // Convert to seconds

    // Calculate speed in MB/s
    const completedMB = data.completed !== undefined ? data.completed / MB : 0;
    const prevCompletedMB = previousCompleted !== undefined ? previousCompleted / MB : 0;
    const deltaMB = Math.max(0, completedMB - prevCompletedMB); // Ensure non-negative delta
    setStatus(data.status);
    // Update speed (MB/s)
    const newSpeed = timeDiff > 0 ? deltaMB / timeDiff : 0;

    // Update speed history
    setSpeedHistory(prevHistory => {
      const updatedHistory = [...prevHistory, newSpeed].slice(-SPEED_HISTORY_LENGTH);
      const averageSpeed = updatedHistory.reduce((sum, speed) => sum + speed, 0) / updatedHistory.length;
      setSpeed(Math.max(0, averageSpeed)); // Ensure non-negative average speed
      return updatedHistory;
    });

    setElapsedTime((prev) => prev + timeDiff);
    setPreviousCompleted(data.completed);
    setLastUpdateTime(now);

    // Update size and progress information
    setCompletedSize(formatSize(data.completed || 0, 2));
    setTotalSize(formatSize(data.total || 0, 2));
    setProgressPercentage(data.completed !== undefined && data.total !== undefined ? (data.completed / data.total) * 100 : 0);

    const remainingBits = data.total !== undefined && data.completed !== undefined ? data.total - data.completed : 0;
    const remainingSeconds = remainingBits > 0 && speed > 0 ? remainingBits / (speed * MB) : 0;
    setEstimatedCompletion(formatTime(remainingSeconds));
  }, [data.status, data.completed]);



  useEffect(() => {
    // Reset all state for new download
    setStatus("");
    setSpeed(0);
    setElapsedTime(0);
    setPreviousCompleted(0);
    setLastUpdateTime(0);
    setSpeedHistory([]);
    // Reset new state variables
    setCompletedSize("");
    setTotalSize("");
    setProgressPercentage(0);
    setEstimatedCompletion("Universe heat death");
  }, [id]);

  if (!data || data.key !== id || data.status?.toLowerCase() === 'success') {
    return <></>;
  }

  return (
    <div style={{ margin: '5px' }}>
      <label className="progress-status">
        {status}
        <div style={{ fontSize: '12px', marginLeft: 'auto' }}>
          {data.completed! < data.total! && `est. time: ~${estimatedCompletion}`}
        </div>
      </label>
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '10px', marginTop: '5px' }}>
        <div style={{
          flex: '0 0 100%',
          marginRight: '10px'
        }} >
          <div style={{
            height: "8px",
            backgroundColor: "#e0e0df",
            borderRadius: "5px",
          }}>
            <div className="progress-bar"
              style={{
                width: `${progressPercentage}%`,
                height: '100%',
                borderRadius: '5px'
              }}
            />
          </div>
          {data.total && (
            <div style={{ textAlign: 'right', fontSize: '10px', margin: '5px 0' }}>
              {formatSize(data.completed || 0, 2).padStart(10)} / {formatSize(data.total, 2).padStart(10)} at {speed.toFixed(2).padStart(7)} MB/s
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressBar;
