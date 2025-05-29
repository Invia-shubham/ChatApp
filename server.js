// server.js
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const sharedSession = require("express-socket.io-session");
const sendOtp = require("./src/sendOtp");

const Message = require("./src/models/Message");
const User = require("./src/models/User");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const userSocketMap = new Map(); // username -> socket.id

// MongoDB Connection
const MONGO_URL =
  "mongodb+srv://new-user-31:BVjbKBhcu8puOKC3@cluster19986.4ktj0.mongodb.net/chat-app";

mongoose
  .connect(MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// Session
const sessionMiddleware = session({
  secret: "super-secret-key",
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: MONGO_URL }),
  cookie: { maxAge: 1000 * 60 * 60 * 24, 
    // secure: true, sameSite: "strict" 
  },
});

app.use(sessionMiddleware);
io.use(sharedSession(sessionMiddleware, { autoSave: true }));

// Serve static files
app.use(express.static("public"));

// Auth Routes

// Send OTP (used for both login and signup)
app.post("/send-otp", async (req, res) => {
  const { email, username, mode } = req.body;
  if (!email || !mode) return res.status(400).send("Missing email or mode");

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

  let user = await User.findOne({ email });

  if (mode === "signup") {
    if (user) return res.status(400).send("User already exists");
    user = new User({ email, username, otp, otpExpiry: expiry });
  } else if (mode === "login") {
    if (!user) return res.status(404).send("User not found");
    user.otp = otp;
    user.otpExpiry = expiry;
  }

  await user.save();
  await sendOtp(email, otp);

  res.send("OTP sent");
});


// OTP verify for login or signup
app.post("/verify-otp", async (req, res) => {
  const { email, otp, mode } = req.body;
  const user = await User.findOne({ email });

  if (!user || user.otp !== otp || user.otpExpiry < new Date()) {
    return res.status(400).send("Invalid or expired OTP");
  }

  user.otp = null;
  user.otpExpiry = null;

  await user.save();

  req.session.user = { id: user._id, username: user.username, email: user.email };
  res.send(`${mode === "login" ? "Login" : "Signup"} successful`);
});



app.get("/me", (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).send("Not logged in");
  }
});

app.post("/logout", (req, res) => {
  req.session.destroy();
  res.send("Logged out");
});

// All users API
app.get("/all-users", async (req, res) => {
  try {
    const users = await User.find({}, "username"); // only return username field
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Track online users
const onlineUsers = new Map(); // socket.id -> username

function isUserOnline(username) {
  return Array.from(onlineUsers.values()).includes(username);
}

io.on("connection", async (socket) => {
  const user = socket.handshake.session.user;

  if (!user) {
    socket.emit("auth required");
    socket.disconnect();
    return;
  }

  const username = user.username;

  userSocketMap.set(username, socket.id);
  onlineUsers.set(socket.id, username);
  console.log(`📡 ${username} connected`);

  await sendUsersWithStatus(); // notify all clients of updated status

  // Send chat history (public + private for this user)
  const messages = await Message.find({
    $or: [
      { to: null }, // public messages
      { user: username },
      { to: username },
    ],
  }).sort({ time: 1 });

  socket.emit("chat history", messages);

  // Handle chat messages
  socket.on("chat message", async (msg) => {
    const newMsg = new Message({
      user: username,
      text: msg.text,
      time: new Date(),
      to: msg.to || null,
    });

    await newMsg.save();

    if (msg.to) {
      // Private
      const targetSocketId = userSocketMap.get(msg.to);
      if (targetSocketId) {
        io.to(targetSocketId).emit("chat message", newMsg);
        socket.emit("chat message", newMsg); // sender sees own message
      }
    } else {
      // Public
      io.emit("chat message", newMsg);
    }
  });

  socket.on("set username", (username) => {
    userSocketMap.set(username, socket);
    socket.username = username;
  });

  // Typing Indicator
  socket.on("typing", ({ username, to }) => {
    const payload = { username, to };

    if (to) {
      const recipientSocket = getSocketByUsername(to);
      console.log(`[SERVER] Target socket for ${to}:`, recipientSocket?.id);

      if (recipientSocket) {
        io.to(recipientSocket.id).emit("typing", payload);
      }
    } else {
      console.log(`[SERVER] Public typing from ${username}`);
      socket.broadcast.emit("typing", payload);
    }
  });

  // Edit message
  socket.on("edit message", async ({ messageId, newText }) => {
    try {
      const updated = await Message.findByIdAndUpdate(
        messageId,
        { text: newText },
        { new: true }
      );
      if (updated) io.emit("message edited", updated);
    } catch (err) {
      console.error("Edit failed", err);
    }
  });

  // Delete message
  socket.on("delete message", async (messageId) => {
    try {
      await Message.findByIdAndDelete(messageId);
      io.emit("message deleted", messageId);
    } catch (err) {
      console.error("Delete failed", err);
    }
  });

  // Disconnect
  socket.on("disconnect", async () => {
    userSocketMap.delete(username);
    onlineUsers.delete(socket.id);
    console.log(`👋 ${username} disconnected`);

    // ✅ Save last seen timestamp
    await User.updateOne({ username }, { lastSeen: new Date() });

    await sendUsersWithStatus(); // notify all clients again
  });
});

// Broadcasts online/offline status of all users
async function sendUsersWithStatus() {
  const users = await User.find({}, "username lastSeen").lean();
  const usersWithStatus = users.map((u) => ({
    username: u.username,
    online: isUserOnline(u.username),
    lastSeen: u.lastSeen,
  }));

  // Sort users: online users first, then offline
  usersWithStatus.sort((a, b) => {
    if (a.online === b.online) return 0;
    return a.online ? -1 : 1;
  });

  io.emit("users with status", usersWithStatus);
}

function getSocketByUsername(username) {
  const socketId = userSocketMap.get(username);
  return io.sockets.sockets.get(socketId);
}

// Start server
server.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
