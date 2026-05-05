import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

// P11: Persistent singleton to avoid double-connections in React Strict Mode / HMR
let socketInstance: Socket | null = null;

export function useSocket() {
  const { user } = useAuth();

  useEffect(() => {
    // 1. If no user (logged out), disconnect existing socket
    if (!user) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
      }
      return;
    }

    // 2. If already connected, do nothing
    if (socketInstance?.connected) {
      return;
    }

    // 3. Initialize connection if not exists
    if (!socketInstance) {
      const socket = io({
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
      socketInstance = socket;

      socket.on('connect', () => {
        console.log('[Socket] Connected to server');
      });

      socket.on('new-notification', (data: { title: string; message: string; link?: string }) => {
        const safeNavigate = (link: string) => {
          if (link.startsWith('/') || link.startsWith(window.location.origin)) {
            window.location.href = link;
          }
        };
        toast.info(data.title, {
          description: data.message,
          action: data.link ? {
            label: '查看',
            onClick: () => safeNavigate(data.link!)
          } : undefined
        });
      });

      socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason);
        // If intentionally disconnected by client (logout), clear singleton
        if (reason === 'io client disconnect') {
          socketInstance = null;
        }
      });
    }

    return () => {
      // P11: In development, we DON'T disconnect on unmount to prevent Strict Mode toggling.
      // The socket stays alive as long as the page is open and user is logged in.
    };
  }, [user]);

  return socketInstance;
}
