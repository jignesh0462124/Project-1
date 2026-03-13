import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
  }

  connect() {
    if (this.socket && this.connected) {
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
    });

    this.socket.on('connect', () => {
      console.log('🔗 Connected to server:', this.socket.id);
      this.connected = true;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected from server:', reason);
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      this.connected = false;
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  getSocket() {
    return this.socket;
  }

  isConnected() {
    return this.connected && this.socket?.connected;
  }
}

// Singleton instance
const socketService = new SocketService();
export default socketService;