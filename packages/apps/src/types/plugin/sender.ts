import { ActivityParams, ConversationReference, SentActivity } from '@microsoft/teams.api';

import { IStreamer } from '../streamer';

import { IPlugin } from './plugin';

/**
 * a plugin that can send activities
 */
export interface ISender<TCustomEvents extends {} = {}> extends IPlugin<TCustomEvents> {
  /**
   * called by the `App`
   * to send an activity
   * @param activity the activity to send
   * @param ref the conversation reference
   * @param isTargeted when true, the message is sent privately to the recipient specified in activity.Recipient
   */
  send(activity: ActivityParams, ref: ConversationReference, isTargeted?: boolean): Promise<SentActivity>;

  /**
   * called by the `App`
   * to create a new activity stream
   */
  createStream(ref: ConversationReference): IStreamer;
};
