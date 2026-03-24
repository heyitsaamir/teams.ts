/**
 * Configuration for the teams.ts-based Chat SDK adapter.
 */
export interface TeamsSDKAdapterConfig {
  /** Azure AD client ID. Defaults to CLIENT_ID env var. */
  clientId?: string;
  /** Azure AD client secret. Defaults to CLIENT_SECRET env var. */
  clientSecret?: string;
  /** Azure AD tenant ID. Defaults to TENANT_ID env var. */
  tenantId?: string;
}

/**
 * Teams-specific thread ID data.
 * Compatible with the encoding used by @chat-adapter/teams.
 */
export interface TeamsThreadId {
  conversationId: string;
  serviceUrl: string;
  replyToId?: string;
}
