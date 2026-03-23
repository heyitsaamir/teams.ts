import { ChatPrompt, IChatModel } from '@microsoft/teams.ai';
import {
  ActivityLike,
  IMessageActivity,
  MessageActivity,
  SentActivity,
} from '@microsoft/teams.api';
import { IFeedbackProvider, SentMessageData, FeedbackScore } from '@microsoft/teams.apps';
import { ConsoleLogger } from '@microsoft/teams.common';

/**
 * Simple in-memory feedback provider for demo purposes.
 * In production, use a provider for LangSmith, LangFuse, Braintrust, or Azure AI Foundry.
 */
export class InMemoryFeedbackProvider implements IFeedbackProvider {
  readonly messages = new Map<string, SentMessageData>();
  readonly feedback = new Map<string, FeedbackScore[]>();
  private readonly log = new ConsoleLogger('@tests/ai/feedback-provider');

  async logSentMessage(data: SentMessageData): Promise<void> {
    this.messages.set(data.messageId, data);
    this.log.info(`Message logged for ${data.messageId}: input=${data.input}, output=${data.output}`);
  }

  async logFeedback(messageId: string, score: FeedbackScore): Promise<void> {
    const existing = this.feedback.get(messageId) ?? [];
    existing.push(score);
    this.feedback.set(messageId, existing);
    this.log.info(`Feedback logged for ${messageId}: ${score.reaction}`);
  }
}

export const feedbackProvider = new InMemoryFeedbackProvider();

export const handleFeedbackLoop = async (
  model: IChatModel,
  activity: IMessageActivity,
  send: (activity: ActivityLike) => Promise<SentActivity>
) => {
  const prompt = new ChatPrompt({
    instructions: 'You are a helpful assistant.',
    model,
  });

  const result = await prompt.send(activity.text);

  if (result) {
    await send(
      result.content != null
        ? new MessageActivity(result.content)
            .addAiGenerated()
            /** Add feedback buttons via this method */
            .addFeedback()
        : 'I did not generate a response.'
    );
  }
};
