const http = require('http');
const { Server } = require('socket.io');

// Servidor independiente en puerto 4444
const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: "*", // Permitimos conexiones desde Next.js
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('Cliente WebSocket conectado:', socket.id);
  socket.on('message', (msg) => {
    io.emit('message', msg);
  });
});

server.listen(4444, '0.0.0.0', () => {
  console.log('Servidor WebSocket independiente corriendo en puerto 4444');
});
