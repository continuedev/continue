import { GB, MB } from "./sizeUtils";

export const DEFAULT_MODEL_INFO = new Map<string, ModelInfo>();
[
  {
    id: "nomic-embed-text:latest",
    size: 274 * MB,
    digest: "",
  },
  {
    id: "granite3.3:2b",
    size: 1.5 * GB,
    digest: "",
  },
  {
    id: "ibm/granite3.3:2b-base",
    size: 1.5 * GB,
    digest: "",
  },
  {
    id: "granite3.3:8b",
    size: 4.9 * GB,
    digest: "",
  },
].forEach((m: ModelInfo) => {
  DEFAULT_MODEL_INFO.set(m.id, m);
});

export interface ModelInfo {
  id: string;
  size: number;
  digest: string;
}
