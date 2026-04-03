import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import RedirectPage from './views/RedirectPage.vue'

// Один маршрут — главная страница принимает любой путь.
// Реферальный код берётся из query-параметра ?ref=XXX
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/:pathMatch(.*)*', component: RedirectPage }
  ]
})

createApp(App).use(router).mount('#app')
