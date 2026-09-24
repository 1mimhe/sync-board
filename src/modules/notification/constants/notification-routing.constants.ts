/** Routing keys published on the notification exchange. */
export const NOTIFICATION_ROUTING_KEYS = {
  cardAssigned: 'notification.card.assigned',
  commentAdded: 'notification.comment.added',
  commentMentioned: 'notification.comment.mentioned',
  cardStatusChanged: 'notification.card.status',
  cardPriorityChanged: 'notification.card.priority',
  cardLinked: 'notification.card.linked',
  workspaceInvited: 'notification.workspace.invited',
  workspaceRoleChanged: 'notification.workspace.role_changed',
} as const;
