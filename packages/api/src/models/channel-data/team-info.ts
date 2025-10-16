import { TeamTypes } from './team-types';

/**
 *
 * An interface representing TeamInfo.
 * Describes a team
 *
 */
export type TeamInfo = {
  /**
   * @member {string} [id] Unique identifier representing a team
   */
  id: string;

  /**
   * @member {string} [name] Name of team.
   */
  name?: string;

  /**
   * @member {string} [aadGroupId] The Azure AD Teams group ID.
   */
  aadGroupId?: string;

  /**
   * @member {string} [tenantId] The tenant ID of the team.
   */
  tenantId?: string;

  /**
   * @member {TeamTypes} [type] The type of the team.
   */
  type?: TeamTypes;

  /**
   * @member {number} Count of channels in the team.
   */
  channelCount?: number;

  /**
   * @member {number} Count of the members in the team.
   */
  memberCount?: number;
};
