const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hola mundo\n');
});
server.listen(4444, '0.0.0.0', () => {
  console.log('Servidor plano corriendo en puerto 4444');
});
