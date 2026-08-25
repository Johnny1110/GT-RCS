// @vitest-environment happy-dom
/**
 * 第三方整合層（PRD Phase 6 / F6-3.2、F6-4.1、F6-4.2）。
 *
 * 這些行為在 production 之前完全看不到（本機與預覽都不載第三方 script），
 * 所以只能在這裡驗：白名單真的擋得住、同意預設值真的排在前面、重複載入真的只有一次。
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { loadScript, resetLoadedScripts } from './loader'
import { installConsentDefaults, resetConsentDefaults, canRevokeConsent, showConsentRevocation } from './consentMode'
import { cmpPublisherId, cmpScriptUrl } from './cmp'
import { CONSENT_REQUIRED_REGIONS } from '@/config/consentRegions'
import { isAllowedScriptUrl } from '@/config/thirdParty'

const ALLOWED = 'https://www.googletagmanager.com/gtag/js?id=G-TEST'

beforeEach(() => {
  resetLoadedScripts()
  resetConsentDefaults()
  document.head.innerHTML = ''
  delete window.dataLayer
  delete window.gtag
  delete window.googlefc
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('loadScript', () => {
  it('白名單內的網址會插入一個 async script', () => {
    void loadScript(ALLOWED)
    const el = document.head.querySelector('script')
    expect(el?.getAttribute('src')).toBe(ALLOWED)
    // 廣告與分析絕不能擋住 App 可互動（F6-3.2）
    expect(el?.async).toBe(true)
  })

  it('同一個 URL 只插入一次（路由來回切換不該重複注入）', () => {
    void loadScript(ALLOWED)
    void loadScript(ALLOWED)
    expect(document.head.querySelectorAll('script')).toHaveLength(1)
  })

  it('白名單外的網址直接拒絕，而且不碰 DOM', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(loadScript('https://evil.example.com/x.js')).rejects.toThrow(/allowlist/)
    expect(document.head.querySelectorAll('script')).toHaveLength(0)
    // production 的 CSP 也會擋——與其上線才發現，不如在 dev 就出聲
    expect(error).toHaveBeenCalled()
  })

  it('額外屬性會寫上去（AdSense 要 data-ad-client）', () => {
    void loadScript(ALLOWED, { attrs: { 'data-ad-client': 'ca-pub-1' }, crossOrigin: 'anonymous' })
    const el = document.head.querySelector('script')
    expect(el?.getAttribute('data-ad-client')).toBe('ca-pub-1')
    expect(el?.getAttribute('crossorigin')).toBe('anonymous')
  })
})

describe('Consent Mode v2 預設值', () => {
  function defaults(): Record<string, unknown>[] {
    return (window.dataLayer ?? [])
      .map((entry) => Array.from(entry as ArrayLike<unknown>))
      .filter((args) => args[0] === 'consent' && args[1] === 'default')
      .map((args) => args[2] as Record<string, unknown>)
  }

  it('先排地區預設值，再排全域預設值（Google 文件的順序）', () => {
    installConsentDefaults()
    const calls = defaults()
    expect(calls).toHaveLength(2)
    expect(calls[0]?.['region']).toEqual(CONSENT_REQUIRED_REGIONS)
    expect(calls[1]?.['region']).toBeUndefined()
  })

  it('需同意地區四項全部 denied，並等 CMP 回覆', () => {
    installConsentDefaults()
    const regional = defaults()[0]
    for (const key of ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']) {
      expect(regional?.[key]).toBe('denied')
    }
    expect(regional?.['wait_for_update']).toBeGreaterThan(0)
  })

  /** 其他地區不會跳同意視窗；那裡也設 denied 等於永久關閉分析 */
  it('其他地區預設 granted', () => {
    installConsentDefaults()
    expect(defaults()[1]?.['ad_storage']).toBe('granted')
  })

  it('推進 dataLayer 的是 arguments 而不是陣列（gtag.js 認的是那個形狀）', () => {
    installConsentDefaults()
    const first = window.dataLayer?.[0]
    expect(Array.isArray(first)).toBe(false)
    expect((first as ArrayLike<unknown>).length).toBe(3)
  })

  it('重複呼叫不會重複排入（App 熱重載或多次 init 都安全）', () => {
    installConsentDefaults()
    installConsentDefaults()
    expect(defaults()).toHaveLength(2)
  })

  it('已存在的 gtag 不會被覆蓋（GTM 先到就用它的）', () => {
    const existing = vi.fn()
    window.dataLayer = []
    window.gtag = existing
    installConsentDefaults()
    expect(window.gtag).toBe(existing)
    expect(existing).toHaveBeenCalledTimes(2)
  })
})

describe('CMP', () => {
  it('發布商 ID 去掉 ca- 前綴', () => {
    expect(cmpPublisherId('ca-pub-1234567890123456')).toBe('pub-1234567890123456')
  })

  it('CMP 網址在 script 白名單內（不然 CSP 會擋掉自己的同意視窗）', () => {
    expect(isAllowedScriptUrl(cmpScriptUrl('ca-pub-1234567890123456'))).toBe(true)
    expect(cmpScriptUrl('ca-pub-1')).toContain('ers=1')
  })

  it('沒有 CMP 時不顯示撤回入口，呼叫也不會炸', () => {
    expect(canRevokeConsent()).toBe(false)
    expect(() => showConsentRevocation()).not.toThrow()
  })

  it('CMP 提供撤回入口時才回報 true', () => {
    const show = vi.fn()
    window.googlefc = { showRevocationMessage: show }
    expect(canRevokeConsent()).toBe(true)
    showConsentRevocation()
    expect(show).toHaveBeenCalled()
  })
})
