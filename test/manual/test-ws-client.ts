import { io, Socket } from 'socket.io-client';

/**
 * Manual WebSocket Test Client for SyncBoard.
 *
 * Usage:
 *   npx ts-node test/manual/test-ws-client.ts <ACCESS_TOKEN> <BOARD_ID> <WORKSPACE_ID>
 *
 * Or set environment variables:
 *   TOKEN="eyJ..." BOARD_ID="uuid" WORKSPACE_ID="uuid" npx ts-node test/manual/test-ws-client.ts
 */

const token = process.argv[2] || process.env.TOKEN || 'YOUR_ACCESS_TOKEN';
const boardId = process.argv[3] || process.env.BOARD_ID || 'YOUR_BOARD_UUID';
const workspaceId =
  process.argv[4] || process.env.WORKSPACE_ID || 'YOUR_WORKSPACE_UUID';
const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';

console.log('====================================================');
console.log('🚀 SyncBoard — Real-Time WebSocket Client');
console.log('====================================================');
console.log('Target Server :', serverUrl);
console.log('Board ID      :', boardId);
console.log('Workspace ID  :', workspaceId);
console.log('Token         :', token.substring(0, 15) + '...');
console.log('----------------------------------------------------');

const socket: Socket = io(serverUrl, {
  auth: { token },
  transports: ['websocket', 'polling'],
});

// Connection Lifecycle
socket.on('connect', () => {
  console.log('🟢 [CONNECTED] Socket ID:', socket.id);

  // 1. Join Workspace
  console.log(`📤 Emitting workspace:join for ${workspaceId}`);
  socket.emit('workspace:join', { workspaceId });

  // 2. Join Board
  console.log(`📤 Emitting board:join for ${boardId}`);
  socket.emit('board:join', { boardId });
});

socket.on('disconnect', (reason) => {
  console.log('🔴 [DISCONNECTED] Reason:', reason);
});

socket.on('connect_error', (err) => {
  console.error('🚫 [CONNECT ERROR]:', err.message);
});

// Error handling
socket.on('error', (err) => {
  console.error('❌ [ERROR EVENT]:', JSON.stringify(err, null, 2));
});

// Workspace Events
socket.on('workspace:joined', (data) => {
  console.log('✅ [WORKSPACE JOINED]:', JSON.stringify(data, null, 2));
});

socket.on('workspace:member-online', (data) => {
  console.log('👤 [MEMBER ONLINE]:', JSON.stringify(data));
});

socket.on('workspace:member-offline', (data) => {
  console.log('👤 [MEMBER OFFLINE]:', JSON.stringify(data));
});

// Board & Presence Events
socket.on('board:joined', (data) => {
  console.log(
    '✅ [BOARD JOINED - ACTIVE VIEWERS]:',
    JSON.stringify(data, null, 2),
  );
});

socket.on('board:presence', (data) => {
  console.log('👥 [BOARD PRESENCE UPDATE]:', JSON.stringify(data));
});

socket.on('board:cursor', (data) => {
  console.log('🖱️ [CURSOR MOVE]:', JSON.stringify(data));
});

// Real-Time Entity Updates (emitted when REST API changes data)
socket.on('board:updated', (data) => console.log('📋 [BOARD UPDATED]:', data));
socket.on('board:archived', (data) =>
  console.log('🗑️ [BOARD ARCHIVED]:', data),
);
socket.on('board:unarchived', (data) =>
  console.log('♻️ [BOARD RESTORED]:', data),
);

socket.on('list:created', (data) => console.log('➕ [LIST CREATED]:', data));
socket.on('list:updated', (data) => console.log('✏️ [LIST UPDATED]:', data));
socket.on('list:moved', (data) => console.log('↕️ [LIST MOVED]:', data));
socket.on('list:archived', (data) => console.log('🗑️ [LIST ARCHIVED]:', data));
socket.on('list:unarchived', (data) =>
  console.log('♻️ [LIST RESTORED]:', data),
);

socket.on('card:created', (data) => console.log('🎴 [CARD CREATED]:', data));
socket.on('card:updated', (data) => console.log('✏️ [CARD UPDATED]:', data));
socket.on('card:moved', (data) => console.log('🚚 [CARD MOVED]:', data));
socket.on('card:archived', (data) => console.log('🗑️ [CARD ARCHIVED]:', data));
socket.on('card:unarchived', (data) =>
  console.log('♻️ [CARD RESTORED]:', data),
);
socket.on('card:comment-added', (data) =>
  console.log('💬 [COMMENT ADDED]:', data),
);
socket.on('card:attachment-added', (data) =>
  console.log('📎 [ATTACHMENT ADDED]:', data),
);
socket.on('card:attachment-deleted', (data) =>
  console.log('🗑️ [ATTACHMENT DELETED]:', data),
);

// 30s presence keep-alive heartbeat
setInterval(() => {
  if (socket.connected) {
    socket.emit('presence:heartbeat', {});
  }
}, 30000);

// Demo cursor streaming every 5 seconds
let cursorX = 50;
setInterval(() => {
  if (socket.connected && boardId !== 'YOUR_BOARD_UUID') {
    cursorX = (cursorX + 25) % 800;
    socket.emit('presence:cursor', {
      boardId,
      x: cursorX,
      y: 180,
    });
  }
}, 5000);
