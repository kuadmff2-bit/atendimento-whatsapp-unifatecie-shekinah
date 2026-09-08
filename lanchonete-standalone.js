require('./lanchonete-v2');

const http = require('http');
const port = Number(process.env.PORT || 8080);

http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Robô da lanchonete online');
}).listen(port, '0.0.0.0', () => {
  console.log(`🍔 Serviço exclusivo da lanchonete ouvindo na porta ${port}.`);
});
