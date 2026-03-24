import type {
  IHttpServerAdapter,
  IHttpServerRequest,
  IHttpServerResponse,
  HttpMethod,
  HttpRouteHandler,
} from '@microsoft/teams.apps';

/**
 * A virtual HTTP adapter that captures route handlers registered by HttpServer
 * without starting a real server. Exposes dispatch() so handleWebhook can
 * feed requests into the teams.ts pipeline (JWT validation → activity processing).
 */
export class BridgeHttpAdapter implements IHttpServerAdapter {
  private routes = new Map<string, HttpRouteHandler>();

  registerRoute(method: HttpMethod, path: string, handler: HttpRouteHandler): void {
    const key = `${method}:${path}`;
    this.routes.set(key, handler);
  }

  /**
   * Dispatch a request to a previously registered route handler.
   * Used by TeamsSDKAdapter.handleWebhook() to feed inbound requests
   * through the teams.ts HTTP pipeline.
   */
  async dispatch(
    method: HttpMethod,
    path: string,
    request: IHttpServerRequest
  ): Promise<IHttpServerResponse> {
    const key = `${method}:${path}`;
    const handler = this.routes.get(key);
    if (!handler) {
      return { status: 404, body: { error: `No handler for ${key}` } };
    }
    return handler(request);
  }
}
