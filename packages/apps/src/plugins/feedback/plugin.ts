import { ConsoleLogger } from '@microsoft/teams.common';

import pkg from '../../../package.json';
import { Plugin } from '../../types';
import { IPluginActivityEvent } from '../../types/plugin/plugin-activity-event';
import { IPluginActivitySentEvent } from '../../types/plugin/plugin-activity-sent-event';

import { FeedbackPluginOptions, IFeedbackProvider } from './types';

@Plugin({
  name: 'feedback',
  version: pkg.version,
  description: 'Auto-captures AI traces and feedback, piping to eval services',
})
export class FeedbackPlugin {
  private readonly provider: IFeedbackProvider;
  private readonly log = new ConsoleLogger('@microsoft/teams.apps/plugins/feedback');
  private readonly inputs = new Map<string, string>();

  constructor(options: FeedbackPluginOptions) {
    this.provider = options.provider;
  }

  async onActivity(event: IPluginActivityEvent) {
    const { activity } = event;

    if (activity.type === 'message') {
      this.inputs.set(activity.conversation.id, activity.text);
      return;
    }

    if (
      activity.type === 'invoke' &&
      activity.name === 'message/submitAction' &&
      activity.value?.actionName === 'feedback'
    ) {
      const replyToId = activity.replyToId;

      if (!replyToId) {
        this.log.warn(`No replyToId found for feedback activity ${activity.id}`);
        return;
      }

      const { reaction, feedback: comment } = activity.value.actionValue;
      await this.provider.logFeedback(replyToId, { reaction, comment });
    }
  }

  async onActivitySent(event: IPluginActivitySentEvent) {
    const { activity } = event;

    if (!activity.channelData?.feedbackLoopEnabled) {
      return;
    }

    const input = this.inputs.get(event.conversation.id);
    this.inputs.delete(event.conversation.id);

    await this.provider.logSentMessage({
      messageId: activity.id,
      input,
      output: (activity as any).text ?? '',
    });
  }
}
