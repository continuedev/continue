export interface TestSetItem {
  repo: string;
  query: string;
  /** Paths to expected files relative to root of repo */
  groundTruthFiles: string[];
}
