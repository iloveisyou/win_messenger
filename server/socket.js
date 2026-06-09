import {
  getOrCreateUser,
  getAllUsersExcept,
  getUserRooms,
  getOrCreateAIRoom,
  getOrCreateDirectRoom,
  createGroupRoom,
  addMessage,
  getRoomMessages,
  getUnreadCounts,
  clearUnread,
  getTotalUnreadMessages,
  getNewFriendIds,
  clearAllNewFriends,
  getNewFriendsCount,
  users,
  rooms,
  AI_USER,
} from './store.js';
import { invokeAgent } from './ai/agent.js';

export function setupSocket(io) {
  io.on('connection', (socket) => {
    let currentUser = null;

    socket.on('user:login', (name) => {
      const isNew = ![...users.values()].find((u) => u.name === name && !u.isAI);
      currentUser = getOrCreateUser(name);
      const aiRoom = getOrCreateAIRoom(currentUser.id);

      socket.join(currentUser.id);
      socket.join(aiRoom.id);

      // Rejoin all existing rooms
      const userRooms = getUserRooms(currentUser.id);
      for (const room of userRooms) {
        socket.join(room.id);
      }

      const friendsList = getAllUsersExcept(currentUser.id);
      const unreadCounts = getUnreadCounts(currentUser.id);
      const newFriendIds = getNewFriendIds(currentUser.id);
      const roomsWithMeta = userRooms.map((room) => {
        const msgs = getRoomMessages(room.id, 1);
        return {
          ...room,
          lastMessage: msgs[0] || null,
          unreadCount: unreadCounts[room.id] || 0,
        };
      });

      socket.emit('user:logged-in', {
        user: currentUser,
        friends: friendsList,
        rooms: roomsWithMeta,
        newFriendIds,
        badges: {
          friends: getNewFriendsCount(currentUser.id),
          chats: getTotalUnreadMessages(currentUser.id),
        },
      });

      if (isNew) {
        socket.broadcast.emit('user:online', currentUser);
      }
    });

    socket.on('room:open', (targetUserId) => {
      if (!currentUser) return;

      let room;
      if (targetUserId === AI_USER.id) {
        room = getOrCreateAIRoom(currentUser.id);
      } else {
        room = getOrCreateDirectRoom(currentUser.id, targetUserId);
      }

      socket.join(room.id);
      clearUnread(currentUser.id, room.id);

      const msgs = getRoomMessages(room.id);
      const participants = room.participants.map((id) => users.get(id)).filter(Boolean);

      socket.emit('room:joined', { room, messages: msgs, participants });
      socket.emit('badges:update', {
        friends: getNewFriendsCount(currentUser.id),
        chats: getTotalUnreadMessages(currentUser.id),
      });
    });

    socket.on('room:open-by-id', (roomId) => {
      if (!currentUser) return;
      const room = rooms.get(roomId);
      if (!room || !room.participants.includes(currentUser.id)) return;

      socket.join(room.id);
      clearUnread(currentUser.id, room.id);

      const msgs = getRoomMessages(room.id);
      const participants = room.participants.map((id) => users.get(id)).filter(Boolean);

      socket.emit('room:joined', { room, messages: msgs, participants });
      socket.emit('badges:update', {
        friends: getNewFriendsCount(currentUser.id),
        chats: getTotalUnreadMessages(currentUser.id),
      });
    });

    socket.on('room:create-group', ({ name, participantIds }) => {
      if (!currentUser) return;

      const allParticipants = [currentUser.id, ...participantIds];
      const room = createGroupRoom(
        name || allParticipants.map((id) => users.get(id)?.name).filter(Boolean).join(', '),
        allParticipants
      );

      // Join creator's socket to the room immediately
      socket.join(room.id);

      for (const pid of allParticipants) {
        io.to(pid).emit('room:created', room);
      }
    });

    socket.on('friends:viewed', () => {
      if (!currentUser) return;
      clearAllNewFriends(currentUser.id);
      socket.emit('badges:update', {
        friends: 0,
        chats: getTotalUnreadMessages(currentUser.id),
      });
    });

    socket.on('message:send', async ({ roomId, text }) => {
      if (!currentUser || !text.trim()) return;

      const msg = addMessage(roomId, currentUser.id, text.trim());
      io.to(roomId).emit('message:new', {
        ...msg,
        sender: currentUser,
      });

      // Send updated badge counts and room info to all participants
      const room = rooms.get(roomId);
      if (room) {
        for (const pid of room.participants) {
          if (pid === currentUser.id || pid === AI_USER.id) continue;
          // Notify participant about the room so it appears in their chat list
          io.to(pid).emit('room:notify', {
            ...room,
            lastMessage: msg,
            unreadCount: (getUnreadCounts(pid)[roomId] || 0),
          });
          io.to(pid).emit('badges:update', {
            friends: getNewFriendsCount(pid),
            chats: getTotalUnreadMessages(pid),
          });
        }
      }

      if (room && room.type === 'ai') {
        io.to(roomId).emit('ai:typing', { roomId, isTyping: true });

        const history = getRoomMessages(roomId, 10).map((m) => ({
          text: m.text,
          type: m.senderId === AI_USER.id ? 'ai' : 'human',
        }));

        const response = await invokeAgent(text.trim(), history);
        const aiMsg = addMessage(roomId, AI_USER.id, response, 'ai');

        io.to(roomId).emit('ai:typing', { roomId, isTyping: false });
        io.to(roomId).emit('message:new', {
          ...aiMsg,
          sender: AI_USER,
        });

        // Update badge for user after AI responds
        io.to(currentUser.id).emit('badges:update', {
          friends: getNewFriendsCount(currentUser.id),
          chats: getTotalUnreadMessages(currentUser.id),
        });
      }
    });

    socket.on('room:read', (roomId) => {
      if (!currentUser) return;
      clearUnread(currentUser.id, roomId);
      socket.emit('badges:update', {
        friends: getNewFriendsCount(currentUser.id),
        chats: getTotalUnreadMessages(currentUser.id),
      });
    });

    socket.on('typing:start', (roomId) => {
      if (!currentUser) return;
      socket.to(roomId).emit('typing:update', {
        userId: currentUser.id,
        name: currentUser.name,
        isTyping: true,
      });
    });

    socket.on('typing:stop', (roomId) => {
      if (!currentUser) return;
      socket.to(roomId).emit('typing:update', {
        userId: currentUser.id,
        name: currentUser.name,
        isTyping: false,
      });
    });

    socket.on('disconnect', () => {
      if (currentUser) {
        socket.broadcast.emit('user:offline', currentUser.id);
      }
    });
  });
}
