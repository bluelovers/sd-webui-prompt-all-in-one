/**
 * node-test-helpers.js
 *
 * 可複用的 Node.js 原生測試輔助工具。
 * 提供 data-driven 的測試執行器，消除每個測試案例中重複的
 *   1. 模組載入（lazy import）
 *   2. 函式呼叫
 *   3. 結果斷言
 * 樣板代碼。
 *
 * 使用方式：
 *   const { runCases } = require('./helpers/node-test-helpers')
 *   const fn = await loadSomething()
 *   runCases('suite name', fn, [ ...testCases ])
 *
 * @module helpers/node-test-helpers
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')

/**
 * 從輸入值自動產生可讀的測試標題。
 *
 * 規則：
 *   - 短字串（≤ maxLen）：直接加引號
 *   - 長字串（> maxLen）：「{sha256前8碼} {截斷至60字}」
 *   - 其他型別：直接 toString() 加引號
 *
 * @param {*}      input
 * @param {number} [maxLen=100]
 * @returns {string}
 */
function formatTitle(input, maxLen = 100) {
    const raw = typeof input === 'string' ? input : String(input)
    if (raw.length > maxLen) {
        const hash = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 8)
        const truncated = raw.length > 60 ? raw.slice(0, 60) + '…' : raw
        return `${hash} ${truncated}`
    }
    // 替換控制字元讓標題安全可讀
    const safe = raw
        .replace(/\t/g, '\\t')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
    return `"${safe}"`
}

/**
 * 將一個測試案例轉換為比較用的摘要字串，用於自動產生 it() 標題。
 *
 * @param {Object} tc
 * @returns {string}
 */
function caseTitle(tc) {
    const input = formatTitle(tc.input)
    const args  = tc.args
        ? tc.args.map(a => typeof a === 'object' && a !== null
            ? `{${Object.entries(a).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')}}`
            : JSON.stringify(a)
        ).join(', ')
        : ''
    const label = tc.note ? ` — ${tc.note}` : ''
    if (args) {
        return `${input} (${args})${label}`
    }
    return `${input}${label}`
}

/**
 * 執行一組 data-driven 的測試案例。
 *
 * @param {string}   suiteName    - describe() 的標題。
 * @param {Function} fn           - 被測函式（同步或非同步皆可）。
 *                                  若 fn 回傳 Promise（例如 factory function），
 *                                  會先 await 取得真正的函式後再逐一執行案例。
 * @param {Object[]} cases        - 測試案例陣列。每個物件包含：
 *   @param {*}        tc.input    - 傳入 fn 的第一個參數。
 *   @param {*[]}      [tc.args]   - 額外參數（會 spread 到 fn(input, ...args)）。
 *   @param {*|string}  tc.expected - 期望的回傳值。
 *   @param {string}   [tc.note]   - 附加說明，顯示在測試標題中。
 *   @param {Function} [tc.assert] - 自訂斷言函式(fn(result) → void)，
 *                                    若提供則取代預設 deepEqual。
 *   @param {boolean}  [tc.skip]   - 若為 true 則跳過此案例。
 *
 * @example
 *   // 直接傳入已載入的函式
 *   runCases('basic', myFn, [
 *     { input: 'a. b. c', expected: ['a.', 'b.', 'c'] },
 *   ])
 *
 *   // 傳入 factory function（lazy import）
 *   runCases('basic', () => import('./myModule.js').then(m => m.default), [
 *     { input: 'a. b. c', expected: ['a.', 'b.', 'c'] },
 *   ])
 */
function runCases(suiteName, fn, cases) {
    describe(suiteName, async () => {
        const resolvedFn = typeof fn === 'function' ? await fn() : fn
        for (const tc of cases) {
            const title = caseTitle(tc)
            const handler = async () => {
                const result = await resolvedFn(tc.input, ...(tc.args || []))
                if (tc.assert) {
                    tc.assert(result)
                } else {
                    assert.deepEqual(result, tc.expected)
                }
            }
            if (tc.skip) {
                it.skip(title, handler)
            } else {
                it(title, handler)
            }
        }
    })
}

/**
 * 將新舊版函式結果進行比較。
 *
 * @param {Function|null} originalFn - 原版函式（null 時跳過比較）
 * @param {Object}        tc         - 測試案例（含 input、args）
 * @param {*}             result     - 新版函式結果
 * @returns {{ changedFromOriginal: boolean|null, originalResult: *|null }}
 */
function compareWithOriginal(originalFn, tc, result) {
    if (!originalFn) return { changedFromOriginal: null, originalResult: null }
    const originalResult = originalFn(tc.input, ...(tc.args || []))
    const changedFromOriginal = JSON.stringify(result) !== JSON.stringify(originalResult)
    return { changedFromOriginal, originalResult }
}

/**
 * 將原版比較結果附加到快照物件。
 * changedFromOriginal=true 時同時附加 originalResult。
 *
 * @param {Object}  snap                  - 快照物件（會被 mutate）
 * @param {boolean|null} changedFromOriginal
 * @param {*}       originalResult
 */
function attachOriginalComparison(snap, changedFromOriginal, originalResult) {
    if (changedFromOriginal === null) return
    snap.changedFromOriginal = changedFromOriginal
    if (changedFromOriginal) snap.originalResult = originalResult
}

/**
 * 產生輸入字串的短期雜湊（前 8 碼 hex），用於長輸入的快照標題。
 * @param {string} str
 * @returns {string} 8 字元 hex
 */
function promptHash(str) {
    return crypto.createHash('sha256').update(str).digest('hex').slice(0, 8)
}

/**
 * 截斷字串並以 "…" 結尾。
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
function truncate(str, maxLen = 60) {
    if (str.length <= maxLen) return str
    return str.slice(0, maxLen) + '…'
}

module.exports = { runCases, formatTitle, caseTitle, compareWithOriginal, attachOriginalComparison, promptHash, truncate }
