import {
  ArrowPathIcon,
  CheckCircleIcon,
  PauseCircleIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { IndexingStatus } from "core";

export const STATUS_TO_ICON: Record<IndexingStatus["status"], any> = {
  indexing: ArrowPathIcon,
  paused: PauseCircleIcon,
  complete: CheckCircleIcon,
  aborted: null,
  deleted: null,
  pending: null,
  failed: null, // XMarkIcon, // Since we show an error message below
};
