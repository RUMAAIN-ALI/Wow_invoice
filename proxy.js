/**
 * Local dev proxy — forwards AI requests to Anthropic, adding the API key.
 * Run: node proxy.js
 * Expo web calls http://localhost:3001/api/anthropic instead of Anthropic directly.
 */

const http  = require('http');
const https = require('https');
const fs    = require('fs');

// Read API key from .env (no dotenv dependency needed)
let API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY || '';
if (!API_KEY) {
  try {
    const env   = fs.readFileSync('.env', 'utf8');
    const match = env.match(/EXPO_PUBLIC_ANTHROPIC_API_KEY=(.+)/);
    if (match) API_KEY = match[1].trim();
  } catch {}
}

const PORT = 3001;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

http.createServer((req, res) => {
  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/api/anthropic') {
    res.writeHead(404, CORS_HEADERS);
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }

  if (!API_KEY) {
    res.writeHead(500, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'EXPO_PUBLIC_ANTHROPIC_API_KEY not set in .env' }));
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    const bodyBuf = Buffer.from(body);
    const options = {
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      method:   'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length':    bodyBuf.length,
      },
    };

    const proxyReq = https.request(options, proxyRes => {
      const outHeaders = { ...CORS_HEADERS, 'Content-Type': 'application/json' };
      res.writeHead(proxyRes.statusCode, outHeaders);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', err => {
      res.writeHead(502, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });

    proxyReq.write(bodyBuf);
    proxyReq.end();
  });
}).listen(PORT, () => {
  console.log(`\n✓ AI proxy ready → http://localhost:${PORT}/api/anthropic`);
  console.log(`  API key: ${API_KEY ? API_KEY.slice(0, 20) + '…' : 'NOT FOUND'}\n`);
});
