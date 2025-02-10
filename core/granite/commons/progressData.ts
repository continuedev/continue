export interface ProgressData {
  key: string;
  increment: number;
  status?: string;
  completed?: number; // number of bytes already completed
  total?: number; // total number of bytes
}

export interface ProgressReporter {
  begin(name: string, total: number): void;
  update(work: number, details?: string): void;
  done(): void;
}
