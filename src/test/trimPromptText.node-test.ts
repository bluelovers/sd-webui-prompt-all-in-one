/**
 * trimPromptText.node-test.js
 *
 * trimPromptText 的單元測試：以明確 expected 斷言表達意圖，不使用快照。
 * （快照僅適用於「記錄結果」；本檔每個案例都直接鎖定行為意圖。）
 *
 * 執行方式：
 *   cd src && tsx --test test/trimPromptText.node-test.js
 *
 * 檔名採用 .node-test.js 後綴，與未來可能引入的第三方測試框架（Jest / Vitest）
 * 透過 glob pattern 做區隔，避免衝突。
 */

import { describe } from 'node:test'
import { runCases } from './helpers/node-test-helpers'
import type { IRunCase } from './helpers/types/node-test-case-types'
import { trimPromptText } from '../src/utils/trimPromptText'

/* ====================================================================
 *  測試案例定義 — 每筆皆以 expected 直接断言意圖
 *
 *  意圖分組：
 *    1. 不可見字元逐字清除（\x00 NULL、\u200b 零寬空格）——頭/中/尾/全部
 *    2. 邊界水平空白修剪（空格、tab）——僅頭尾，內部保留
 *    3. 換行是結構（\n / \r）——不得修剪
 *    4. 執行順序：先清不可見字元再修剪（被零寬空格卡住的邊界空白也要清）
 * ==================================================================== */

const cleanupCases: IRunCase<string, [], string>[] = [
    /** ── 1. 不可見字元 ── */
    { input: '\u200babc, def', expected: 'abc, def',
        note: 'leading ZWSP removed' },
    { input: 'abc\u200b, def', expected: 'abc, def',
        note: 'internal ZWSP removed' },
    { input: 'abc, def\u200b', expected: 'abc, def',
        note: 'trailing ZWSP removed' },
    { input: 'a\u0000b, c', expected: 'ab, c',
        note: 'internal NULL removed' },
    { input: '\u0000abc', expected: 'abc',
        note: 'leading NULL removed' },
    { input: '\u200b\u0000', expected: '',
        note: 'invisible-chars-only input → empty string' },

    /** ── 2. 邊界水平空白（內部保留）── */
    { input: '  abc  ', expected: 'abc',
        note: 'edge spaces trimmed' },
    { input: '\tabc\t', expected: 'abc',
        note: 'edge tabs trimmed' },
    { input: 'a, b', expected: 'a, b',
        note: 'no edge whitespace — unchanged' },
    { input: 'a  b', expected: 'a  b',
        note: 'internal multiple spaces kept' },
    { input: ' abc , def ', expected: 'abc , def',
        note: 'edge spaces trimmed, internal comma-space kept verbatim' },

    /** ── 3. 換行是結構：不得修剪 ── */
    { input: '\nabc', expected: '\nabc',
        note: 'leading newline preserved (wrap marker semantics)' },
    { input: 'abc\n', expected: 'abc\n',
        note: 'trailing newline preserved' },
    { input: '\n\nabc\n\n', expected: '\n\nabc\n\n',
        note: 'multiple boundary newlines preserved' },
    { input: '\rabc\r', expected: '\rabc\r',
        note: 'CR preserved like newline (converted downstream)' },
    { input: ' \nabc\n ', expected: '\nabc\n',
        note: 'edge spaces trimmed while boundary newlines kept' },

    /** ── 4. 執行順序：先清除、後修剪 ── */
    { input: '\u200b abc', expected: 'abc',
        note: 'ZWSP removed BEFORE trim — space trapped behind ZWSP still trimmed (order matters)' },
    { input: ' \u200babc\u200b ', expected: 'abc',
        note: 'mixed edge cleanup: invisible + spaces' },
    { input: ' \u200b a\tx\u200b ', expected: 'a\tx',
        note: 'internal tab kept while edges fully cleaned' },
    /** --- */
]

describe('trimPromptText', async () => {
    /** runCases 的 fn 參數為 lazy factory（內部會 await fn()），故傳入載入函式 */
    runCases('cleanup intent (direct assertions, no snapshot)', trimPromptText, cleanupCases)
})
