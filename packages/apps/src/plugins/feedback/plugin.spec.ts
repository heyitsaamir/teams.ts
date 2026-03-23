import { IPluginActivityEvent } from '../../types/plugin/plugin-activity-event';
import { IPluginActivitySentEvent } from '../../types/plugin/plugin-activity-sent-event';

import { FeedbackPlugin } from './plugin';
import { IFeedbackProvider } from './types';

function mockProvider(): jest.Mocked<IFeedbackProvider> {
  return {
    logSentMessage: jest.fn().mockResolvedValue(undefined),
    logFeedback: jest.fn().mockResolvedValue(undefined),
  };
}

function messageEvent(conversationId: string, text: string): IPluginActivityEvent {
  return {
    activity: {
      type: 'message',
      text,
      id: `msg-${Date.now()}`,
      from: { id: 'user-1', name: 'User' },
      recipient: { id: 'bot-1', name: 'Bot' },
      conversation: { id: conversationId },
      channelId: 'msteams',
      serviceUrl: 'https://test.botframework.com',
    },
    token: {
      appId: 'test-app',
      serviceUrl: 'https://test.botframework.com',
      from: 'bot' as const,
      fromId: 'test-from',
      toString: () => 'test-token',
      isExpired: () => false,
    },
    serviceUrl: 'https://test.botframework.com',
    channelId: 'msteams',
    bot: { id: 'bot-1', name: 'Bot' },
    conversation: { id: conversationId },
    user: { id: 'user-1', name: 'User' },
  } as unknown as IPluginActivityEvent;
}

function feedbackInvokeEvent(replyToId: string | undefined, reaction: 'like' | 'dislike', feedback: string): IPluginActivityEvent {
  return {
    activity: {
      type: 'invoke',
      name: 'message/submitAction',
      id: `invoke-${Date.now()}`,
      replyToId,
      value: {
        actionName: 'feedback',
        actionValue: { reaction, feedback },
      },
      from: { id: 'user-1', name: 'User' },
      recipient: { id: 'bot-1', name: 'Bot' },
      conversation: { id: 'conv-1' },
      channelId: 'msteams',
      serviceUrl: 'https://test.botframework.com',
    },
    token: {
      appId: 'test-app',
      serviceUrl: 'https://test.botframework.com',
      from: 'bot' as const,
      fromId: 'test-from',
      toString: () => 'test-token',
      isExpired: () => false,
    },
    serviceUrl: 'https://test.botframework.com',
    channelId: 'msteams',
    bot: { id: 'bot-1', name: 'Bot' },
    conversation: { id: 'conv-1' },
    user: { id: 'user-1', name: 'User' },
  } as unknown as IPluginActivityEvent;
}

function sentEvent(conversationId: string, messageId: string, text: string, feedbackLoopEnabled: boolean): IPluginActivitySentEvent {
  return {
    activity: {
      id: messageId,
      type: 'message',
      text,
      channelData: feedbackLoopEnabled ? { feedbackLoopEnabled: true } : undefined,
    },
    serviceUrl: 'https://test.botframework.com',
    channelId: 'msteams',
    bot: { id: 'bot-1', name: 'Bot' },
    conversation: { id: conversationId },
    user: { id: 'user-1', name: 'User' },
  } as unknown as IPluginActivitySentEvent;
}

describe('FeedbackPlugin', () => {
  it('should auto-capture user input on incoming message activities', async () => {
    const provider = mockProvider();
    const plugin = new FeedbackPlugin({ provider });

    await plugin.onActivity(messageEvent('conv-1', 'Hello AI'));
    await plugin.onActivitySent(sentEvent('conv-1', 'sent-1', 'Hi there!', true));

    expect(provider.logSentMessage).toHaveBeenCalledWith({
      messageId: 'sent-1',
      input: 'Hello AI',
      output: 'Hi there!',
    });
  });

  it('should pass correct messageId, input, output to provider.logSentMessage', async () => {
    const provider = mockProvider();
    const plugin = new FeedbackPlugin({ provider });

    await plugin.onActivity(messageEvent('conv-42', 'What is the weather?'));
    await plugin.onActivitySent(sentEvent('conv-42', 'msg-abc-123', 'It is sunny!', true));

    expect(provider.logSentMessage).toHaveBeenCalledTimes(1);
    const call = provider.logSentMessage.mock.calls[0][0];
    expect(call.messageId).toBe('msg-abc-123');
    expect(call.input).toBe('What is the weather?');
    expect(call.output).toBe('It is sunny!');
  });

  it('should intercept feedback activities and call provider.logFeedback with replyToId', async () => {
    const provider = mockProvider();
    const plugin = new FeedbackPlugin({ provider });

    await plugin.onActivity(feedbackInvokeEvent('original-msg-1', 'like', '{"feedbackText":"Great!"}'));

    expect(provider.logFeedback).toHaveBeenCalledWith('original-msg-1', {
      reaction: 'like',
      comment: '{"feedbackText":"Great!"}',
    });
  });

  it('should handle dislike feedback', async () => {
    const provider = mockProvider();
    const plugin = new FeedbackPlugin({ provider });

    await plugin.onActivity(feedbackInvokeEvent('msg-2', 'dislike', '{"feedbackText":"Not helpful"}'));

    expect(provider.logFeedback).toHaveBeenCalledWith('msg-2', {
      reaction: 'dislike',
      comment: '{"feedbackText":"Not helpful"}',
    });
  });

  it('should ignore non-invoke / non-feedback activities', async () => {
    const provider = mockProvider();
    const plugin = new FeedbackPlugin({ provider });

    // A regular invoke that is NOT feedback
    const nonFeedbackInvoke = {
      activity: {
        type: 'invoke',
        name: 'composeExtension/query',
        id: 'invoke-other',
        value: { commandId: 'search' },
        from: { id: 'user-1', name: 'User' },
        recipient: { id: 'bot-1', name: 'Bot' },
        conversation: { id: 'conv-1' },
        channelId: 'msteams',
        serviceUrl: 'https://test.botframework.com',
      },
      token: {
        appId: 'test-app',
        serviceUrl: 'https://test.botframework.com',
        from: 'bot' as const,
        fromId: 'test-from',
        toString: () => 'test-token',
        isExpired: () => false,
      },
      serviceUrl: 'https://test.botframework.com',
      channelId: 'msteams',
      bot: { id: 'bot-1', name: 'Bot' },
      conversation: { id: 'conv-1' },
      user: { id: 'user-1', name: 'User' },
    } as unknown as IPluginActivityEvent;

    await plugin.onActivity(nonFeedbackInvoke);

    expect(provider.logFeedback).not.toHaveBeenCalled();
    expect(provider.logSentMessage).not.toHaveBeenCalled();
  });

  it('should ignore sent activities without feedbackLoopEnabled', async () => {
    const provider = mockProvider();
    const plugin = new FeedbackPlugin({ provider });

    await plugin.onActivity(messageEvent('conv-1', 'Hello'));
    await plugin.onActivitySent(sentEvent('conv-1', 'sent-1', 'Hi there!', false));

    expect(provider.logSentMessage).not.toHaveBeenCalled();
  });

  it('should warn when replyToId is missing on feedback activity', async () => {
    const provider = mockProvider();
    const plugin = new FeedbackPlugin({ provider });

    const mockWarn = jest.fn();
    (plugin as any).log.warn = mockWarn;

    await plugin.onActivity(feedbackInvokeEvent(undefined, 'like', '{"feedbackText":"test"}'));

    expect(mockWarn).toHaveBeenCalled();
    expect(provider.logFeedback).not.toHaveBeenCalled();
  });

  it('should propagate provider errors', async () => {
    const provider = mockProvider();
    const error = new Error('Provider connection failed');
    provider.logSentMessage.mockRejectedValue(error);

    const plugin = new FeedbackPlugin({ provider });

    await plugin.onActivity(messageEvent('conv-1', 'Hello'));
    await expect(
      plugin.onActivitySent(sentEvent('conv-1', 'sent-1', 'Response', true))
    ).rejects.toThrow('Provider connection failed');
  });

  it('should propagate logFeedback errors', async () => {
    const provider = mockProvider();
    const error = new Error('Feedback logging failed');
    provider.logFeedback.mockRejectedValue(error);

    const plugin = new FeedbackPlugin({ provider });

    await expect(
      plugin.onActivity(feedbackInvokeEvent('msg-1', 'like', '{"feedbackText":"test"}'))
    ).rejects.toThrow('Feedback logging failed');
  });

  it('should omit input for proactive messages with no prior user message', async () => {
    const provider = mockProvider();
    const plugin = new FeedbackPlugin({ provider });

    // Send without a prior message activity
    await plugin.onActivitySent(sentEvent('conv-new', 'sent-1', 'Proactive message', true));

    expect(provider.logSentMessage).toHaveBeenCalledWith({
      messageId: 'sent-1',
      input: undefined,
      output: 'Proactive message',
    });
  });

  it('should clean up stored input after logging trace', async () => {
    const provider = mockProvider();
    const plugin = new FeedbackPlugin({ provider });

    await plugin.onActivity(messageEvent('conv-1', 'First message'));
    await plugin.onActivitySent(sentEvent('conv-1', 'sent-1', 'First response', true));

    expect(provider.logSentMessage).toHaveBeenCalledTimes(1);

    // Second sent without a new input should have undefined input
    await plugin.onActivitySent(sentEvent('conv-1', 'sent-2', 'Second response', true));

    expect(provider.logSentMessage).toHaveBeenCalledTimes(2);
    expect(provider.logSentMessage.mock.calls[1][0].input).toBeUndefined();
  });

  it('should track inputs per conversation independently', async () => {
    const provider = mockProvider();
    const plugin = new FeedbackPlugin({ provider });

    await plugin.onActivity(messageEvent('conv-A', 'Question A'));
    await plugin.onActivity(messageEvent('conv-B', 'Question B'));

    await plugin.onActivitySent(sentEvent('conv-A', 'sent-A', 'Answer A', true));
    await plugin.onActivitySent(sentEvent('conv-B', 'sent-B', 'Answer B', true));

    expect(provider.logSentMessage).toHaveBeenCalledWith({
      messageId: 'sent-A',
      input: 'Question A',
      output: 'Answer A',
    });
    expect(provider.logSentMessage).toHaveBeenCalledWith({
      messageId: 'sent-B',
      input: 'Question B',
      output: 'Answer B',
    });
  });
});
