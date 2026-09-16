/**
 * splitTags.node-test.js
 *
 * 以 Node.js 原生測試運行器（node:test + node:assert）撰寫的測試腳本。
 * 使用 t.assert.snapshot() 進行快照比對，測試結果自動寫入 .snapshot 檔案，
 * 不需手動複製或維護預期值。
 *
 * 執行方式：
 *   cd src && node --test test/splitTags.node-test.js
 *
 * 首次建立 / 內容變動後更新快照：
 *   cd src && node --test --test-update-snapshots test/splitTags.node-test.js
 *
 * 快照檔案位置：test/splitTags.node-test.js.snapshot（與測試檔同目錄）
 *
 * 檔名採用 .node-test.js 後綴，與未來可能引入的第三方測試框架（Jest / Vitest）
 * 透過 glob pattern 做區隔，避免衝突。
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')

/* ====================================================================
 *  工具函式
 * ==================================================================== */

/**
 * 動態載入 ESM 模組。
 */
async function loadModule() {
    const mod = await import('../src/utils/splitTags.js')
    return mod.default
}

/**
 * 動態載入 splitByPeriod ESM 模組。
 */
async function loadSplitByPeriod() {
    const mod = await import('../src/utils/splitByPeriod.js')
    return mod.default
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

/**
 * 產生測試標題。
 * - 短輸入（≤ 100 字元）：直接使用 note
 * - 長輸入（> 100 字元）：「{hash} {截斷輸入}」
 *
 * @param {Object} tc
 * @returns {string}
 */
function testTitle(tc) {
    if (tc.input && typeof tc.input === 'string') {
        if (tc.input.length > 100 || !tc.note) {
            return `[${promptHash(tc.input)}] ${truncate(tc.input)}`
        }
        return `[${promptHash(tc.input)}] ${tc.note || 'unnamed'}`
    }
    return tc.note || 'unnamed'
}

/* ====================================================================
 *  測試案例定義
 *
 *  每筆案例格式：
 *    { input, args?, note? }
 *
 *  - input : 傳入 splitTags 的第一個參數（tags 字串）
 *  - args  : 額外參數陣列 [autoBreakBeforeWrap, autoBreakAfterWrap]
 *  - note  : 附加說明（顯示在測試標題中）
 *
 *  斷言方式：
 *    - 短輸入：t.assert.snapshot(result)
 *    - 長輸入（> 100 字元）：t.assert.snapshot({ input, result })
 *      快照內同時保存原始輸入與切割結果，方便 review。
 *
 *  設計原則：
 *    - 每筆案例只測試一個行為，從真實輸入中擷取小片段。
 *    - 案例之間完全獨立，新增不會導致既有快照名稱移位。
 *    - 長輸入以雜湊作為快照名稱前綴，避免名稱過長且保持穩定。
 * ==================================================================== */

const cases = [
    // ── 基本切割 ──
    { input: 'a, b, c',
        note: 'comma-separated' },
    { input: 'a, b, c,',
        note: 'trailing comma' },
    { input: 'a,  ,  b',
        note: 'empty segments filtered' },

    // ── 換行切割 ──
    { input: 'a\nb\nc',
        note: 'newline-separated' },
    { input: 'a\n\n\nb',
        note: 'multiple newlines collapsed' },
    { input: 'a\rb\nc',
        note: 'CR normalized to LF' },
    { input: 'a\tb',
        note: 'tab converted to newline' },

    // ── 中文標點 ──
    { input: '好。壞。普通',
        note: 'Chinese period → period (not comma)' },
    { input: '好、壞、普通',
        note: 'Chinese enumeration comma → comma' },
    { input: '好；壞；普通',
        note: 'Chinese semicolon → comma' },
    { input: '好．壞．普通',
        note: 'Japanese period → comma' },

    // ── 括號保護 ──
    { input: 'a, [b, c], d',
        note: 'square brackets protect inner commas' },
    { input: 'a, <b, c>, d',
        note: 'angle brackets protect inner commas' },
    { input: 'a, {b, c}, d',
        note: 'curly braces protect inner commas' },

    // ── 巢狀括號 ──
    { input: 'a, ([b, c]), d',
        note: 'nested bracket types' },
    { input: '[a, [b, c]], d',
        note: 'nested same bracket type' },

    // ── BREAK 關鍵字 ──
    { input: 'a, BREAK, b',
        note: 'BREAK keyword splits' },
    { input: 'a\nBREAK\nb',
        note: 'BREAK with newlines' },

    // ── LoRA 標籤 ──
    { input: 'a, <lora:model:0.7>, b',
        note: 'LoRA tag preserved as single unit' },
    { input: '<lora:A:1> <lora:B:0.5>, c',
        note: 'multiple LoRA tags' },

    // ── 表情符號保護 ──
    { input: 'a, >_<, b',
        note: 'emoji >_< protected' },
    { input: 'a, :<, b',
        note: 'emoji :< protected' },
    { input: 'a, :-(, b',
        note: 'emoji :-( protected' },
    { input: 'a, :-), b',
        note: 'emoji :-) protected' },

    // ── 空值 / 邊界 ──
    { input: '',
        note: 'empty string' },
    { input: '   ',
        note: 'whitespace only' },
    { input: null,
        note: 'null input' },
    { input: undefined,
        note: 'undefined input' },
    { input: false,
        note: 'boolean false input' },

    // ── prompt weight ──
    { input: '(fire extinguisher: 1.0, 2.0), a',
        note: 'weight syntax — inner comma preserved' },

    // ── 引號保護 ──
    { input: 'with "Small joys. Brighter days." below.',
        note: 'quoted sentence — comma inside protected' },
    { input: "with 'hello, world' end",
        note: 'single-quoted comma protected' },
    { input: '"a, b", c, "d, e"',
        note: 'multiple quoted segments with commas' },
    { input: "it's a, b, c",
        note: 'apostrophe — not a quote opener' },
    { input: 'a, "b, c',
        note: 'unclosed quote — rest protected to end' },
    { input: '"a, b"\n"c, d"',
        note: 'quoted segments with newline between' },
    { input: '"a, b"\nc, d',
        note: 'quoted then newline then unquoted split' },

    // ── 真實場景摘錄 ──
    { input: '"くらしに、さくらを。" beneath',
        note: 'excerpt: Japanese period inside quotes' },
    { input: '"いつもの日を、少し特別に。" with',
        note: 'excerpt: Japanese comma + period in quotes' },
    { input: '"今日も、いい一日を。" with',
        note: 'excerpt: another Japanese comma + period' },
    { input: '"さくらの季節をもっと身近に。".',
        note: 'excerpt: Japanese period then English period' },
    { input: 'lists "たばこ", "お弁当", "飲み物", "スイーツ", and "日用品"',
        note: 'excerpt: quoted items separated by commas' },
    { input: 'The left window poster reads "今日も、いい一日を。" with "Good day. Better tomorrow." below.',
        note: 'excerpt: period-space splits outside quotes' },
    { input: 'The right window poster reads "さくらの季節をもっと身近に。".',
        note: 'excerpt: Japanese period then trailing English period' },
]

/* ====================================================================
 *  執行測試
 * ==================================================================== */

describe('splitTags', async () => {
    const splitTags = await loadModule()

    it('module loads successfully', (t) => {
        t.assert.equal(typeof splitTags, 'function')
    })

    for (const tc of cases) {
        const title = testTitle(tc)
        it(title, (t) => {
            const result = splitTags(tc.input, ...(tc.args || []))
            // 長輸入：快照同時保存原始輸入與結果，方便 review
            if (tc.input && typeof tc.input === 'string' && tc.input.length > 100) {
                t.assert.snapshot({ input: tc.input, result })
            } else {
                t.assert.snapshot(result)
            }
        })
    }
})

/* ====================================================================
 *  跨模組整合測試：splitTags → splitByPeriod 管線
 *
 *  將 splitTags 的輸出逐項送入 splitByPeriod，
 *  觀察 splitByPeriod 是否會進一步拆分。
 *
 *  - splitByPeriodChanged: false → splitByPeriod 未改變結果
 *  - splitByPeriodChanged: true  → splitByPeriod 產生了新的拆分
 * ==================================================================== */

// 需要進行跨模組驗證的特定提示詞
const pipelineCases = [
    // 完整提示詞
    { input: 'Prominent readable text and placement: the main illuminated facade at upper left-center reads "Sakura Stop" with "くらしに、さくらを。" beneath. The right side of the fascia reads "いつもの日を、少し特別に。" with "Small joys. Brighter days." below. The tall illuminated sign above the slope reads "Sakura Stop" and lists "たばこ", "お弁当", "飲み物", "スイーツ", and "日用品". The left window poster reads "今日も、いい一日を。" with "Good day. Better tomorrow." below. The right window poster reads "さくらの季節をもっと身近に。". A pink vertical banner beside the store reads "さくらと、いい毎日を。". The roadside vertical sign at far right reads "海の見える町". The downhill road includes the white marking "止まれ" near the lower distance.',
        note: 'full prompt pipeline',
        expectChanged: true },

    // 複雜 prompt（含 weight、LoRA、BREAK）
    { input: 'masterpiece, best quality, (1girl:1.2), <lora:add_detail:0.6>, BREAK, forest, trees',
        note: 'complex prompt pipeline' },

    // 含引號的短 prompt
    { input: 'with "Small joys, Brighter days." below.',
        note: 'quoted comma pipeline' },

    // 含中文標點的 prompt
    { input: '好，壞，普通',
        note: 'Chinese comma pipeline' },

    // 含括號巢狀的 prompt
    { input: 'a, (b, c), d',
        note: 'parentheses pipeline' },

    { input: '一位穿著太空衣的貓、復古老舊的紅色跑車' },

]

describe('splitTags → splitByPeriod pipeline', async () => {
    const splitTags = await loadModule()
    const splitByPeriod = await loadSplitByPeriod()

    for (const tc of pipelineCases) {
        const title = testTitle(tc)
        it(title, (t) => {
            // Step 1: splitTags 切割
            const tagResult = splitTags(tc.input, ...(tc.args || []))

            // Step 2: 逐項送入 splitByPeriod（不含 includeParen）
            const finalResult = tagResult.flatMap(tag => splitByPeriod(tag))

            // Step 3: 比較
            const changed = JSON.stringify(tagResult) !== JSON.stringify(finalResult)

            // Step 3b: 明確期望值驗證（如 expectChanged: true）
            if (tc.expectChanged !== undefined) {
                t.assert.equal(changed, tc.expectChanged)
            }

            // Step 4: 輸出指標
            if (changed) {
                console.log(`  ⚠ splitByPeriodChanged: true  (${tagResult.length} → ${finalResult.length} segments)`)
            } else {
                console.log(`  ✓ splitByPeriodChanged: false`)
            }

            // Step 5: 快照保存完整結果
            // changed=false 時不顯示 splitByPeriodResult（與 splitTagsResult 重複）
            const snapshot = changed
                ? {
                    input: tc.input,
                    splitTagsResult: tagResult,
                    splitByPeriodChanged: true,
                    splitByPeriodResult: finalResult,
                }
                : {
                    input: tc.input,
                    splitTagsResult: tagResult,
                    splitByPeriodChanged: false,
                }
            t.assert.snapshot(snapshot)
        })
    }
})
