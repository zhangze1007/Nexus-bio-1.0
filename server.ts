import { createServer } from 'node:http';
import { parse } from 'node:url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

/** User info stored per socket connection in a project room */
interface ProjectUser {
  userId: string;
  userName: string;
  cursor?: { x: number; y: number; toolId: string };
}

/** projectId -> (socketId -> ProjectUser) */
const projectUsers = new Map<string, Map<string, ProjectUser>>();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || `http://${hostname}:${port}`,
      methods: ['GET', 'POST'],
    },
    path: '/api/ws',
  });

  io.on('connection', (socket) => {
    console.log(`[WS] Client connected: ${socket.id}`);

    // ── Join a project room ─────────────────────────────────────────────────
    socket.on(
      'join:project',
      (data: { projectId: string; userId: string; userName: string }) => {
        const { projectId, userId, userName } = data;
        const room = `project:${projectId}`;

        socket.join(room);

        if (!projectUsers.has(projectId)) {
          projectUsers.set(projectId, new Map());
        }
        projectUsers.get(projectId)!.set(socket.id, { userId, userName });

        // Notify others in the room
        socket.to(room).emit('user:joined', { userId, userName });

        // Send current users list to the joining user
        const users = Array.from(projectUsers.get(projectId)!.values());
        socket.emit('users:list', users);

        console.log(`[WS] ${userName} joined project ${projectId}`);
      },
    );

    // ── Leave a project room ────────────────────────────────────────────────
    socket.on('leave:project', (data: { projectId: string }) => {
      const { projectId } = data;
      const room = `project:${projectId}`;

      socket.leave(room);

      const userInfo = projectUsers.get(projectId)?.get(socket.id);
      if (userInfo) {
        projectUsers.get(projectId)!.delete(socket.id);
        socket.to(room).emit('user:left', { userId: userInfo.userId });
        console.log(`[WS] ${userInfo.userName} left project ${projectId}`);
      }
    });

    // ── Cursor presence ─────────────────────────────────────────────────────
    socket.on(
      'cursor:move',
      (data: {
        projectId: string;
        userId: string;
        x: number;
        y: number;
        toolId: string;
      }) => {
        // Update stored cursor position
        const users = projectUsers.get(data.projectId);
        if (users) {
          const user = users.get(socket.id);
          if (user) {
            user.cursor = { x: data.x, y: data.y, toolId: data.toolId };
          }
        }

        socket.to(`project:${data.projectId}`).emit('cursor:update', data);
      },
    );

    // ── Chat messages ───────────────────────────────────────────────────────
    socket.on(
      'chat:message',
      (data: {
        projectId: string;
        userId: string;
        userName: string;
        message: string;
        timestamp: string;
      }) => {
        // Broadcast to all in the room including sender
        io.to(`project:${data.projectId}`).emit('chat:message', data);
      },
    );

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      // Remove from all projects this socket was part of
      for (const [projectId, users] of projectUsers.entries()) {
        const userInfo = users.get(socket.id);
        if (userInfo) {
          users.delete(socket.id);
          socket.to(`project:${projectId}`).emit('user:left', {
            userId: userInfo.userId,
          });
          console.log(
            `[WS] ${userInfo.userName} left project ${projectId} (disconnect)`,
          );
        }
      }
      console.log(`[WS] Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log(`> Socket.io path: /api/ws`);
    console.log(`> Mode: ${dev ? 'development' : 'production'}`);
  });
});
