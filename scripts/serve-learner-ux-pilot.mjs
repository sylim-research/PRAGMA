// Offline localhost UX host. The unused client gets placeholders, not credentials.
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
process.env.VITE_SUPABASE_URL = 'http://127.0.0.1:54321';
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = 'local-ux-unused-placeholder';
const server = await createServer({
  root,
  configFile: resolve(root, 'vite.config.ts'),
  envDir: resolve(root, '.tmp/offline-pilot-env'),
  cacheDir: resolve(root, '.tmp/vite-pilot-cache'),
  server: { host: '127.0.0.1', port: 8081, strictPort: true },
});
await server.listen();
server.printUrls();
