import { createServer } from 'node:http';
import { handler } from './handler.js';

const PORT = 3001;

// Thin wrapper: HTTP request → Lambda event V2 → handler → HTTP response
createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString();

  const url = new URL(req.url, `http://${req.headers.host}`);
  const rawPath = url.pathname.replace(/^\/api/, '') || '/';

  const event = {
    requestContext: { http: { method: req.method, path: rawPath } },
    body: body || undefined,
  };

  const result = await handler(event);

  const responseHeaders = result.headers ?? {};
  for (const [k, v] of Object.entries(responseHeaders)) {
    res.setHeader(k, v);
  }
  res.statusCode = result.statusCode ?? 200;
  res.end(result.body);
}).listen(PORT, () => {
  console.log(`Lambda dev server running on http://localhost:${PORT}`);
});
