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

/**
 * Адрес сайта (SITE_URL) для canonical, og:url/og:image и sitemap.xml. Без него ссылки
 * остаются относительными, а sitemap не создаётся.
 */
function site(env) {
  const url = (env.SITE_URL ?? '').replace(/\/+$/, '');
  return {
    name: 'site-url',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', url),
    generateBundle() {
      const robots = ['User-agent: *', 'Allow: /'];
      if (url) {
        robots.push(`Sitemap: ${url}/sitemap.xml`);
        this.emitFile({
          type: 'asset',
          fileName: 'sitemap.xml',
          source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${url}/</loc></url>\n</urlset>\n`,
        });
      }
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `${robots.join('\n')}\n` });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['UMAMI_', 'SITE_']);
  return {
    plugins: [preact(), umami(env), site(env)],
    server: { port: 5300, strictPort: true },
    preview: { port: 4300, strictPort: true },
  };
});
