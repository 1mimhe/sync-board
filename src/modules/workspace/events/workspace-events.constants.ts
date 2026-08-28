/**
 * Central registry of workspace-domain internal event names.
 * Consumers MUST import from here — never inline these strings.
 */
export const WORKSPACE_EVENTS = {
  created: 'workspace.created',
  memberAdded: 'workspace.member_added',
  memberRemoved: 'workspace.member_removed',
  memberRoleChanged: 'workspace.member_role_changed',
  memberLeft: 'workspace.member_left',
  ownershipTransferred: 'workspace.ownership_transferred',
  invitationCreated: 'workspace.invitation_created',
} as const;
