# referral-landing

Лендинг для реферальной системы. Минимальный проект без лишнего кода.

---

## Быстрый старт

```bash
npm install
npm run dev
```

Откройте: `http://localhost:3000/?ref=TEST123`

---

## Структура проекта

```
src/
├── main.js                     # точка входа, роутер
├── App.vue                     # корневой компонент (просто <RouterView>)
├── composables/
│   ├── useDevice.js            # deviceId + определение платформы
│   └── useReferral.js          # вся бизнес-логика + CONFIG
└── views/
    └── RedirectPage.vue        # единственная страница (шаблон + логика)
```

---

## Как это работает — пошагово

### Шаг 1. Пользователь переходит по ссылке

```
https://ref.myapp.com/?ref=ABC123
```

`ref=ABC123` — это реферальный код. Страница автоматически начинает флоу.

---

### Шаг 2. Определение устройства

`useDevice.js` делает две вещи:

**deviceId** — генерируется один раз и сохраняется в `localStorage`.
При следующем визите возвращается тот же ID. Это позволяет связать
"клик по реферальной ссылке" и "первый запуск приложения".

**platform** — определяется по `navigator.userAgent`:
- `ios` → iPhone, iPad, iPod
- `android` → Android
- `desktop` → всё остальное

---

### Шаг 3. Попытка открыть приложение (deep link)

Страница делает `window.location.href = 'myapp://referral?ref=ABC123&device=UUID'`

Затем ждёт 2.5 секунды и смотрит:

**Приложение открылось** → `document.visibilitychange` сработает с `document.hidden = true`.
Это значит браузер ушёл в фон — ОС открыла приложение. Флоу завершён,
больше ничего делать не нужно. Приложение само получит `ref` из deep link.

**Приложение не открылось** → таймер истёк, страница всё ещё видима.
Переходим к шагу 4.

---

### Шаг 4. Отправка запроса на сервер

```
PUT /api/referral/pending
Content-Type: application/json

{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "refCode": "ABC123",
  "platform": "android",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Почему PUT?** Идемпотентный метод — если пользователь кликнул по ссылке
дважды, на сервере не создастся дубль.

**Что делает сервер?** Сохраняет запись: "устройство UUID хочет установить
приложение по реферальному коду ABC123. Ждём первого запуска."

**Что если сервер недоступен?** Ошибка логируется в консоль, но редирект
в магазин всё равно происходит — пользователь не застрянет.

---

### Шаг 5. Редирект в магазин

```
iOS      → https://apps.apple.com/app/idXXX
Android  → https://play.google.com/store/apps/details?id=com.xxx
Desktop  → https://your-website.com
```

---

### Шаг 6. Первый запуск приложения (на стороне приложения)

После установки при первом запуске **ваше приложение** должно вызвать:

```
POST /api/referral/activate
Content-Type: application/json

{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "refCode": "ABC123"
}
```

Откуда приложение берёт эти данные?

- **deviceId** — из хранилища устройства (SharedPreferences / UserDefaults).
  Генерируется при первом запуске приложения. Должен совпасть с тем,
  что был отправлен с лендинга — это возможно если вы используете один
  и тот же алгоритм генерации, или если deviceId передаётся через deep link.

- **refCode** — из deep link (если приложение было установлено и открылось
  напрямую) или из сохранённого на сервере pending-состояния
  (если приложение установили через магазин).

---

## Где менять настройки

Всё в одном месте — `src/composables/useReferral.js`, константа `CONFIG`:

```js
export const CONFIG = {
  deepLinkScheme: 'myapp',        // схема вашего приложения
  storeUrls: {
    ios:     'https://apps.apple.com/app/idXXXXX',
    android: 'https://play.google.com/store/apps/details?id=com.your.app',
    desktop: 'https://your-website.com'
  },
  apiBase: '/api',                // базовый URL API
  timeoutMs: 2500                 // таймаут определения приложения (мс)
}
```

---

## Настройка deep link в мобильном приложении

### Android (AndroidManifest.xml)

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="myapp" android:host="referral" />
</intent-filter>
```

### iOS (Info.plist)

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>myapp</string>
    </array>
  </dict>
</array>
```

### Получение deep link в React Native

```js
import { Linking } from 'react-native'

useEffect(() => {
  const sub = Linking.addEventListener('url', ({ url }) => {
    // url = 'myapp://referral?ref=ABC123&device=UUID'
    const params = new URL(url).searchParams
    const refCode  = params.get('ref')
    const deviceId = params.get('device')
    // Сохраните refCode и deviceId — они понадобятся для activate запроса
  })
  return () => sub.remove()
}, [])
```

---

## Деплой (Nginx)

```nginx
server {
    listen 80;
    server_name ref.myapp.com;
    root /var/www/referral-landing/dist;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Проксируем API на бэкенд
    location /api/ {
        proxy_pass http://your-backend:8080;
    }
}
```

Сборка для продакшена:
```bash
npm run build
# Загружаете папку dist/ на сервер
```
