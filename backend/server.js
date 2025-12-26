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
const upload = multer({ 
  dest: 'uploads/', 
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Only videos allowed!'), false);
  }
});

// Socket.io setup
const server = http.createServer(app);
const io = socketIo(server, { 
  cors: { origin: "http://localhost:5173" } 
});

app.use(cors());
app.use(express.json());

// FAKE DATABASE (users + videos)
let users = [{ 
  id: 1, 
  username: 'admin', 
  password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
  role: 'admin', 
  tenantId: 'tenant1' 
}];
let videos = [];

// MIDDLEWARE: Authentication
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token!' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token!' });
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
const roleMiddleware = (allowedRoles) => (req, res, next) => {
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions!' });
  }
  next();
};

// Routes
app.get('/', (req, res) => res.send('🎥 COMPLETE 6/6 VIDEO APP!'));

// LOGIN
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    const token = jwt.sign(
      { id: 1, role: 'admin', tenantId: 'tenant1' }, 
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({ 
      token, 
      user: { role: 'admin', tenantId: 'tenant1' } 
    });
  } else {
    res.status(401).json({ error: 'Wrong credentials! Try: admin/admin123' });
  }
});

// GET VIDEOS (all roles)
app.get('/videos', authMiddleware, tenantMiddleware, (req, res) => {
  const userVideos = videos.filter(v => v.tenantId === req.user.tenantId);
  res.json(userVideos);
});

// UPLOAD VIDEO (Editor/Admin only) - FIXED VERSION
app.post('/upload', 
  authMiddleware, 
  roleMiddleware(['editor', 'admin']), 
  tenantMiddleware, 
  upload.single('video'), 
  (req, res) => {
    const videoId = req.file.filename;
    const video = {
      id: videoId,
      filename: req.file.originalname || `video_${videoId}.mp4`,
      path: `uploads/${videoId}`,
      tenantId: req.user.tenantId,
      uploadedBy: req.user.id,
      status: 'processing',
      safe: null,
      progress: 0,
      createdAt: new Date().toISOString()
    };
    
    videos.push(video);
    console.log('🎉 NEW VIDEO ADDED:', video.filename);
    
    // Real-time progress to tenant room
    io.to(req.user.tenantId).emit('processing-started', { videoId });
    
    // Simulate safety analysis
    setTimeout(() => {
      video.safe = Math.random() > 0.3; // 70% safe
      video.status = video.safe ? 'safe' : 'flagged';
      video.progress = 100;
      
      console.log(`✅ Safety check: ${video.filename} - ${video.safe ? 'SAFE' : 'FLAGGED'}`);
      
      io.to(req.user.tenantId).emit('processing-complete', { 
        videoId, 
        safe: video.safe,
        reason: video.safe ? '✅ No violations detected' : '⚠️ Content flagged for review'
      });
    }, 4000);
    
    res.json({ 
      success: true, 
      videoId, 
      message: 'Upload success! Processing safety check...' 
    });
  }
);

// VIDEO STREAMING with Range Requests
app.get('/video/:id', authMiddleware, tenantMiddleware, (req, res) => {
  const videoPath = path.join(__dirname, `uploads/${req.params.id}`);
  
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Video not found!' });
  }
  
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

// Socket.io tenant rooms
io.on('connection', (socket) => {
  console.log('🔌 User connected');
  
  socket.on('join-tenant', (tenantId) => {
    socket.join(tenantId);
    console.log(`👥 User joined tenant room: ${tenantId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('🔌 User disconnected');
  });
});

server.listen(5000, () => {
  console.log('🚀 COMPLETE 6/6 VIDEO APP running on http://localhost:5000');
  console.log('✅ Login: admin / admin123');
  console.log('📁 Videos saved in uploads/');
});
