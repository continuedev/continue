export interface QuizQuestion {
  question: string;
  options?: string[];
  defaultAnswer?: string;
}

export interface PendingQuestion extends QuizQuestion {
  requestId: string;
  timestamp: number;
}

export interface QuizAnswer {
  requestId: string;
  answer: string;
  isCustomAnswer: boolean;
}

export interface QuizServiceState {
  pendingQuestion: PendingQuestion | null;
}

export interface QuestionRequestedEvent {
  requestId: string;
  question: QuizQuestion;
}

export interface QuestionAnsweredEvent {
  requestId: string;
  answer: string;
  isCustomAnswer: boolean;
}
