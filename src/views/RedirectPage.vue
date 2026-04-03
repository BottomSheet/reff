<template>
  <div class="page">

    <!-- Текущий статус операции -->
    <p class="status">{{ statusText }}</p>

    <!--
      Кнопки появляются автоматически в зависимости от статуса.
      На iOS и Android — кнопка в магазин.
      При ошибке — кнопка "попробовать снова".
    -->
    <a v-if="showStoreButton" :href="storeUrl" class="btn">
      Перейти в магазин
    </a>

    <button v-if="status === 'error'" class="btn" @click="start">
      Попробовать снова
    </button>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useDevice } from '@/composables/useDevice.js'
import { useReferral, CONFIG } from '@/composables/useReferral.js'

// Инициализация 
const route   = useRoute()
const device  = useDevice()         // { deviceId, platform }
const { run } = useReferral()

// Состояние 
// Возможные значения: 'idle' | 'detecting' | 'sending' | 'redirecting' | 'done' | 'error'
const status = ref('idle')

// Вычисляемые свойства
const statusText = computed(() => {
  switch (status.value) {
    case 'detecting':   return 'Открываем приложение...'
    case 'sending':     return 'Сохраняем реферальный код...'
    case 'redirecting': return 'Переходим в магазин...'
    case 'done':        return 'Готово!'
    case 'error':       return 'Что-то пошло не так'
    default:            return 'Подождите...'
  }
})

// Показываем кнопку в магазин если:
//  идёт редирект (на случай если автоматический редирект заблокирован браузером)
//  или ошибка
const showStoreButton = computed(() =>
  status.value === 'redirecting' || status.value === 'error'
)

// URL магазина для текущей платформы
const storeUrl = computed(() => CONFIG.storeUrls[device.platform])

// Логика 
async function start() {
  // Получаем реферальный код из query параметра ?ref=XXX
  const refCode = route.query.ref ?? ''

  if (!refCode) {
    // Нет реферального кода — просто редиректим в магазин без записи на сервер
    window.location.href = storeUrl.value
    return
  }

  // Запускаем флоу: detect → (send) → redirect
  await run(refCode, device.deviceId, device.platform, (s) => {
    status.value = s
  })
}

// Запускаем автоматически при загрузке страницы
onMounted(start)
</script>

<style>

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: #ffffff;
  color: #000000;
  font-family: system-ui, sans-serif;
}

@media (prefers-color-scheme: dark) {
  body {
    background: #000000;
    color: #ffffff;
  }
}

.page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 24px;
}

.status {
  font-size: 18px;
  text-align: center;
}

.btn {
  display: inline-block;
  padding: 12px 24px;
  border: 1px solid currentColor;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font-size: 16px;
  font-family: inherit;
  cursor: pointer;
  text-decoration: none;
}
</style>
