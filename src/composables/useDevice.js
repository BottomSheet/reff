/**
 * useDevice.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Определяет платформу пользователя и генерирует стабильный deviceId.
 *
 * КАК РАБОТАЕТ deviceId:
 *   При первом посещении генерируем UUID и сохраняем в localStorage.
 *   При каждом следующем визите возвращаем тот же ID.
 *   Это позволяет серверу связать «переход по реферальной ссылке в браузере»
 *   с «первым запуском приложения», даже если между ними прошло несколько дней.
 *
 *   ВАЖНО: localStorage очищается если пользователь удаляет данные браузера.
 *   Для более надёжной идентификации можно заменить на FingerprintJS.
 *
 * КАК РАБОТАЕТ определение платформы:
 *   Смотрим userAgent строку браузера. Это стандартная практика.
 *   iPad в режиме Desktop имитирует Mac, поэтому проверяем maxTouchPoints.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function useDevice() {
  // Генерация / получение deviceId
  function getDeviceId() {
    const KEY = 'ref_device_id'
    try {
      let id = localStorage.getItem(KEY)
      if (!id) {
        // crypto.randomUUID() — нативный метод, работает во всех современных браузерах
        id = crypto.randomUUID()
        localStorage.setItem(KEY, id)
      }
      return id
    } catch {
      // localStorage может быть заблокирован в приватном режиме (особенно Safari).
      // В этом случае генерируем временный ID на сессию — он не сохранится,
      // но запрос на сервер всё равно уйдёт.
      return crypto.randomUUID()
    }
  }

  // Определение платформы 
  function getPlatform() {
    const ua = navigator.userAgent

    // iPhone, iPad (старый UserAgent), iPod
    if (/iPad|iPhone|iPod/.test(ua)) return 'ios'

    // iPad с включённым "Desktop Mode" — представляется как MacIntel,
    // но у него есть несколько точек касания
    if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return 'ios'

    // Android
    if (/Android/.test(ua)) return 'android'

    // Всё остальное — десктоп
    return 'desktop'
  }

  return {
    deviceId: getDeviceId(),
    platform: getPlatform()
  }
}
