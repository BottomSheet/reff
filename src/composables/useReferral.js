/**
 * useReferral.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Вся бизнес-логика реферальной системы в одном месте.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ПОЛНЫЙ ФЛОУ:
 *
 * 1. Пользователь переходит по ссылке: https://ref.myapp.com/?ref=ABC123
 *
 * 2. Страница пытается открыть приложение через deep link:
 * myapp://referral?ref=ABC123&device=UUID
 *
 * 3а. Приложение УСТАНОВЛЕНО → браузер открывает приложение, страница
 * уходит в фон. Мы ловим событие visibilitychange (document.hidden = true).
 * В этом случае сайт больше ничего не делает (не отправляет запрос на сервер).
 * Пользователю можно показать сообщение: "Вы уже установили приложение и не
 * подходите под реферальную программу".
 *
 * 3б. Приложение НЕ УСТАНОВЛЕНО → через 2.5 секунды таймаут истекает,
 * страница всё ещё видима. Тогда:
 * a) Отправляем PUT /api/referral/pending { deviceId, refCode, platform }
 * b) Редиректим в App Store / Google Play
 *
 * 4. Пользователь устанавливает приложение и запускает его первый раз.
 * ПРИЛОЖЕНИЕ само вызывает: POST /api/referral/activate { deviceId, refCode }
 */

// КОНФИГУРАЦИЯ 
export const CONFIG = {
// Схема вашего deep link 
deepLinkScheme: 'myapp',
// Ссылки на магазины приложений
storeUrls: {
ios: 'https://pornhub.com', // куда отправить с iOS
android: 'https://pornhub.com',
desktop: 'https://pornhub.com', // куда отправить с десктопа
  },
// Базовый URL  API 
apiBase: '/api',
// Сколько миллисекунд ждать открытия приложения
timeoutMs: 2500
}
// ══════════════════════════════════════════════════════════════════════════════
export function useReferral() {
/**
   * Главная функция — запускает весь флоу.
   *
   * @param {string} refCode - реферальный код из URL (?ref=...)
   * @param {string} deviceId - уникальный ID устройства
   * @param {string} platform - 'ios' | 'android' | 'desktop'
   * @param {Function} onStatus - колбэк для обновления UI: (status) => void
   * Возможные статусы: 'detecting' | 'already_installed' | 'sending' | 'redirecting' | 'done' | 'error'
   */
async function run(refCode, deviceId, platform, onStatus) {
try {
// Шаг 1: пробуем открыть приложение
onStatus('detecting')
const appIsOpen = await tryOpenApp(refCode, deviceId)

if (appIsOpen) {
  // Приложение УСТАНОВЛЕНО — сайт ничего не делает на бэкенде
  onStatus('already_installed')
  // Показать пользователю: "Вы не подходите под реферальную программу, так как приложение уже установлено"
  return
      }

// Шаг 2: приложение НЕ установлено — сообщаем серверу о pending-реферале
onStatus('sending')
await notifyServer(refCode, deviceId, platform)

// Шаг 3: отправляем в магазин
onStatus('redirecting')
await sleep(400) // небольшая пауза чтобы пользователь увидел статус
goToStore(platform)
    } catch (err) {
console.error('[Referral]', err)
onStatus('error')
    }
  }

/**
   * Пытается открыть приложение через deep link.
   * Возвращает true если приложение открылось (установлено), false если нет.
   */
function tryOpenApp(refCode, deviceId) {
return new Promise((resolve) => {
const deepLink =
`${CONFIG.deepLinkScheme}://referral` +
`?ref=${encodeURIComponent(refCode)}` +
`&device=${encodeURIComponent(deviceId)}`

let settled = false

function done(value) {
if (settled) return
settled = true
cleanup()
resolve(value)
      }

function onHidden() {
if (document.hidden) done(true)
      }

function onPageHide() {
done(true)
      }

function cleanup() {
document.removeEventListener('visibilitychange', onHidden)
window.removeEventListener('pagehide', onPageHide)
      }

document.addEventListener('visibilitychange', onHidden)
window.addEventListener('pagehide', onPageHide)

// Таймаут — если страница не скрылась, приложение не установлено
setTimeout(() => done(false), CONFIG.timeoutMs)

// Пробуем открыть deep link
window.location.href = deepLink
    })
  }

/**
   * Отправляет PUT /api/referral/pending на сервер.
   * Вызывается ТОЛЬКО если приложение НЕ установлено.
   *
   * Сервер должен сохранить запись:
   * "Устройство {deviceId} перешло по реферальному коду {refCode} и
   * ещё не установило приложение. Ждём первого запуска."
   */
async function notifyServer(refCode, deviceId, platform) {
try {
const res = await fetch(`${CONFIG.apiBase}/referral/pending`, {
method: 'PUT',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify({
deviceId,
refCode,
platform,
timestamp: new Date().toISOString()
        })
      })

if (!res.ok) {
console.warn('[Referral] Server returned', res.status)
      }
    } catch (err) {
// Сетевая ошибка — логируем, но продолжаем редирект в магазин
console.warn('[Referral] PUT failed, continuing to store redirect:', err)
    }
  }

/**
   * Отправляет пользователя в нужный магазин приложений.
   */
function goToStore(platform) {
window.location.href = CONFIG.storeUrls[platform] ?? CONFIG.storeUrls.desktop
  }

return { run }
}

// ─── Вспомогательная функция ──────────────────────────────────────────────
function sleep(ms) {
return new Promise(resolve => setTimeout(resolve, ms))
}