const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const JWT_SECRET = 'supersecretkey123';

// Make uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Multer setup
const upload = multer({ dest: 'uploads/', limits: { fileSize: 100 * 1024 * 1024 } });

// Socket.io setup
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "http://localhost:5173" } });

app.use(cors());
app.use(express.json());

// FAKE DATABASE (users + videos)
let users = [{ id: 1, username: 'admin', password: '$2a$10$...', role: 'admin', tenantId: 'tenant1' }];
let videos = [];

// MIDDLEWARE: Check login + role + tenant
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token!' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Bad token!' });
  }
};

// Check tenant match
const tenantMiddleware = (req, res, next) => {
  if (req.user.tenantId !== 'tenant1') {
    return res.status(403).json({ error: 'Wrong tenant!' });
  }
  next();
};

// Check role
const roleMiddleware = (roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Wrong role!' });
  }
  next();
};

// Routes
app.get('/', (req, res) => res.send('🎥 COMPLETE VIDEO APP 6/6!'));

// LOGIN (simple)
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  // Fake check
  if (username === 'admin' && password === 'admin123') {
    const token = jwt.sign({ id: 1, role: 'admin', tenantId: 'tenant1' }, JWT_SECRET);
    res.json({ token, user: { role: 'admin', tenantId: 'tenant1' } });
  } else {
    res.status(401).json({ error: 'Wrong credentials!' });
  }
});

// UPLOAD (Editor/Admin only)
app.post('/upload', authMiddleware, roleMiddleware(['editor', 'admin']), tenantMiddleware, upload.single('video'), (req, res) => {
  const videoId = req.file.filename;
  const video = {
    id: videoId,
    filename: req.file.originalname,
    path: `uploads/${videoId}`,
    tenantId: req.user.tenantId,
    uploadedBy: req.user.id,
    status: 'processing',
    safe: null,
    progress: 0,
    createdAt: new Date()
  };
  videos.push(video);
  
  io.to(req.user.tenantId).emit('processing-started', { videoId });
  
  // FAKE SAFETY CHECK + STREAMING PREP
  setTimeout(() => {
    video.safe = Math.random() > 0.3;
    video.status = video.safe ? 'safe' : 'flagged';
    video.progress = 100;
    
    io.to(req.user.tenantId).emit('processing-complete', { 
      videoId, 
      safe: video.safe,
      reason: video.safe ? '✅ No violations' : '⚠️ Content flagged'
    });
    
    res.json({ success: true, videoId, message: 'Processing complete!' });
  }, 5000);
  
  res.json({ success: true, videoId, message: 'Upload success! Processing...' });
});

// VIDEO LIST (all roles)
app.get('/videos', authMiddleware, tenantMiddleware, (req, res) => {
  const userVideos = videos.filter(v => v.tenantId === req.user.tenantId);
  res.json(userVideos);
});

// STREAM VIDEO (Viewer/Editor/Admin)
app.get('/video/:id', authMiddleware, tenantMiddleware, (req, res) => {
  const videoPath = `uploads/${req.params.id}`;
  if (!fs.existsSync(videoPath)) return res.status(404).json({ error: 'Video not found' });
  
  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;
  
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    
    const stream = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4',
    };
    res.writeHead(206, head);
    stream.pipe(res);
  } else {
    res.writeHead(200, { 
      'Content-Length': fileSize, 
      'Content-Type': 'video/mp4' 
    });
    fs.createReadStream(videoPath).pipe(res);
  }
});

io.on('connection', (socket) => {
  socket.on('join-tenant', (tenantId) => {
    socket.join(tenantId);
    console.log(`User joined tenant: ${tenantId}`);
  });
});

server.listen(5000, () => {
  console.log('🚀 COMPLETE 6/6 VIDEO APP running on http://localhost:5000');
});
