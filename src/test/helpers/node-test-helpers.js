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

/**
 * 從輸入值自動產生可讀的測試標題。
 *
 * 規則：
 *   - 字串：截斷至 maxLen 字元並加上引號
 *   - 其他型別：直接 toString() 加引號
 *
 * @param {*}      input
 * @param {number} [maxLen=40]
 * @returns {string}
 */
function formatTitle(input, maxLen = 40) {
    const raw = typeof input === 'string' ? input : String(input)
    const truncated = raw.length > maxLen ? raw.slice(0, maxLen) + '…' : raw
    // 替換控制字元讓標題安全可讀
    const safe = truncated
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
    const args  = tc.args ? tc.args.map(a => JSON.stringify(a)).join(', ') : ''
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
        for (const [index, tc] of cases.entries()) {
            const title = `${index + 1}. ${caseTitle(tc)}`
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

module.exports = { runCases, formatTitle, caseTitle }
