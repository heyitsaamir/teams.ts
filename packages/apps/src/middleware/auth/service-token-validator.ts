import { Credentials, IToken } from '@microsoft/teams.api';
import { ILogger } from '@microsoft/teams.common';

import { JwtValidator } from './jwt-validator';

/**
 * Default allowed service URL domain patterns for Bot Framework.
 * These cover the known domains used by the Bot Framework Channel Service
 * across public, government, sovereign, and regional clouds.
 */
const DEFAULT_ALLOWED_SERVICE_URL_DOMAINS = [
  // Public cloud
  '.botframework.com',
  '.trafficmanager.net',
  // US Government
  '.botframework.azure.us',
  '.teams.microsoft.com',
  '.teams.microsoft.us',
  // China (21Vianet)
  '.botframework.azure.cn',
  '.teams.microsoftonline.cn',
];

/**
 * Validates that a service URL belongs to a known Bot Framework domain.
 * Returns true if the URL's hostname ends with one of the allowed domain suffixes,
 * or if the hostname is localhost (for local development).
 */
export function isAllowedServiceUrl(serviceUrl: string, additionalDomains?: string[]): boolean {
  try {
    const url = new URL(serviceUrl);
    const hostname = url.hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    const allowed = [...DEFAULT_ALLOWED_SERVICE_URL_DOMAINS, ...(additionalDomains ?? [])];
    return allowed.some((domain) => hostname.endsWith(domain.toLowerCase()));
  } catch {
    return false;
  }
}

/**
 * Service token validator for Bot Framework /api/messages requests
 * Validates Bot Framework service tokens
 */
export class ServiceTokenValidator {
  private jwtValidator: JwtValidator;
  private credentials?: Credentials;
  private additionalAllowedDomains?: string[];
  private skipServiceUrlValidation: boolean;

  constructor(
    appId: string,
    tenantId?: string,
    serviceUrl?: string,
    logger?: ILogger,
    additionalAllowedDomains?: string[],
    skipServiceUrlValidation?: boolean
  ) {
    this.jwtValidator = new JwtValidator({
      clientId: appId,
      tenantId,
      validateIssuer: { allowedIssuer: 'https://api.botframework.com' },
      validateServiceUrl: serviceUrl ? { expectedServiceUrl: serviceUrl } : undefined,
      jwksUriOptions: {
        type: 'uri',
        uri: 'https://login.botframework.com/v1/.well-known/keys'
      },
    }, logger);

    this.credentials = { clientId: appId, tenantId };
    this.additionalAllowedDomains = additionalAllowedDomains;
    this.skipServiceUrlValidation = skipServiceUrlValidation ?? false;
  }

  async check(authHeader: string, body: any): Promise<IToken> {
    // Extract token from "Bearer <token>" format
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : authHeader;

    // Validate token using JWT validator
    const payload = await this.jwtValidator.validateAccessToken(token, {
      validateServiceUrl: body.serviceUrl ? { expectedServiceUrl: body.serviceUrl } : undefined
    });

    if (!payload) {
      throw new Error('Invalid token');
    }

    const serviceUrl = body.serviceUrl || payload.serviceurl as string || '';

    // Validate serviceUrl against allowed domains
    if (serviceUrl && !this.skipServiceUrlValidation && !isAllowedServiceUrl(serviceUrl, this.additionalAllowedDomains)) {
      throw new Error(`Service URL '${serviceUrl}' is not from an allowed Bot Framework domain`);
    }

    // Convert JWT payload to IToken
    return {
      appId: payload.appid as string || this.credentials?.clientId || '',
      from: 'azure',
      fromId: payload.sub as string || '',
      serviceUrl,
      isExpired: () => false, // Already validated by JWT validator
    };
  }
}
