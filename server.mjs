// Tiny zero-dep server: serves the app + proxies /eds/* to the AEM EDS origin (EDS sends no CORS headers).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
const ORIGIN = process.env.EDS_ORIGIN || 'https://main--frescopa--kunwarsaluja.aem.live';
const PREVIEW = process.env.EDS_PREVIEW || ORIGIN.replace('.aem.live', '.aem.page');
const PORT = process.env.PORT || 4321;
const log = [];
http.createServer(async (req, res) => {
  if (req.url.startsWith('/eds/') || req.url.startsWith('/edspage/')) {
    const page = req.url.startsWith('/edspage/');
    const target = page ? PREVIEW + req.url.slice(8) : ORIGIN + req.url.slice(4);
    const t = Date.now();
    const r = await fetch(target, { headers: { 'user-agent': 'FrescopaApp/1.0 (headless)' } });
    const buf = Buffer.from(await r.arrayBuffer());
    log.unshift({ at: new Date().toISOString(), url: target, status: r.status, ms: Date.now() - t, bytes: buf.length, type: r.headers.get('content-type') });
    log.length = Math.min(log.length, 50);
    res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/octet-stream', 'cache-control': 'no-store' });
    return res.end(buf);
  }
  if (req.url === '/__log') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ origin: ORIGIN, log })); }
  try {
    const pth = req.url.split('?')[0]; const f = pth === '/' ? 'index.html' : pth.slice(1);
    if (f.includes('..')) throw new Error();
    const body = await readFile(new URL(f, import.meta.url));
    const type = f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body);
  } catch {
    // unknown local path: forward to EDS (lets aem-embed resolve /scripts, /blocks, /media_* same-origin)
    const r = await fetch(ORIGIN + req.url);
    res.writeHead(r.status, { 'content-type': r.headers.get('content-type') || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(Buffer.from(await r.arrayBuffer()));
  }
}).listen(PORT, () => console.log(`Frescopa app on http://localhost:${PORT}  (content from ${ORIGIN})`));
