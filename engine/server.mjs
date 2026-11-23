// Minimal static server so the page can import ES modules (file:// blocks them).
import http from 'http'; import fs from 'fs'; import path from 'path';
const types = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.ttf':'font/ttf','.wav':'audio/wav'};
export function serve(root, port = 0) {
  return new Promise(res => {
    const s = http.createServer((req, rsp) => {
      const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
      fs.readFile(p, (err, data) => {
        if (err) { rsp.writeHead(404); return rsp.end(); }
        rsp.writeHead(200, {'Content-Type': types[path.extname(p)] || 'application/octet-stream'}); rsp.end(data);
      });
    }).listen(port, '127.0.0.1', () => res(s));
  });
}
