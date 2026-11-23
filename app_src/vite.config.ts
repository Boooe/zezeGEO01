import path from 'path';
import { defineConfig } from '@lark-apaas/coding-preset-vite-react';
import { randomBytes } from 'crypto';

const CSRF_COOKIE_NAME = 'suda-csrf-token';

function devCsrfCookiePlugin() {
  return {
    name: 'dev-csrf-cookie',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const cookieHeader = req.headers.cookie || '';
        const match = cookieHeader.match(
          new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]+)`),
        );
        if (!match) {
          const token = randomBytes(24).toString('hex');
          res.setHeader('Set-Cookie', [
            `${CSRF_COOKIE_NAME}=${token}; Path=/; Max-Age=2592000; SameSite=Lax`,
          ]);
          req.headers.cookie = cookieHeader
            ? `${cookieHeader}; ${CSRF_COOKIE_NAME}=${token}`
            : `${CSRF_COOKIE_NAME}=${token}`;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client/src'),
    },
  },
  plugins: [devCsrfCookiePlugin()],
});
