/**
 * splitTags.node-test.js
 *
 * 以 Node.js 原生測試運行器（node:test + node:assert）撰寫的測試腳本。
 * 使用 t.assert.snapshot() 進行快照比對，測試結果自動寫入 .snapshot 檔案，
 * 不需手動複製或維護預期值。
 *
 * 執行方式：
 *   cd src && tsx --test test/splitTags.node-test.js
 *
 * 首次建立 / 內容變動後更新快照：
 *   cd src && tsx --test --test-update-snapshots test/splitTags.node-test.js
 *
 * 快照檔案位置：test/splitTags.node-test.js.snapshot（與測試檔同目錄）
 *
 * 檔名採用 .node-test.js 後綴，與未來可能引入的第三方測試框架（Jest / Vitest）
 * 透過 glob pattern 做區隔，避免衝突。
 */

import { describe, it } from 'node:test'
import { attachOriginalComparison, caseTitle, compareWithOriginal } from './helpers/node-test-helpers'
import { cases, issuesCases, pipelineCases } from './fixture/data-splitTags';

/* ====================================================================
 *  工具函式
 * ==================================================================== */

/**
 * 解析 ESM/CJS interop 的 default 匯出。
 *
 * package.json 無 "type": "module"，tsx 將 .ts 以 CJS 轉譯（exports.default），
 * 動態 import() 再包一層 default，形成雙層 default；此函式取回真正的函式。
 * 原生 ESM 載入（.js 檔）時 default 即函式，行為不變。
 *
 * @param {object} mod - 動態 import() 回傳的模組命名空間
 * @returns {Function}
 */
function resolveDefaultExport(mod) {
    const d = mod?.default
    return typeof d === 'function' ? d : d?.default
}

/** 動態載入 ESM 模組。 */
async function loadModule() {
    const mod = await import('../src/utils/splitTags')
    return resolveDefaultExport(mod)
}

/**
 * 動態載入 splitTags_original ESM 模組（若存在）。
 * 用於與新版 splitTags 比較差異。
 */
async function loadOriginal() {
    try {
        const mod = await import('../src/utils/splitTags_original')
        return resolveDefaultExport(mod)
    } catch {
        return null
    }
}

/** 動態載入 splitByPeriod ESM 模組。 */
async function loadSplitByPeriod() {
    const mod = await import('../src/utils/splitByPeriod')
    return typeof mod.default === 'function' ? mod.default : mod.default?.default
}







/* ====================================================================
 *  單一事實來源：splitTags 測試執行器
 *
 *  splitTags 與 splitTags → splitByPeriod pipeline 共用此函式。
 *  差別僅在於 splitByPeriod 是否為 null。
 * ==================================================================== */

/**
 * 執行一組 splitTags 測試案例。
 *
 * @param {Object}   opts
 * @param {Object[]} opts.cases        - 測試案例陣列
 * @param {Function} opts.splitTags    - 新版 splitTags 函式
 * @param {Function|null} opts.originalFn  - 原版 splitTags_original（可為 null）
 * @param {Function|null} opts.splitByPeriod - 若提供，對每個 tag 結果再做 splitByPeriod
 */
function runSplitTagsTests({ cases, splitTags, originalFn, splitByPeriod }) {
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

/* ====================================================================
 *  執行測試
 * ==================================================================== */

describe('splitTags', async () => {
    const splitTags = await loadModule()
    const originalFn = await loadOriginal()

    it('module loads successfully', (t) => {
        t.assert.equal(typeof splitTags, 'function')
    })

    runSplitTagsTests({ cases, splitTags, originalFn, splitByPeriod: null })
})

describe('splitTags → splitByPeriod pipeline', async () => {
    const splitTags = await loadModule()
    const splitByPeriod = await loadSplitByPeriod()
    const originalFn = await loadOriginal()

    runSplitTagsTests({ cases: pipelineCases, splitTags, originalFn, splitByPeriod })
})

/**
 * issues 回歸案例：以獨立 describe 分類呈現，
 * 失敗時可立即從標題辨識為「已知 bug 復發」而非一般行為變更。
 */
describe('issues regression cases', async () => {
    const splitTags = await loadModule()

    runSplitTagsTests({ cases: issuesCases, splitTags, originalFn: null, splitByPeriod: null })
})
