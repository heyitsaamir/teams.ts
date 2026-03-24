export { TeamsSDKAdapter } from './teams-sdk-adapter';
export type { TeamsSDKAdapterConfig, TeamsThreadId } from './types';
export { TeamsFormatConverter } from './format-converter';
export { cardToAdaptiveCard, cardToFallbackText } from './cards';

import { TeamsSDKAdapter } from './teams-sdk-adapter';
import type { TeamsSDKAdapterConfig } from './types';

/**
 * Create a teams.ts-based adapter for the Vercel Chat SDK.
 *
 * Uses @microsoft/teams.apps instead of Bot Framework for:
 *  - Native streaming via HttpStream
 *  - Outbound reactions via api.reactions
 *  - Built-in JWT validation
 */
export function createTeamsSDKAdapter(config?: TeamsSDKAdapterConfig): TeamsSDKAdapter {
  return new TeamsSDKAdapter(config);
}
