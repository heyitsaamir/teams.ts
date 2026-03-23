/** Data logged when the bot sends a feedback-enabled message */
export interface SentMessageData {
  /** The Teams message ID — used as the correlation key */
  messageId: string;
  /** The user's input message, if available (absent for proactive messages) */
  input?: string;
  /** The bot's AI-generated output */
  output: string;
  /** Optional metadata (model name, token usage, etc.) */
  metadata?: Record<string, unknown>;
}

/** Feedback score sent to the eval service */
export interface FeedbackScore {
  reaction: 'like' | 'dislike';
  /** Raw feedback string from Teams, e.g. '{"feedbackText":"Nice!"}' */
  comment: string;
}

/**
 * Provider interface — implement this for each eval service.
 * The messageId is used as the correlation key between trace and feedback.
 * Providers like LangSmith/LangFuse support custom IDs natively.
 * Foundry provider handles OpenTelemetry span context internally.
 */
export interface IFeedbackProvider {
  /** Log a sent message (AI input/output). Use messageId as the correlation key. */
  logSentMessage(data: SentMessageData): Promise<void>;
  /** Attach feedback to a previously logged message by messageId. */
  logFeedback(messageId: string, score: FeedbackScore): Promise<void>;
}

/** Plugin constructor options */
export interface FeedbackPluginOptions {
  provider: IFeedbackProvider;
}
