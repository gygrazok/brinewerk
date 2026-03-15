import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };

createServer(async (req, res) => {
  const url = req.url === '/' ? '/poc-creatures.html' : req.url;
  try {
    const data = await readFile(join(process.cwd(), url));
    res.writeHead(200, { 'Content-Type': MIME[extname(url)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(3000, () => console.log('http://localhost:3000'));
