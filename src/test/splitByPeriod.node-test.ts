/**
 * splitByPeriod.node-test.js
 *
 * 以 Node.js 原生測試運行器（node:test + node:assert）撰寫的測試腳本。
 * 測試邏輯由 helpers/node-test-helpers.js 的 runCases() 統一執行，
 * 本檔案僅負責定義「測試案例資料」與模組載入。
 *
 * 執行方式：
 *   cd src && tsx --test test/splitByPeriod.node-test.js
 *
 * 檔名採用 .node-test.js 後綴，與未來可能引入的第三方測試框架（Jest / Vitest）
 * 透過 glob pattern 做區隔，避免衝突。
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { runCases } from './helpers/node-test-helpers'
import {
    basicCases,
    bracketProtectionCases,
    includeParenFalseCases,
    mismatchedBracketCases,
    newlineCases,
    nonStringGuardCases,
    noPeriodCases,
    quoteProtectionCases,
    realWorldCases,
    semicolonCases,
    whitespaceCases,
} from './fixture/data-splitByPeriod';

/* ====================================================================
 *  模組載入 factory
 *
 *  傳給 runCases 時，runCases 會在 describe callback 內 await 此函式，
 *  取得真正的被測函式後再逐一執行案例。避免在模組頂層 top-level await。
 * ==================================================================== */

async function loadSplitByPeriod() {
    const mod = await import('../src/utils/splitByPeriod')
    return mod.splitByPeriod
}

/* ====================================================================
 *  執行測試
 * ==================================================================== */

describe('splitByPeriod', async () => {
    it('module loads successfully', async () => {
        const fn = await loadSplitByPeriod()
        assert.equal(typeof fn, 'function')
    })

    runCases('basic splitting without brackets',           loadSplitByPeriod, basicCases, { snapshot: true })
    runCases('no period at all',                            loadSplitByPeriod, noPeriodCases, { snapshot: true })
    runCases('nested bracket protection (includeParen=true)', loadSplitByPeriod, bracketProtectionCases, { snapshot: true })
    runCases('includeParen=false — stop splitting before open paren', loadSplitByPeriod, includeParenFalseCases, { snapshot: true })
    runCases('mismatched / noisy brackets',                 loadSplitByPeriod, mismatchedBracketCases, { snapshot: true })
    runCases('non-string input guard',                      loadSplitByPeriod, nonStringGuardCases, { snapshot: true })
    runCases('whitespace handling',                         loadSplitByPeriod, whitespaceCases, { snapshot: true })
    runCases('newline handling (priority over quotes/parens)', loadSplitByPeriod, newlineCases, { snapshot: true })
    runCases('semicolon splitting (splitSemicolon option, default off)', loadSplitByPeriod, semicolonCases, { snapshot: true })
    runCases('real-world prompt scenarios',                 loadSplitByPeriod, realWorldCases, { snapshot: true })
    runCases('quote protection (double & single)',          loadSplitByPeriod, quoteProtectionCases, { snapshot: true })
})
