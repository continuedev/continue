import { EventEmitter } from "events";

import {
  PendingQuestion,
  QuestionAnsweredEvent,
  QuestionRequestedEvent,
  QuizQuestion,
  QuizServiceState,
} from "./types.js";

export class QuizService extends EventEmitter {
  private pendingRequests = new Map<
    string,
    {
      question: QuizQuestion;
      resolve: (answer: string) => void;
    }
  >();

  private currentState: QuizServiceState = {
    pendingQuestion: null,
  };

  /**set a pending question to be answered and return a promise that resolves when the question is answered */
  async askQuestion(question: QuizQuestion): Promise<string> {
    const requestId = `quiz-${Date.now()}`;

    return new Promise<string>((resolve) => {
      const pendingQuestion: PendingQuestion = {
        ...question,
        requestId,
        timestamp: Date.now(),
      };

      this.pendingRequests.set(requestId, {
        question,
        resolve,
      });

      this.currentState.pendingQuestion = pendingQuestion;

      const event: QuestionRequestedEvent = {
        requestId,
        question,
      };

      this.emit("questionRequested", event);
    });
  }

  /**answer the pending question request and resolve the answer */
  answerQuestion(
    requestId: string,
    answer: string,
    isCustomAnswer = false,
  ): boolean {
    const pending = this.pendingRequests.get(requestId);
    if (!pending) {
      return false;
    }

    this.pendingRequests.delete(requestId);
    this.currentState.pendingQuestion = null;

    const event: QuestionAnsweredEvent = {
      requestId,
      answer,
      isCustomAnswer,
    };

    this.emit("questionAnswered", event);
    pending.resolve(answer);

    return true;
  }

  async initialize(): Promise<QuizServiceState> {
    this.currentState = {
      pendingQuestion: null,
    };
    this.pendingRequests.clear();
    return this.currentState;
  }
}

export const quizService = new QuizService();
