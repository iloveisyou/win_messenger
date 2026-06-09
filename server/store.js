const users = new Map();
const rooms = new Map();
const messages = new Map();
const unreadCounts = new Map(); // userId -> { roomId -> count }
const newFriends = new Map(); // userId -> Set of friendIds that are "new"

const AI_USER = {
  id: 'ai-assistant',
  name: 'AI 어시스턴트',
  avatar: '🤖',
  statusMessage: 'LangChain + MCP 기반 AI 도우미',
  isAI: true,
};

users.set(AI_USER.id, AI_USER);

function getOrCreateUser(name) {
  const existing = [...users.values()].find((u) => u.name === name && !u.isAI);
  if (existing) return existing;

  const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const avatars = ['😀', '😎', '🦊', '🐱', '🐰', '🐻', '🦁', '🐸', '🌟', '🎀'];
  const user = {
    id,
    name,
    avatar: avatars[Math.floor(Math.random() * avatars.length)],
    statusMessage: '안녕하세요!',
    isAI: false,
    joinedAt: Date.now(),
  };
  users.set(id, user);

  // Mark this user as "new friend" for all existing users
  for (const [existingUserId, existingUser] of users.entries()) {
    if (existingUserId === id || existingUser.isAI) continue;
    if (!newFriends.has(existingUserId)) newFriends.set(existingUserId, new Set());
    newFriends.get(existingUserId).add(id);
  }

  return user;
}

function createRoom(name, participantIds, type = 'direct') {
  const id = `room-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const room = { id, name, participants: participantIds, type, createdAt: Date.now() };
  rooms.set(id, room);
  messages.set(id, []);
  return room;
}

function createGroupRoom(name, participantIds) {
  return createRoom(name, participantIds, 'group');
}

function getOrCreateAIRoom(userId) {
  const existing = [...rooms.values()].find(
    (r) => r.type === 'ai' && r.participants.includes(userId)
  );
  if (existing) return existing;
  return createRoom('AI 어시스턴트', [userId, AI_USER.id], 'ai');
}

function getOrCreateDirectRoom(userId1, userId2) {
  const existing = [...rooms.values()].find(
    (r) =>
      r.type === 'direct' &&
      r.participants.includes(userId1) &&
      r.participants.includes(userId2)
  );
  if (existing) return existing;

  const otherUser = users.get(userId2);
  const name = otherUser ? otherUser.name : 'Chat';
  return createRoom(name, [userId1, userId2], 'direct');
}

function addMessage(roomId, senderId, text, type = 'text') {
  const msg = {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    roomId,
    senderId,
    text,
    type,
    timestamp: Date.now(),
  };
  if (!messages.has(roomId)) messages.set(roomId, []);
  messages.get(roomId).push(msg);

  // Increment unread for all participants except sender
  const room = rooms.get(roomId);
  if (room) {
    for (const pid of room.participants) {
      if (pid === senderId || pid === AI_USER.id) continue;
      if (!unreadCounts.has(pid)) unreadCounts.set(pid, {});
      const userUnread = unreadCounts.get(pid);
      userUnread[roomId] = (userUnread[roomId] || 0) + 1;
    }
  }

  return msg;
}

function getRoomMessages(roomId, limit = 50) {
  const msgs = messages.get(roomId) || [];
  return msgs.slice(-limit);
}

function getUserRooms(userId) {
  return [...rooms.values()].filter((r) => r.participants.includes(userId));
}

function getAllUsersExcept(userId) {
  return [...users.values()].filter((u) => u.id !== userId);
}

function getUnreadCounts(userId) {
  return unreadCounts.get(userId) || {};
}

function clearUnread(userId, roomId) {
  if (unreadCounts.has(userId)) {
    const userUnread = unreadCounts.get(userId);
    delete userUnread[roomId];
  }
}

function getTotalUnreadMessages(userId) {
  const userUnread = unreadCounts.get(userId) || {};
  return Object.values(userUnread).reduce((sum, c) => sum + c, 0);
}

function getNewFriendIds(userId) {
  return [...(newFriends.get(userId) || [])];
}

function clearNewFriend(userId, friendId) {
  if (newFriends.has(userId)) {
    newFriends.get(userId).delete(friendId);
  }
}

function clearAllNewFriends(userId) {
  if (newFriends.has(userId)) {
    newFriends.get(userId).clear();
  }
}

function getNewFriendsCount(userId) {
  return newFriends.has(userId) ? newFriends.get(userId).size : 0;
}

export {
  users,
  rooms,
  messages,
  AI_USER,
  getOrCreateUser,
  createRoom,
  createGroupRoom,
  getOrCreateAIRoom,
  getOrCreateDirectRoom,
  addMessage,
  getRoomMessages,
  getUserRooms,
  getAllUsersExcept,
  getUnreadCounts,
  clearUnread,
  getTotalUnreadMessages,
  getNewFriendIds,
  clearNewFriend,
  clearAllNewFriends,
  getNewFriendsCount,
};
