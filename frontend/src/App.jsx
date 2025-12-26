import { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

const socket = io('http://localhost:5000');

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [loginData, setLoginData] = useState({ username: 'admin', password: 'admin123' });
  const [file, setFile] = useState(null);
  const [videos, setVideos] = useState([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [currentVideo, setCurrentVideo] = useState(null);
  const [view, setView] = useState('login');
  const [processingVideoId, setProcessingVideoId] = useState('');

  // Setup axios auth
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      socket.emit('join-tenant', 'tenant1');
      setView('dashboard');
      loadVideos();
    } else {
      localStorage.removeItem('token');
      setView('login');
    }
  }, [token]);

  // Socket listeners
  useEffect(() => {
    const handleProcessingStarted = (data) => {
      setProcessingVideoId(data.videoId);
      setProgress(30);
      setStatus('🔍 Analyzing video frames for violations...');
    };

    const handleProcessingComplete = (data) => {
      setProgress(100);
      setStatus(data.safe ? '✅ SAFE - Ready to stream!' : '⚠️ FLAGGED - Review required');
      setProcessingVideoId('');
      loadVideos();
    };

    socket.on('processing-started', handleProcessingStarted);
    socket.on('processing-complete', handleProcessingComplete);

    return () => {
      socket.off('processing-started', handleProcessingStarted);
      socket.off('processing-complete', handleProcessingComplete);
    };
  }, []);

  const login = async () => {
    try {
      const res = await axios.post('http://localhost:5000/login', loginData);
      setToken(res.data.token);
      setUser(res.data.user);
    } catch (error) {
      alert('Login failed! Try: admin / admin123');
    }
  };

  const uploadVideo = async () => {
    if (!file) {
      alert('Please select a video file!');
      return;
    }

    setProgress(10);
    setStatus('📤 Uploading video...');
    
    const formData = new FormData();
    formData.append('video', file);
    
    try {
      await axios.post('http://localhost:5000/upload', formData);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed! Make sure backend is running.');
      setProgress(0);
      setStatus('');
    }
  };

  const loadVideos = useCallback(async () => {
    try {
      const res = await axios.get('http://localhost:5000/videos');
      setVideos(res.data);
    } catch (error) {
      console.log('No videos or auth error');
    }
  }, []);

  const playVideo = (video) => {
    setCurrentVideo(video);
  };

  const logout = () => {
    setToken('');
    setUser(null);
    setVideos([]);
    setCurrentVideo(null);
  };

  if (view === 'login') {
    return (
      <div style={styles.loginContainer}>
        <h1 style={styles.title}>🎥 Smart Video Platform</h1>
        <p style={styles.subtitle}>Complete 6/6 Features</p>
        <div style={styles.loginForm}>
          <input 
            placeholder="Username" 
            value={loginData.username}
            onChange={(e) => setLoginData({...loginData, username: e.target.value})}
            style={styles.input}
          />
          <input 
            type="password"
            placeholder="Password" 
            value={loginData.password}
            onChange={(e) => setLoginData({...loginData, password: e.target.value})}
            style={styles.input}
          />
          <button onClick={login} style={styles.loginButton}>
            🚀 Login
          </button>
          <p style={{ marginTop: '20px', color: '#666', fontSize: '14px' }}>
            Try: <strong>admin</strong> / <strong>admin123</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.appContainer}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>🎥 Video Dashboard</h1>
        <div style={styles.userInfo}>
          <span style={styles.roleBadge}>
            {user.role.toUpperCase()} | Tenant: {user.tenantId}
          </span>
          <button onClick={logout} style={styles.logoutButton}>
            🚪 Logout
          </button>
        </div>
      </div>

      <div style={styles.mainContent}>
        {/* Upload Section */}
        <div style={styles.uploadSection}>
          <h2 style={styles.sectionTitle}>📤 Upload New Video</h2>
          <input 
            type="file" 
            accept="video/*" 
            onChange={(e) => setFile(e.target.files[0])}
            style={styles.fileInput}
          />
          <button 
            onClick={uploadVideo}
            disabled={progress > 0}
            style={{
              ...styles.uploadButton,
              background: progress > 0 ? '#ccc' : '#4a90e2',
              cursor: progress > 0 ? 'not-allowed' : 'pointer'
            }}
          >
            🚀 Upload & Analyze
          </button>
          
          {progress > 0 && (
            <div style={styles.progressContainer}>
              <div style={styles.progressBar}>
                <div 
                  style={{
                    ...styles.progressFill,
                    width: `${progress}%`
                  }}
                />
              </div>
              <div style={styles.progressText}>
                {progress}% - {status}
              </div>
            </div>
          )}
        </div>

        {/* Video Library */}
        <div style={styles.videosSection}>
          <h2 style={styles.sectionTitle}>📚 Your Videos ({videos.length})</h2>
          <div style={styles.videosList}>
            {videos.map(video => (
              <div key={video.id} style={styles.videoCard(video.safe)}>
                <div style={styles.videoHeader}>
                  <span style={styles.videoName}>{video.filename}</span>
                  <span style={styles.statusBadge(video.safe)}>
                    {video.safe ? '✅ SAFE' : '⚠️ FLAGGED'}
                  </span>
                </div>
                <div style={styles.videoStatus}>
                  <span>Status: {video.status.toUpperCase()}</span>
                  <span>{new Date(video.createdAt).toLocaleString()}</span>
                </div>
                <button 
                  onClick={() => playVideo(video)}
                  style={styles.playButton}
                  disabled={video.status !== 'safe' && video.status !== 'flagged'}
                >
                  ▶️ Play Video
                </button>
              </div>
            ))}
            {videos.length === 0 && (
              <div style={styles.emptyState}>
                No videos yet. Upload one to get started! 🎥
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Video Player */}
      {currentVideo && (
        <div style={styles.playerSection}>
          <h3 style={styles.playerTitle}>🎬 Now Playing: {currentVideo.filename}</h3>
          <video 
            width="900" 
            height="500" 
            controls 
            src={`http://localhost:5000/video/${currentVideo.id}`}
            style={styles.videoPlayer}
            preload="metadata"
          >
            Your browser doesn't support video playback.
          </video>
          <div style={{
            ...styles.statusBadge(currentVideo.safe),
            ...styles.playerStatus,
            marginTop: '15px'
          }}>
            Safety Status: {currentVideo.safe ? '✅ SAFE' : '⚠️ FLAGGED'}
          </div>
          <button 
            onClick={() => setCurrentVideo(null)}
            style={styles.closePlayerButton}
          >
            ❌ Close Player
          </button>
        </div>
      )}
    </div>
  );
}

// STYLES
const styles = {
  loginContainer: {
    padding: '80px 20px',
    maxWidth: '500px',
    margin: '0 auto',
    textAlign: 'center',
    fontFamily: 'Arial, sans-serif'
  },
  title: { color: '#4a90e2', marginBottom: '10px' },
  subtitle: { color: '#666', marginBottom: '40px', fontSize: '18px' },
  loginForm: { maxWidth: '350px', margin: '0 auto' },
  input: {
    display: 'block',
    width: '100%',
    padding: '15px',
    margin: '15px 0',
    border: '2px solid #ddd',
    borderRadius: '10px',
    fontSize: '16px',
    boxSizing: 'border-box'
  },
  loginButton: {
    width: '100%',
    padding: '15px',
    background: '#4a90e2',
    color: 'white',
    border: 'none',
    borderRadius: '25px',
    fontSize: '18px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  appContainer: {
    padding: '20px',
    maxWidth: '1400px',
    margin: '0 auto',
    fontFamily: 'Arial, sans-serif',
    background: '#f8f9fa'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    paddingBottom: '20px',
    borderBottom: '3px solid #4a90e2'
  },
  userInfo: { display: 'flex', alignItems: 'center', gap: '15px' },
  roleBadge: {
    padding: '8px 16px',
    background: '#4a90e2',
    color: 'white',
    borderRadius: '25px',
    fontWeight: 'bold'
  },
  logoutButton: {
    background: '#ff4444',
    color: 'white',
    border: 'none',
    padding: '10px 20px',
    borderRadius: '25px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  mainContent: { display: 'flex', gap: '30px', marginBottom: '30px' },
  uploadSection: {
    flex: 1,
    background: 'white',
    padding: '30px',
    borderRadius: '20px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
    border: '3px solid #4a90e2'
  },
  videosSection: {
    flex: 2,
    background: 'white',
    padding: '30px',
    borderRadius: '20px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
    border: '3px solid #4a90e2',
    maxHeight: '700px',
    overflow: 'hidden'
  },
  sectionTitle: { color: '#333', marginBottom: '25px', fontSize: '24px' },
  fileInput: {
    width: '100%',
    padding: '15px',
    margin: '20px 0',
    border: '2px dashed #4a90e2',
    borderRadius: '15px',
    background: '#f8f9ff',
    cursor: 'pointer'
  },
  uploadButton: {
    width: '100%',
    padding: '18px',
    color: 'white',
    border: 'none',
    borderRadius: '30px',
    fontSize: '18px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  progressContainer: { marginTop: '25px' },
  progressBar: {
    width: '100%',
    height: '25px',
    background: '#e9ecef',
    borderRadius: '15px',
    overflow: 'hidden',
    marginBottom: '15px',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #4a90e2, #357abd)',
    borderRadius: '15px',
    transition: 'width 0.4s ease',
    boxShadow: '0 0 20px rgba(74, 144, 226, 0.5)'
  },
  progressText: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center'
  },
  videosList: {
    maxHeight: '550px',
    overflowY: 'auto',
    paddingRight: '10px'
  },
  videoCard: (isSafe) => ({
    padding: '20px',
    marginBottom: '15px',
    background: '#f8f9fa',
    borderRadius: '15px',
    borderLeft: `6px solid ${isSafe ? '#28a745' : '#dc3545'}`,
    boxShadow: '0 5px 15px rgba(0,0,0,0.08)',
    transition: 'all 0.3s ease'
  }),
  videoHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  videoName: { fontWeight: 'bold', fontSize: '16px', color: '#333', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis' },
  statusBadge: (isSafe) => ({
    padding: '8px 16px',
    background: isSafe ? '#d4edda' : '#f8d7da',
    color: isSafe ? '#155724' : '#721c24',
    borderRadius: '25px',
    fontSize: '14px',
    fontWeight: 'bold'
  }),
  videoStatus: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '14px',
    color: '#666',
    marginBottom: '15px'
  },
  playButton: {
    width: '100%',
    padding: '12px',
    background: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '25px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer'
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: '#666',
    fontSize: '18px',
    fontStyle: 'italic'
  },
  playerSection: {
    background: 'white',
    padding: '40px',
    borderRadius: '20px',
    boxShadow: '0 15px 40px rgba(0,0,0,0.15)',
    border: '3px solid #4a90e2',
    textAlign: 'center',
    marginTop: '30px'
  },
  playerTitle: {
    color: '#333',
    marginBottom: '25px',
    fontSize: '28px'
  },
  videoPlayer: {
    borderRadius: '20px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
    maxWidth: '100%'
  },
  playerStatus: {
    fontSize: '20px',
    fontWeight: 'bold',
    padding: '15px 30px',
    margin: '20px 0',
    borderRadius: '30px',
    display: 'inline-block'
  },
  closePlayerButton: {
    marginTop: '20px',
    padding: '12px 30px',
    background: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '25px',
    fontSize: '16px',
    cursor: 'pointer',
    fontWeight: 'bold'
  }
};

export default App;
