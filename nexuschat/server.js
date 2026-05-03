const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

// Store recent messages (in-memory, resets on restart)
const messages = [];
const MAX_MESSAGES = 50;
const onlineUsers = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Send message history to new user
  socket.emit('message:history', messages);

  // User joins with a username
  socket.on('user:join', (username) => {
    const user = { id: socket.id, username, color: randomColor() };
    onlineUsers.set(socket.id, user);
    socket.username = username;
    socket.userColor = user.color;

    io.emit('users:update', [...onlineUsers.values()]);
    io.emit('message:system', {
      text: `${username} joined the room`,
      timestamp: Date.now()
    });
  });

  // Handle incoming chat messages
  socket.on('message:send', (text) => {
    if (!text || !text.trim()) return;
    const user = onlineUsers.get(socket.id);
    if (!user) return;

    const msg = {
      id: Date.now(),
      username: user.username,
      color: user.color,
      text: text.trim().slice(0, 500),
      timestamp: Date.now()
    };

    messages.push(msg);
    if (messages.length > MAX_MESSAGES) messages.shift();

    io.emit('message:new', msg);
  });

  // Typing indicator
  socket.on('typing:start', () => {
    const user = onlineUsers.get(socket.id);
    if (user) socket.broadcast.emit('typing:update', { username: user.username, typing: true });
  });

  socket.on('typing:stop', () => {
    const user = onlineUsers.get(socket.id);
    if (user) socket.broadcast.emit('typing:update', { username: user.username, typing: false });
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      onlineUsers.delete(socket.id);
      io.emit('users:update', [...onlineUsers.values()]);
      io.emit('message:system', {
        text: `${user.username} left the room`,
        timestamp: Date.now()
      });
    }
  });
});

function randomColor() {
  const colors = ['#e74c3c','#e67e22','#f1c40f','#2ecc71','#1abc9c','#3498db','#9b59b6','#e91e63'];
  return colors[Math.floor(Math.random() * colors.length)];
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

