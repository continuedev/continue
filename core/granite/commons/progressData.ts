export interface ProgressData {
  key: string;
  increment: number,
  status: string;
  completed?: number; // number of bits already completed
  total?: number; // total number of bits
}