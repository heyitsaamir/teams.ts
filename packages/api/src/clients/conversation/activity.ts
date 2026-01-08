import { Client, ClientOptions } from '@microsoft/teams.common/http';

import { Activity } from '../../activities';
import { Account, Resource } from '../../models';
import { ApiClientSettings, mergeApiClientSettings } from '../api-client-settings';

export type ActivityParams = Pick<Activity, 'type'> & Partial<Activity>;

export class ConversationActivityClient {
  readonly serviceUrl: string;

  get http() {
    return this._http;
  }
  set http(v) {
    this._http = v;
  }
  protected _http: Client;
  protected _apiClientSettings: Partial<ApiClientSettings>;

  constructor(serviceUrl: string, options?: Client | ClientOptions, apiClientSettings?: Partial<ApiClientSettings>) {
    this.serviceUrl = serviceUrl;

    if (!options) {
      this._http = new Client();
    } else if ('request' in options) {
      this._http = options;
    } else {
      this._http = new Client(options);
    }

    this._apiClientSettings = mergeApiClientSettings(apiClientSettings);
  }

  async create(conversationId: string, params: ActivityParams, isTargeted: boolean = false) {
    let url = `${this.serviceUrl}/v3/conversations/${conversationId}/activities`;
    if (isTargeted) {
      url += '?isTargetedActivity=true';
    }

    const res = await this.http.post<Resource>(url, params);
    return res.data;
  }

  async update(conversationId: string, id: string, params: ActivityParams, isTargeted: boolean = false) {
    let url = `${this.serviceUrl}/v3/conversations/${conversationId}/activities/${id}`;
    if (isTargeted) {
      url += '?isTargetedActivity=true';
    }

    const res = await this.http.put<Resource>(url, params);
    return res.data;
  }

  async reply(conversationId: string, id: string, params: ActivityParams, isTargeted: boolean = false) {
    params.replyToId = id;
    let url = `${this.serviceUrl}/v3/conversations/${conversationId}/activities/${id}`;
    if (isTargeted) {
      url += '?isTargetedActivity=true';
    }

    const res = await this.http.post<Resource>(url, params);
    return res.data;
  }

  async delete(conversationId: string, id: string, isTargeted: boolean = false) {
    let url = `${this.serviceUrl}/v3/conversations/${conversationId}/activities/${id}`;
    if (isTargeted) {
      url += '?isTargetedActivity=true';
    }

    const res = await this.http.delete<void>(url);
    return res.data;
  }

  async getMembers(conversationId: string, id: string) {
    const res = await this.http.get<Account[]>(
      `${this.serviceUrl}/v3/conversations/${conversationId}/activities/${id}/members`
    );
    return res.data;
  }
}
