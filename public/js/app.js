const socket = io();

let currentUser = null;
let currentRoom = null;
let friends = [];
let chatRooms = [];
let newFriendIds = new Set();
let unreadByRoom = {};
let badges = { friends: 0, chats: 0 };

// ===== DOM =====
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const chatScreen = document.getElementById('chat-screen');
const loginName = document.getElementById('login-name');
const loginBtn = document.getElementById('login-btn');
const headerTitle = document.getElementById('header-title');
const userAvatar = document.getElementById('user-avatar');
const myProfile = document.getElementById('my-profile');
const friendsList = document.getElementById('friends-list');
const friendsCount = document.getElementById('friends-count');
const roomsList = document.getElementById('rooms-list');
const noRooms = document.getElementById('no-rooms');
const chatTitle = document.getElementById('chat-title');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const chatBack = document.getElementById('chat-back');
const chatInvite = document.getElementById('chat-invite');
const typingIndicator = document.getElementById('typing-indicator');
const badgeFriends = document.getElementById('badge-friends');
const badgeChats = document.getElementById('badge-chats');

// ===== 화면 전환 =====
function showScreen(screen) {
  [loginScreen, mainScreen, chatScreen].forEach((s) => s.classList.remove('active'));
  screen.classList.add('active');
}

// ===== 뱃지 업데이트 =====
function updateBadges(data) {
  if (data) {
    badges.friends = data.friends;
    badges.chats = data.chats;
  }

  if (badges.friends > 0) {
    badgeFriends.textContent = badges.friends > 99 ? '99+' : badges.friends;
    badgeFriends.classList.add('visible');
  } else {
    badgeFriends.classList.remove('visible');
  }

  if (badges.chats > 0) {
    badgeChats.textContent = badges.chats > 99 ? '99+' : badges.chats;
    badgeChats.classList.add('visible');
  } else {
    badgeChats.classList.remove('visible');
  }
}

// ===== 탭 전환 =====
const tabItems = document.querySelectorAll('.tab-item');
const tabViews = document.querySelectorAll('.tab-view');
const tabTitles = { friends: '친구', chats: '채팅', settings: '설정' };

tabItems.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    tabItems.forEach((t) => t.classList.remove('active'));
    tabViews.forEach((v) => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`${target}-view`).classList.add('active');
    headerTitle.textContent = tabTitles[target];

    if (target === 'friends') {
      socket.emit('friends:viewed');
      newFriendIds.clear();
      renderFriends();
    }
    if (target === 'chats') {
      renderRooms();
    }
  });
});

// ===== 로그인 =====
function doLogin() {
  const name = loginName.value.trim();
  if (!name) return;
  socket.emit('user:login', name);
}

loginBtn.addEventListener('click', doLogin);
loginName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLogin();
});

socket.on('user:logged-in', ({ user, friends: f, rooms, newFriendIds: nf, badges: b }) => {
  currentUser = user;
  friends = f;
  chatRooms = rooms;
  newFriendIds = new Set(nf || []);

  // Build unread map from rooms
  unreadByRoom = {};
  for (const r of rooms) {
    if (r.unreadCount > 0) unreadByRoom[r.id] = r.unreadCount;
  }

  userAvatar.textContent = user.avatar;
  myProfile.innerHTML = `
    <div class="avatar">${user.avatar}</div>
    <div class="profile-info">
      <div class="profile-name">${user.name}</div>
      <div class="profile-status">${user.statusMessage}</div>
    </div>
  `;

  updateBadges(b);
  renderFriends();
  renderRooms();
  showScreen(mainScreen);
});

// ===== 친구 목록 =====
function renderFriends() {
  friendsCount.textContent = friends.length;
  friendsList.innerHTML = friends
    .map((f) => {
      const aiBadge = f.isAI ? '<span class="ai-badge">AI</span>' : '';
      const isNew = newFriendIds.has(f.id);
      const newBadge = isNew ? '<span class="new-badge">NEW</span>' : '';
      return `
      <div class="list-item${isNew ? ' is-new' : ''}" data-user-id="${f.id}">
        <div class="avatar">${f.avatar}</div>
        <div class="item-info">
          <div class="item-name">${f.name}${aiBadge}${newBadge}</div>
          <div class="item-sub">${f.statusMessage}</div>
        </div>
      </div>
    `;
    })
    .join('');

  friendsList.querySelectorAll('.list-item').forEach((item) => {
    item.addEventListener('click', () => {
      socket.emit('room:open', item.dataset.userId);
    });
  });
}

// ===== 채팅방 목록 =====
function renderRooms() {
  if (chatRooms.length === 0) {
    roomsList.innerHTML = '';
    noRooms.style.display = 'flex';
    return;
  }
  noRooms.style.display = 'none';

  const sorted = [...chatRooms].sort((a, b) => {
    const ta = a.lastMessage ? a.lastMessage.timestamp : 0;
    const tb = b.lastMessage ? b.lastMessage.timestamp : 0;
    return tb - ta;
  });

  roomsList.innerHTML = sorted
    .map((r) => {
      const lastMsg = r.lastMessage;
      const preview = lastMsg ? lastMsg.text.slice(0, 30) : '대화를 시작하세요';
      const time = lastMsg ? formatTime(lastMsg.timestamp) : '';
      const isAI = r.type === 'ai';
      const isGroup = r.type === 'group';
      const aiBadge = isAI ? '<span class="ai-badge">AI</span>' : '';
      const avatar = isAI ? '🤖' : isGroup ? '👥' : '💬';
      const participantCount = isGroup ? ` (${r.participants.length})` : '';
      const unread = unreadByRoom[r.id] || 0;
      const unreadBadge = unread > 0
        ? `<div class="unread-badge">${unread > 99 ? '99+' : unread}</div>`
        : '';
      const hasNew = unread > 0;
      const newIndicator = hasNew ? '<span class="new-badge">NEW</span>' : '';
      return `
      <div class="list-item${hasNew ? ' is-new' : ''}" data-room-id="${r.id}">
        <div class="avatar">${avatar}</div>
        <div class="item-info">
          <div class="item-name">${r.name}${participantCount}${aiBadge}${newIndicator}</div>
          <div class="item-sub">${preview}</div>
        </div>
        <div class="item-meta">
          <div class="item-time">${time}</div>
          ${unreadBadge}
        </div>
      </div>
    `;
    })
    .join('');

  roomsList.querySelectorAll('.list-item').forEach((item) => {
    item.addEventListener('click', () => {
      const room = chatRooms.find((r) => r.id === item.dataset.roomId);
      if (room) {
        if (room.type === 'group') {
          socket.emit('room:open-by-id', room.id);
        } else {
          const targetUserId = room.participants.find((p) => p !== currentUser.id);
          if (targetUserId) socket.emit('room:open', targetUserId);
        }
        delete unreadByRoom[room.id];
      }
    });
  });
}

// ===== 채팅 화면 =====
let chatParticipants = [];

socket.on('room:joined', ({ room, messages, participants }) => {
  currentRoom = room;
  chatParticipants = participants;

  // Clear unread for this room
  delete unreadByRoom[room.id];

  const isGroup = room.type === 'group';
  const isAI = room.type === 'ai';
  if (isGroup) {
    chatTitle.textContent = room.name;
    document.getElementById('chat-participant-count').textContent = `${participants.length}명`;
  } else {
    const otherUser = participants.find((p) => p.id !== currentUser.id);
    chatTitle.textContent = otherUser ? otherUser.name : room.name;
    document.getElementById('chat-participant-count').textContent = '';
  }

  chatInvite.style.display = isAI ? 'none' : 'inline-block';

  chatMessages.innerHTML = '';
  messages.forEach((msg) => renderMessage(msg, participants));

  showScreen(chatScreen);
  scrollToBottom();
  chatInput.focus();
});

chatBack.addEventListener('click', () => {
  currentRoom = null;
  chatParticipants = [];
  socket.emit('user:login', currentUser.name);
  showScreen(mainScreen);
});

// ===== 초대 (그룹 채팅 생성) =====
chatInvite.addEventListener('click', () => {
  if (!currentRoom) return;
  const availableFriends = friends.filter(
    (f) => !f.isAI && !currentRoom.participants.includes(f.id)
  );
  if (availableFriends.length === 0) {
    alert('초대할 수 있는 친구가 없습니다.');
    return;
  }

  const list = availableFriends.map((f) => `${f.avatar} ${f.name}`);
  const choice = prompt(
    `초대할 친구 번호를 입력하세요 (쉼표로 구분):\n${list.map((n, i) => `${i + 1}. ${n}`).join('\n')}`
  );
  if (!choice) return;

  const indices = choice.split(',').map((s) => parseInt(s.trim()) - 1);
  const selectedIds = indices
    .filter((i) => i >= 0 && i < availableFriends.length)
    .map((i) => availableFriends[i].id);

  if (selectedIds.length === 0) return;

  const allParticipants = [...currentRoom.participants, ...selectedIds];
  const names = allParticipants
    .map((id) => {
      const u = friends.find((f) => f.id === id);
      return u ? u.name : currentUser.name;
    })
    .join(', ');

  pendingGroupOpen = true;
  socket.emit('room:create-group', {
    name: names,
    participantIds: [...new Set(allParticipants.filter((id) => id !== currentUser.id))],
  });
});

let pendingGroupOpen = false;

socket.on('room:created', (room) => {
  if (!chatRooms.find((r) => r.id === room.id)) {
    chatRooms.push({ ...room, lastMessage: null, unreadCount: 0 });
    renderRooms();
  }
  // Auto-open if this user just created/invited (pendingGroupOpen flag)
  if (pendingGroupOpen && room.participants.includes(currentUser?.id)) {
    pendingGroupOpen = false;
    socket.emit('room:open-by-id', room.id);
  }
});

socket.on('room:notify', (roomData) => {
  const existing = chatRooms.find((r) => r.id === roomData.id);
  if (existing) {
    existing.lastMessage = roomData.lastMessage;
  } else {
    chatRooms.push(roomData);
    socket.join && socket.emit('room:open-by-id', roomData.id);
  }
  if (roomData.unreadCount) {
    unreadByRoom[roomData.id] = roomData.unreadCount;
  }
  if (mainScreen.classList.contains('active')) {
    renderRooms();
  }
});

function renderMessage(msg, participants) {
  const isMine = msg.senderId === currentUser?.id;
  const isAI = msg.senderId === 'ai-assistant';
  const sender = msg.sender || (participants || chatParticipants || []).find((p) => p.id === msg.senderId);

  const div = document.createElement('div');
  div.className = `message ${isMine ? 'mine' : 'other'} ${isAI ? 'ai' : ''}`;

  const avatar = sender ? sender.avatar : '?';
  const name = sender ? sender.name : '';
  const time = formatTime(msg.timestamp);

  div.innerHTML = `
    <div class="msg-avatar">${avatar}</div>
    <div class="msg-content">
      <div class="msg-sender">${name}</div>
      <div class="msg-bubble">${escapeHtml(msg.text)}</div>
    </div>
    <div class="msg-time">${time}</div>
  `;

  chatMessages.appendChild(div);
}

// ===== 메시지 전송 =====
function sendMessage() {
  const text = chatInput.value.trim();
  if (!text || !currentRoom) return;
  socket.emit('message:send', { roomId: currentRoom.id, text });
  chatInput.value = '';
}

chatSend.addEventListener('click', sendMessage);
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});

socket.on('message:new', (msg) => {
  if (currentRoom && msg.roomId === currentRoom.id) {
    renderMessage(msg);
    scrollToBottom();
    // We're viewing this room, clear its unread
    socket.emit('room:read', msg.roomId);
  } else {
    // Not in this room, track unread locally
    unreadByRoom[msg.roomId] = (unreadByRoom[msg.roomId] || 0) + 1;
  }

  // Update room list data
  const roomIdx = chatRooms.findIndex((r) => r.id === msg.roomId);
  if (roomIdx >= 0) {
    chatRooms[roomIdx].lastMessage = msg;
  } else {
    chatRooms.push({ id: msg.roomId, name: '', lastMessage: msg, participants: [], type: 'direct' });
  }

  // Re-render rooms if on main screen
  if (mainScreen.classList.contains('active')) {
    renderRooms();
  }
});

// ===== 뱃지 실시간 업데이트 =====
socket.on('badges:update', (data) => {
  updateBadges(data);
});

// ===== 타이핑 =====
let typingTimeout;
chatInput.addEventListener('input', () => {
  if (!currentRoom) return;
  socket.emit('typing:start', currentRoom.id);
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => socket.emit('typing:stop', currentRoom.id), 1500);
});

socket.on('typing:update', ({ name, isTyping }) => {
  if (isTyping) {
    typingIndicator.classList.remove('hidden');
    typingIndicator.innerHTML = `${name}님이 입력 중<span class="typing-dots"><span></span><span></span><span></span></span>`;
  } else {
    typingIndicator.classList.add('hidden');
  }
});

socket.on('ai:typing', ({ roomId, isTyping }) => {
  if (currentRoom && currentRoom.id === roomId) {
    if (isTyping) {
      typingIndicator.classList.remove('hidden');
      typingIndicator.innerHTML = `AI가 생각 중<span class="typing-dots"><span></span><span></span><span></span></span>`;
    } else {
      typingIndicator.classList.add('hidden');
    }
  }
});

// ===== 실시간 유저 =====
socket.on('user:online', (user) => {
  if (!friends.find((f) => f.id === user.id)) {
    friends.push(user);
    newFriendIds.add(user.id);
    renderFriends();

    // Update friend badge locally
    badges.friends = newFriendIds.size;
    updateBadges();
  }
});

socket.on('user:offline', (userId) => {
  // Keep in friend list, just mark offline if needed
});

// ===== 유틸 =====
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h < 12 ? '오전' : '오후';
  const hour = h % 12 || 12;
  return `${ampm} ${hour}:${m}`;
}

function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}
