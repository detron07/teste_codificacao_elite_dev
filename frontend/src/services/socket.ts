import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function joinLotRoom(lotId: string): void {
  const s = getSocket();
  s.emit('join:lot', { lotId });
}

export function leaveLotRoom(lotId: string): void {
  const s = getSocket();
  s.emit('leave:lot', { lotId });
}

export function joinShowcaseRoom(): void {
  const s = getSocket();
  s.emit('join:showcase');
}
