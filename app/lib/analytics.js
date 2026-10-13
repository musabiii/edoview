// События Umami. Скрипт подключается только в продакшен-сборке (vite.config.js); если его нет
// или он заблокирован, вызовы ничего не делают. Содержимое документов не отправляем —
// только название действия и его вид.

/**
 * @param {string} name
 * @param {Record<string, string|number|boolean>} [data]
 */
export function track(name, data) {
  try {
    window.umami?.track(name, data);
  } catch {
    // аналитика не должна ломать приложение
  }
}
