/**
 * 路由由模組註冊表生成（Registry pattern）——新增模組不改此檔。
 */
import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { listModules } from '@/modules/registry'
import '@/modules' // 觸發所有模組註冊（side-effect import，唯一允許處）

const moduleRoutes: RouteRecordRaw[] = listModules().map((m) => ({
  path: m.route,
  name: m.id,
  component: m.loadComponent,
  meta: { moduleId: m.id, category: m.category },
}))

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    // 統計不是練習模組（沒有 click、不寫日誌），所以不進註冊表，走獨立路由
    { path: '/stats', name: 'stats', component: () => import('@/views/StatsView.vue') },
    ...moduleRoutes,
  ],
})
