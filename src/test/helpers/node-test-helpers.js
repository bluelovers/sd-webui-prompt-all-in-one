
import { describe, it } from 'node:test'
import crypto from 'node:crypto'

/**
 * 截斷字串並以 "…" 結尾（共用工具）。
 * @param {string} str
 * @param {number} [maxLen=60]
 * @returns {string}
 */
export function truncate(str, maxLen = 60) {
    if (str.length <= maxLen) return str
    return str.slice(0, maxLen) + '…'
}

/**
 * 將輸入值字串化為可讀的展示字串：JSON.stringify（精確轉義引號/控制字元）+ 超長截斷。
 * 例：
 *   a. b. c                          → "a. b. c"
 *   with "Small joys." below.        → "with \"Small joys.\" below."（引號正確轉義）
 *   a<newline>b                      → "a\nb"
 *
 * @param {*}      input
 * @param {number} [maxLen=60] 截斷上限（先截斷再 stringify，避免截斷落在轉義序列中）
 * @returns {string}
 */
export function formatTitle(input, maxLen = 60) {
    const notString = typeof input !== 'string'
    const raw = notString ? String(input) : input

    let result = truncate(raw, maxLen)

    if (notString && result.length === raw.length) {
        result = input
    }

    return JSON.stringify(result)
}

/**
 * 產生測試標題 — splitTags 與 splitByPeriod 共用（單一事實來源）。
 *
 * 規則：
 *   - 字串輸入 + 有 note ：「note — [sha256前8碼] "引號包裹值"」（note、hash、值完整呈現）
 *   - 字串輸入 + 無 note ：「[sha256前8碼] "引號包裹值"」
 *   - 非字串輸入        ：note，無 note 時以 formatTitle 呈現值
 *   - 有 args 時附加「 ({...})」後綴（同輸入不同參數時避免標題碰撞）
 *
 * @param {Object} tc
 * @returns {string}
 */
export function caseTitle(tc) {
    let title
    if (typeof tc.input === 'string') {
        const identified = `[${promptHash(tc.input)}] ${formatTitle(tc.input)}`
        title = tc.note ? `${tc.note} — ${identified}` : identified
    } else {
        title = tc.note || formatTitle(tc.input)
    }
    if (tc.args !== undefined && tc.args.length > 0) {
        const args = tc.args.map(a => typeof a === 'object' && a !== null
            ? `{${Object.entries(a).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')}}`
            : JSON.stringify(a)
        ).join(', ')
        title += ` (${args})`
    }
    return title
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
 * @param {Object}   [options]           - 額外選項。
 *   @param {boolean} [options.snapshot] - true 時額外寫入快照
 *                                         { input, args?, result }（與 splitTags 同格式）。
 *
 * @example
 *   // 直接傳入已載入的函式
 *   runCases('basic', myFn, [
 *     { input: 'a. b. c', expected: ['a.', 'b.', 'c'] },
 *   ])
 *
 *   // 啟用快照
 *   runCases('basic', myFn, [ ... ], { snapshot: true })
 *
 *   // 傳入 factory function（lazy import）
 *   runCases('basic', () => import('./myModule.js').then(m => m.default), [
 *     { input: 'a. b. c', expected: ['a.', 'b.', 'c'] },
 *   ])
 */
export function runCases(suiteName, fn, cases, options = {}) {
    /** snapshot: true 時額外寫入快照 { input, args?, result }（與 splitTags 同格式） */
    const { snapshot = false } = options
    describe(suiteName, async () => {
        for (const tc of cases) {
            const title = caseTitle(tc)
            const handler = async (t) => {
                const result = await fn(tc.input, ...(tc.args || []))
                if (snapshot) {
                    const snap = { input: tc.input }
                    if (tc.args !== undefined) snap.args = tc.args
                    snap.result = result
                    t.assert.snapshot(snap)
                }
                if (tc.assert) {
                    tc.assert(result)
                } else {
                    t.assert.deepEqual(result, tc.expected)
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
 * 執行一組 splitTags 測試案例（可選接上 splitByPeriod 管線）。
 *
 * 單一事實來源：splitTags 單獨測試、splitTags → splitByPeriod 管線測試、
 * 管線專屬測試與 issues 回歸測試共用此函式，
 * 差別僅在 splitByPeriod 是否為 null，以及案例上帶的斷言欄位。
 *
 * 流程：
 *   Step 1    splitTags 切割
 *   Step 1.5  可選 — 案例級 assertResult（splitTags 中間結果斷言）
 *   Step 2    可選 — splitByPeriod 管線
 *   Step 2.5  可選 — 案例級 assertPipeline（管線最終結果斷言，驗證兩階段合計的不變式）
 *   Step 3    與原版比較
 *   Step 4    組裝快照
 *
 * @param {Object}   opts
 * @param {Object[]} opts.cases          - 測試案例陣列
 * @param {Function} opts.splitTags      - 新版 splitTags 函式
 * @param {Function|null} opts.originalFn - 原版 splitTags_original（可為 null）
 * @param {Function|null} opts.splitByPeriod - 若提供，對每個 tag 結果再做 splitByPeriod
 */
export function runSplitTagsTests({ cases, splitTags, originalFn, splitByPeriod }) {
    for (const tc of cases) {
        const title = caseTitle(tc)
        it(title, (t) => {
            /** Step 1: splitTags 切割 */
            const tagResult = splitTags(tc.input, ...(tc.args || []))

            /** Step 1.5: 可選 — 自訂斷言（issues 回歸案例的雙保險，獨立於快照之外） */
            if (tc.assertResult) tc.assertResult(tagResult, t)

            /** Step 2: 可選 — splitByPeriod 管線 */
            let finalResult = tagResult
            let changed = false
            if (splitByPeriod) {
                finalResult = tagResult.flatMap(tag => splitByPeriod(tag, tc.splitByPeriodOptions))
                changed = JSON.stringify(tagResult) !== JSON.stringify(finalResult)

                if (tc.expectChanged !== undefined) {
                    t.assert.equal(changed, tc.expectChanged)
                }

                if (changed) {
                    console.log(`  ⚠ splitByPeriodChanged: true  (${tagResult.length} → ${finalResult.length} segments)`)
                } else {
                    console.log(`  ✓ splitByPeriodChanged: false`)
                }
            }

            /** Step 2.5: 可選 — 管線最終結果的自訂斷言（不變式，獨立於快照之外） */
            if (tc.assertPipeline) tc.assertPipeline(finalResult, t, tc)

            /** Step 3: 與原版比較 */
            const { changedFromOriginal, originalResult } = compareWithOriginal(originalFn, tc, tagResult)

            if (tc.expectOriginalChanged !== undefined) {
                t.assert.equal(changedFromOriginal, tc.expectOriginalChanged)
            }

            /** Step 4: 組裝快照 */
            const snap = splitByPeriod
                ? { input: tc.input, splitTagsResult: tagResult }
                : { input: tc.input, result: tagResult }

            if (splitByPeriod) {
                if (changed) {
                    snap.splitByPeriodChanged = true
                    snap.splitByPeriodResult = finalResult
                } else {
                    snap.splitByPeriodChanged = false
                }
            }

            attachOriginalComparison(snap, changedFromOriginal, originalResult)
            t.assert.snapshot(snap)
        })
    }
}

/**
 * 將新舊版函式結果進行比較。
 *
 * @param {Function|null} originalFn - 原版函式（null 時跳過比較）
 * @param {Object}        tc         - 測試案例（含 input、args）
 * @param {*}             result     - 新版函式結果
 * @returns {{ changedFromOriginal: boolean|null, originalResult: *|null }}
 */
export function compareWithOriginal(originalFn, tc, result) {
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
export function attachOriginalComparison(snap, changedFromOriginal, originalResult) {
    if (changedFromOriginal === null) return
    snap.changedFromOriginal = changedFromOriginal
    if (changedFromOriginal) snap.originalResult = originalResult
}

/**
 * 產生輸入字串的短期雜湊（前 8 碼 hex），用於長輸入的快照標題。
 * @param {string} str
 * @returns {string} 8 字元 hex
 */
export function promptHash(str) {
    return crypto.createHash('sha256').update(str).digest('hex').slice(0, 8)
}
