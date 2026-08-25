/**
 * 路由：練習模組由註冊表生成（Registry pattern），內容頁在此明列。
 *
 * 語系前綴（PRD Phase 6 / F6-5.2）：每一條路由都有 `/en/...` 的孿生路由。
 * 為什麼全部都要而不是只有內容頁：hreflang 是成對宣告的，sitemap 也逐語系列出網址；
 * 只有一半的路由有 en 版本，sitemap 就會指向 404。
 *
 * 語系來源：**網址優先**。帶前綴 = 這次瀏覽用英文（App.vue 會同步設定），
 * 不帶前綴 = 用使用者自己的語言設定，canonical 則一律宣告為預設語系。
 */
import { createRouter, createWebHistory, type Router, type RouterHistory, type RouteRecordRaw } from 'vue-router'
import { LEGAL_DOCS } from '@/config/routes'
import { LOCALE_PREFIX, type SiteLocale } from '@/config/site'
import { listModules } from '@/modules/registry'
import '@/modules' // 觸發所有模組註冊（side-effect import，唯一允許處）

const moduleRoutes: RouteRecordRaw[] = listModules().map((m) => ({
  path: m.route,
  name: m.id,
  component: m.loadComponent,
  meta: { moduleId: m.id, category: m.category, titleKey: m.titleKey, descriptionKey: m.descriptionKey },
}))

const baseRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { titleKey: 'app.title', descriptionKey: 'app.tagline' },
  },
  // 統計不是練習模組（沒有 click、不寫日誌），所以不進註冊表，走獨立路由
  {
    path: '/stats',
    name: 'stats',
    component: () => import('@/views/StatsView.vue'),
    meta: { titleKey: 'stats.title', descriptionKey: 'stats.description' },
  },
  {
    path: '/knowledge',
    name: 'knowledge',
    component: () => import('@/views/KnowledgeIndexView.vue'),
    meta: { titleKey: 'knowledgeIndex.title', descriptionKey: 'knowledgeIndex.description' },
  },
  {
    path: '/knowledge/:slug',
    name: 'knowledge-entry',
    component: () => import('@/views/KnowledgeEntryView.vue'),
    meta: { titleKey: 'knowledgeIndex.title', descriptionKey: 'knowledgeIndex.description' },
  },
  ...LEGAL_DOCS.map((doc) => ({
    path: `/${doc}`,
    name: doc,
    component: () => import('@/views/LegalView.vue'),
    props: { doc },
    meta: { titleKey: `legal.${doc}.title`, descriptionKey: `legal.${doc}.description`, legalDoc: doc },
  })),
  ...moduleRoutes,
]

function withLocalePrefix(routes: readonly RouteRecordRaw[], locale: SiteLocale): RouteRecordRaw[] {
  const prefix = LOCALE_PREFIX[locale]
  return routes.map((route) => ({
    ...route,
    path: route.path === '/' ? prefix : `${prefix}${route.path}`,
    name: `${locale}:${String(route.name)}`,
    meta: { ...route.meta, locale },
  }))
}

/**
 * 路由表工廠：正式站用 web history，測試用 memory history。
 * 抽成工廠是為了讓 app.spec.ts 測**真的那份路由表**——
 * 測試自己抄一份的話，漏掉新路由時測試依然全綠。
 */
export function createAppRouter(history: RouterHistory): Router {
  return createRouter({
    history,
    routes: [
      ...baseRoutes,
      ...withLocalePrefix(baseRoutes, 'en'),
      // 靜態主機把所有未知路徑 rewrite 到 index.html，沒有 catch-all 就是一片空白
      {
        path: '/:pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/views/NotFoundView.vue'),
        meta: { titleKey: 'notFound.title', descriptionKey: 'notFound.body', noindex: true },
      },
    ],
    scrollBehavior(to, _from, savedPosition) {
      if (savedPosition) return savedPosition
      if (to.hash) return { el: to.hash }
      return { top: 0 }
    },
  })
}

export const router = createAppRouter(createWebHistory(import.meta.env.BASE_URL))
