import preact from '@preact/preset-vite';
import { defineConfig, loadEnv } from 'vite';

/**
 * Скрипт Umami в index.html — только в сборке и только если заданы UMAMI_URL и UMAMI_WEBSITE_ID
 * (переменные окружения или .env). UMAMI_DOMAINS ограничивает учёт этими доменами.
 */
function umami(env) {
  return {
    name: 'umami',
    apply: 'build',
    transformIndexHtml() {
      if (!env.UMAMI_URL || !env.UMAMI_WEBSITE_ID) return undefined;
      const attrs = {
        defer: true,
        src: new URL('/script.js', env.UMAMI_URL).href,
        'data-website-id': env.UMAMI_WEBSITE_ID,
      };
      if (env.UMAMI_DOMAINS) attrs['data-domains'] = env.UMAMI_DOMAINS;
      return [{ tag: 'script', attrs, injectTo: 'head' }];
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'UMAMI_');
  return {
    plugins: [preact(), umami(env)],
    server: { port: 5300, strictPort: true },
    preview: { port: 4300, strictPort: true },
  };
});
