import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export function useSocket() {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    if (!socketRef.current) {
      const socket = io();
      socketRef.current = socket;

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

      socket.on('disconnect', () => {
        console.log('[Socket] Disconnected');
      });
    }

    return () => {
      // Keep socket alive across re-renders, only disconnect on logout
    };
  }, [user]);

  return socketRef.current;
}
