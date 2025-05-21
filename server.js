// server.js
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const sharedSession = require("express-socket.io-session");

const Message = require("./src/models/Message");
const User = require("./src/models/User");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

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
  cookie: { maxAge: 1000 * 60 * 60 * 24 },
});

app.use(sessionMiddleware);
io.use(sharedSession(sessionMiddleware, { autoSave: true }));

// Serve static files
app.use(express.static("public"));

// Auth Routes
app.post("/signup", async (req, res) => {
  const { username, password } = req.body;
  const existingUser = await User.findOne({ username });
  if (existingUser) return res.status(400).send("Username already exists");

  const hashed = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashed });
  await user.save();

  req.session.user = { id: user._id, username: user.username };
  res.status(200).send("Signup successful");
});

app.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).send("Invalid credentials");
  }

  req.session.user = { id: user._id, username: user.username };
  res.status(200).send("Login successful");
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

// Track online users
const onlineUsers = new Map();

io.on("connection", (socket) => {
  const user = socket.handshake.session.user;
  if (!user) {
    socket.emit("auth required");
    socket.disconnect();
    return;
  }

  const username = user.username;
  onlineUsers.set(socket.id, username);
  console.log(`📡 ${username} connected`);

  // Notify clients about online users
  io.emit("online users", Array.from(new Set(onlineUsers.values())));

  // Send message history
  Message.find()
    .sort({ time: 1 })
    .limit(50)
    .then((messages) => {
      socket.emit("chat history", messages);
    });

  // Handle new message
  socket.on("chat message", async (msg) => {
    const newMsg = new Message({
      user: username,
      text: msg.text,
      time: new Date(),
    });

    await newMsg.save();
    io.emit("chat message", newMsg);
  });

  // Handle message edit
  socket.on("edit message", async ({ messageId, newText }) => {
    try {
      const updated = await Message.findByIdAndUpdate(
        messageId,
        { text: newText },
        { new: true }
      );
      if (updated) {
        io.emit("message edited", updated);
      }
    } catch (err) {
      console.error("Edit failed", err);
    }
  });

  // Handle message delete
  socket.on("delete message", async (messageId) => {
    try {
      await Message.findByIdAndDelete(messageId);
      io.emit("message deleted", messageId);
    } catch (err) {
      console.error("Delete failed", err);
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    onlineUsers.delete(socket.id);
    io.emit("online users", Array.from(new Set(onlineUsers.values())));
    console.log(`👋 ${username} disconnected`);
  });
});

// Start server
server.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
