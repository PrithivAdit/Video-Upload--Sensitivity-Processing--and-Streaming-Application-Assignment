import { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';

const socket = io('http://localhost:5000');

function App() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState(null);
  const [loginData, setLoginData] = useState({ username: '', password: '' });
  const [file, setFile] = useState(null);
  const [videos, setVideos] = useState([]);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [currentVideo, setCurrentVideo] = useState(null);
  const [view, setView] = useState('login'); // login, upload, dashboard

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      socket.emit('join-tenant', 'tenant1');
      setView('dashboard');
      loadVideos();
    }
  }, [token]);

  useEffect(() => {
    socket.on('processing-started', (data) => {
      setProgress(30);
      setStatus('Analyzing video for violations...');
    });
    
    socket.on('processing-complete', (data) => {
      setProgress(100);
      setStatus(data.safe ? '✅ SAFE - Ready to stream!' : '⚠️ FLAGGED');
      loadVideos();
    });
    
    return () => {
      socket.off('processing-started');
      socket.off('processing-complete');
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
    if (!file) return alert('Pick a video!');
    
    setProgress(10);
    setStatus('Uploading...');
    
    const formData = new FormData();
    formData.append('video', file);
    
    try {
      await axios.post('http://localhost:5000/upload', formData);
    } catch (error) {
      alert('Upload failed!');
    }
  };

  const loadVideos = async () => {
    try {
      const res = await axios.get('http://localhost:5000/videos');
      setVideos(res.data);
    } catch (error) {
      console.log('No videos yet');
    }
  };

  const playVideo = (video) => {
    setCurrentVideo(video);
  };

  if (view === 'login') {
    return (
      <div style={{ padding: '50px', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ color: '#4a90e2' }}>🎥 Video App</h1>
        <p>Login: admin / admin123</p>
        <input 
          placeholder="Username" 
          value={loginData.username}
          onChange={(e) => setLoginData({...loginData, username: e.target.value})}
          style={{ display: 'block', margin: '10px auto', padding: '10px', width: '80%' }}
        />
        <input 
          type="password"
          placeholder="Password" 
          value={loginData.password}
          onChange={(e) => setLoginData({...loginData, password: e.target.value})}
          style={{ display: 'block', margin: '10px auto', padding: '10px', width: '80%' }}
        />
        <button onClick={login} style={{ padding: '12px 30px', background: '#4a90e2', color: 'white', border: 'none', borderRadius: '25px' }}>
          Login
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
        <h1 style={{ color: '#4a90e2', margin: 0 }}>🎥 Video Dashboard</h1>
        <div>
          <span style={{ color: user.role === 'admin' ? 'green' : 'orange', fontWeight: 'bold' }}>
            {user.role.toUpperCase()} | Tenant: {user.tenantId}
          </span>
          <button onClick={() => {setToken(''); setView('login')}} style={{ marginLeft: '20px', background: '#ff4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '20px' }}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '30px' }}>
        {/* UPLOAD SECTION */}
        <div style={{ flex: 1, border: '2px solid #4a90e2', borderRadius: '15px', padding: '20px' }}>
          <h2>📤 Upload New Video</h2>
          <input 
            type="file" accept="video/*" 
            onChange={(e) => setFile(e.target.files[0])}
            style={{ margin: '20px 0', padding: '10px', width: '100%', borderRadius: '5px' }}
          />
          <button 
            onClick={uploadVideo}
            disabled={progress > 0}
            style={{
              width: '100%', padding: '15px', background: progress > 0 ? '#ccc' : '#4a90e2', 
              color: 'white', border: 'none', borderRadius: '25px', fontSize: '16px'
            }}
          >
            🚀 Upload & Check
          </button>
          
          {progress > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ width: '100%', height: '25px', background: '#ddd', borderRadius: '12px', marginBottom: '10px' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: '#4a90e2', borderRadius: '12px', transition: 'width 0.4s' }}></div>
              </div>
              <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{progress}% - {status}</div>
            </div>
          )}
        </div>

        {/* VIDEO LIBRARY */}
        <div style={{ flex: 2, border: '2px solid #4a90e2', borderRadius: '15px', padding: '20px' }}>
          <h2>📚 Your Videos ({videos.length})</h2>
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {videos.map(video => (
              <div key={video.id} style={{ 
                padding: '15px', margin: '10px 0', background: '#f8f9fa', 
                borderRadius: '10px', borderLeft: `5px solid ${video.safe ? '#28a745' : '#dc3545'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 'bold' }}>{video.filename}</span>
                  <span style={{ 
                    padding: '5px 12px', background: video.safe ? '#d4edda' : '#f8d7da', 
                    borderRadius: '20px', fontSize: '14px', fontWeight: 'bold'
                  }}>
                    {video.safe ? '✅ SAFE' : '⚠️ FLAGGED'}
                  </span>
                </div>
                <div style={{ marginTop: '10px' }}>
                  <button 
                    onClick={() => playVideo(video)}
                    style={{ 
                      background: '#28a745', color: 'white', border: 'none', 
                      padding: '8px 16px', borderRadius: '20px', cursor: 'pointer'
                    }}
                  >
                    ▶️ Play Video
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* VIDEO PLAYER */}
      {currentVideo && (
        <div style={{ marginTop: '30px', textAlign: 'center', padding: '20px', border: '2px solid #4a90e2', borderRadius: '15px' }}>
          <h3>🎬 Playing: {currentVideo.filename}</h3>
          <video 
            width="800" 
            height="450" 
            controls 
            src={`http://localhost:5000/video/${currentVideo.id}`}
            style={{ borderRadius: '10px' }}
          >
            Your browser doesn't support video.
          </video>
          <div style={{ marginTop: '15px', fontSize: '18px', fontWeight: 'bold', color: currentVideo.safe ? '#28a745' : '#dc3545' }}>
            Status: {currentVideo.safe ? '✅ SAFE' : '⚠️ FLAGGED'}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
