/**
 * splitByPeriod.node-test.js
 *
 * 以 Node.js 原生測試運行器（node:test + node:assert）撰寫的測試腳本。
 * 測試邏輯由 helpers/node-test-helpers.js 的 runCases() 統一執行，
 * 本檔案僅負責定義「測試案例資料」與模組載入。
 *
 * 執行方式：
 *   cd src && node --test test/splitByPeriod.node-test.js
 *
 * 檔名採用 .node-test.js 後綴，與未來可能引入的第三方測試框架（Jest / Vitest）
 * 透過 glob pattern 做區隔，避免衝突。
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { runCases } = require('./helpers/node-test-helpers')

/* ====================================================================
 *  測試案例定義
 *
 *  每筆案例格式：
 *    { input, args?, expected, note?, assert?, skip? }
 *
 *  - input    : 傳入函式的第一個參數
 *  - args     : 額外參數陣列（會 spread 到 fn(input, ...args)）
 *  - expected : 期望回傳值（與 assert 二選一）
 *  - note     : 附加說明（顯示在測試標題中）
 *  - assert   : 自訂斷言 fn(result)，若有則取代 expected
 *  - skip     : true 時跳過此案例
 * ==================================================================== */

const basicCases = [
    { input: 'a. b. c',       expected: ['a.', 'b.', 'c'] },
    { input: 'hello. world',  expected: ['hello.', 'world'] },
    { input: 'one.  two.  three', expected: ['one.', 'two.', 'three'],
        note: 'multiple spaces after period' },
    { input: 'abc.',          expected: ['abc.'],
        note: 'trailing period, no space after' },
    { input: 'abc. ',         expected: ['abc.', ''],
        note: 'period + space then end of string' },
    { input: 'a.b',           expected: ['a.b'],
        note: 'period without surrounding space — no split' },
]

const noPeriodCases = [
    { input: 'hello world', expected: ['hello world'] },
    { input: '',            expected: [''],
        note: 'empty string' },
]

const bracketProtectionCases = [
    { input: 'xxx. (111. 222)',  args: [true], expected: ['xxx.', '(111. 222)'] },
    { input: '(111. 222). xxx',  args: [true], expected: ['(111. 222).', 'xxx'] },
    { input: 'xxx. (111. 222',   args: [true], expected: ['xxx.', '(111. 222'],
        note: 'unclosed paren' },
    { input: '(111. 222. xxx',   args: [true], expected: ['(111. 222. xxx'],
        note: 'unclosed paren — no split at all' },
    { input: 'aaa. (bbb. ccc). ddd. eee', args: [true],
        expected: ['aaa.', '(bbb. ccc).', 'ddd.', 'eee'] },
    { input: 'aaa. [bbb. ccc]. ddd', args: [true],
        expected: ['aaa.', '[bbb. ccc].', 'ddd'], note: 'square brackets' },
    { input: 'aaa. {bbb. ccc}. ddd', args: [true],
        expected: ['aaa.', '{bbb. ccc}.', 'ddd'], note: 'curly brackets' },
    { input: 'a. ((b. c). d). e', args: [true],
        expected: ['a.', '((b. c). d).', 'e'], note: 'deeply nested' },
    { input: 'a. ([b. c]). d', args: [true],
        expected: ['a.', '([b. c]).', 'd'], note: 'mixed bracket types' },
]

const includeParenFalseCases = [
    { input: 'xxx. (111. 222)', args: [false], expected: ['xxx. (111. 222)'],
        note: 'first open paren stops' },
    { input: 'a. b. (c. d)',   args: [false], expected: ['a.', 'b. (c. d)'],
        note: 'splits first two, stops at third' },
    { input: 'a. b. [c. d]',   args: [false], expected: ['a.', 'b. [c. d]'],
        note: 'square bracket stops' },
    { input: 'a. b. {c. d}',   args: [false], expected: ['a.', 'b. {c. d}'],
        note: 'curly bracket stops' },
    { input: '(111. 222). xxx', args: [false], expected: ['(111. 222).', 'xxx'],
        note: 'closed paren — split works' },
    { input: 'a. b. c',        args: [false], expected: ['a.', 'b.', 'c'],
        note: 'no parens — all splits work' },
]

const mismatchedBracketCases = [
    { input: 'a. )b. c',  args: [true], expected: ['a.', ')b.', 'c'],
        note: 'stray close paren ignored' },
    { input: 'a. ]. b',   args: [true], expected: ['a.', '].', 'b'],
        note: 'stray close bracket ignored' },
    { input: '(a. (b. c)). d', args: [true],
        expected: ['(a. (b. c)).', 'd'], note: 'nested open parens' },
    { input: '((a. b). (c. d)). e', args: [true],
        expected: ['((a. b). (c. d)).', 'e'], note: 'multiple nested groups' },
]

const nonStringGuardCases = [
    { input: 42,           expected: ['42'],          note: 'number' },
    { input: null,         expected: ['null'],         note: 'null' },
    { input: undefined,    expected: ['undefined'],    note: 'undefined' },
    { input: true,         expected: ['true'],         note: 'boolean' },
    { input: { a: 1 },     expected: ['[object Object]'], note: 'object' },
]

const defaultParamCases = [
    { input: 'xxx. (111. 222)', expected: ['xxx.', '(111. 222)'],
        note: 'omitted args → includeParen defaults to true' },
]

const whitespaceCases = [
    { input: 'a.\tb. c',       expected: ['a.', 'b.', 'c'], note: 'tab after period' },
    { input: 'a.\t  \tb. c',   expected: ['a.', 'b.', 'c'], note: 'multiple tabs + spaces' },
    { input: 'a.\nb. c',       expected: ['a.', 'b.', 'c'], note: 'newline after period' },
    { input: 'a.   (b. c)',    args: [true], expected: ['a.', '(b. c)'],
        note: 'many spaces then open paren' },
]

const realWorldCases = [
    { input: 'masterpiece, best quality. (1girl:1.2), looking at viewer',
        args: [true],
        expected: ['masterpiece, best quality.', '(1girl:1.2), looking at viewer'] },
    { input: 'highly detailed. [horse:donkey:0.5]. landscape',
        args: [true],
        expected: ['highly detailed.', '[horse:donkey:0.5].', 'landscape'] },
    { input: '(masterpiece:1.0), best quality. 1girl, {red hair}',
        args: [true],
        expected: ['(masterpiece:1.0), best quality.', '1girl, {red hair}'] },
    { input: 'tag. (nested. prompt. here). end',
        args: [true],
        expected: ['tag.', '(nested. prompt. here).', 'end'] },
]

/* ====================================================================
 *  模組載入 factory
 *
 *  傳給 runCases 時，runCases 會在 describe callback 內 await 此函式，
 *  取得真正的被測函式後再逐一執行案例。避免在模組頂層 top-level await。
 * ==================================================================== */

async function loadSplitByPeriod() {
    const mod = await import('../src/utils/splitByPeriod.js')
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

    runCases('basic splitting without brackets',           loadSplitByPeriod, basicCases)
    runCases('no period at all',                            loadSplitByPeriod, noPeriodCases)
    runCases('nested bracket protection (includeParen=true)', loadSplitByPeriod, bracketProtectionCases)
    runCases('includeParen=false — stop splitting before open paren', loadSplitByPeriod, includeParenFalseCases)
    runCases('mismatched / noisy brackets',                 loadSplitByPeriod, mismatchedBracketCases)
    runCases('non-string input guard',                      loadSplitByPeriod, nonStringGuardCases)
    runCases('default parameter (includeParen defaults to true)', loadSplitByPeriod, defaultParamCases)
    runCases('whitespace handling',                         loadSplitByPeriod, whitespaceCases)
    runCases('real-world prompt scenarios',                 loadSplitByPeriod, realWorldCases)
})
