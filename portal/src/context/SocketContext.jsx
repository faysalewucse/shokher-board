import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { SERVER_BASE_URL } from '@/services/api';

/**
 * One shared Socket.IO connection per signed-in session. Notifications and
 * board realtime both ride on it (the server puts each socket in `user:<id>`
 * and boards add `board:<id>` rooms on demand).
 */
const SocketContext = createContext({ socket: null, connected: false });

// eslint-disable-next-line react-refresh/only-export-components
export const useSocket = () => useContext(SocketContext);

const createSocket = () =>
  // Empty base URL (relative VITE_API_URL) means same origin — vite proxies /socket.io.
  io(SERVER_BASE_URL || undefined, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    // Callback form re-reads the token on every (re)connect attempt.
    auth: (cb) => cb({ token: localStorage.getItem('shokherboard.token') }),
  });

export function SocketProvider({ children }) {
  const [socket] = useState(createSocket);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    if (localStorage.getItem('shokherboard.token')) socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}
