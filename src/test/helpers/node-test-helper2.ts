/**
 * 斷言：不得出現孤兒逗號 tag。
 *
 * 來源 issue：孤立雙引號（如 JSON 殘骸 `", "}, }`）開啟引號狀態後，
 * 舊版 splitTags 的分行不重置 quoteChar，導致後續整行被引號吞掉、
 * 逗號全部失效，lora 後處理再把分隔逗號切成值恰為 "," 的孤兒 tag，
 * 最終 genPrompt 輸出 `, ,,`。
 *
 * 檢查項目：
 *   1. 不得存在值恰為 "," 的 tag（孤兒分隔逗號）。
 *   2. 不得存在以 "," 結尾的 tag（分隔符被誤留在 tag 內容尾端）。
 *
 * @param {string[]} tagResult - splitTags 的輸出陣列
 * @param {object}   t         - node:test 的 TestContext（提供 assert）
 */
export function assertNoOrphanCommaTags(tagResult, t)
{
	const orphans = tagResult.filter(tag => tag === ',')
	t.assert.deepEqual(orphans, [],
		`不應存在孤兒逗號 tag（值恰為 ","）: ${JSON.stringify(orphans)}`,
	)

	const trailing = tagResult.filter(tag => tag !== ',' && /,$/.test(tag))
	t.assert.deepEqual(trailing, [],
		`不應存在尾隨逗號 tag（分隔符殘留在 tag 內容）: ${JSON.stringify(trailing.map(v => v.slice(-40)))}`,
	)
}

/**
 * 斷言：所有 <lora:...> tag 都是完整獨立的 tag。
 *
 * 來源 issue 同上：孤兒逗號出現時，lora 前的 before 殘片會帶尾隨逗號，
 * 破壞 lora 單元的完整性。
 *
 * @param {string[]} tagResult
 * @param {object}   t
 */
export function assertLoraTagsIntact(tagResult, t)
{
	const broken = tagResult.filter(tag => tag.startsWith('<lora:') && !/^<lora:[^>]+>$/.test(tag))
	t.assert.deepEqual(broken, [],
		`lora tag 應為完整獨立單元: ${JSON.stringify(broken)}`,
	)
}

/**
 * issues 回歸案例共用斷言：孤兒逗號 + lora 完整性。
 * @param {string[]} tagResult
 * @param {object}   t
 */
export function assertNoOrphanCommaRegressions(tagResult, t)
{
	assertNoOrphanCommaTags(tagResult, t)
	assertLoraTagsIntact(tagResult, t)
}

/**
 * 斷言：結果中不得殘留不可見字元（\x00 NULL、\u200b 零寬空格）。
 * 來源：輸入清理（trimPromptText）應在 splitTags 入口完成清除。
 *
 * @param {string[]} tagResult
 * @param {object}   t
 */
export function assertNoInvisibleChars(tagResult, t)
{
	const INVISIBLE_RE = /[\x00\u200b]/
	const polluted = tagResult.filter(tag => INVISIBLE_RE.test(tag))
	t.assert.deepEqual(polluted, [],
		`不得殘留不可見字元: ${JSON.stringify(polluted)}`,
	)
}

/**
 * 斷言：首尾 tag 不得多餘水平空白（邊界空白應已修剪；\n 標記除外）。
 *
 * @param {string[]} tagResult
 * @param {object}   t
 */
export function assertNoEdgeWhitespace(tagResult, t)
{
	const segments = tagResult.filter(tag => tag !== '\n')
	const first = segments[0] ?? ''
	const last = segments[segments.length - 1] ?? ''
	t.assert.equal(/^[^\S\n]|[^\S\n]$/.test(first), false,
		`首段不得有前導空白: ${JSON.stringify(first)}`,
	)
	t.assert.equal(/[^\S\n]$/.test(last), false,
		`末段不得有尾隨空白: ${JSON.stringify(last)}`,
	)
}

/**
 * 斷言：管線最終結果中 '#' 的數量與原始輸入完全相同。
 *
 * '#' 是提示詞中獨立成行的標記（不帶標點）：splitTags 負責切段、
 * splitByPeriod 負責切句，兩者都只能「切開」文字，
 * 不得新增或丟棄標記字元。數量守恆即代表管線沒有吞字或造字。
 *
 * 供案例的 assertPipeline 欄位使用（見 helpers/node-test-case-types）。
 *
 * @param {string[]} finalResult - splitTags → splitByPeriod 的最終結果
 * @param {object}   t           - node:test 的 TestContext（提供 assert）
 * @param {{ input: unknown }} tc - 測試案例（以 input 計算基準數量）
 */
export function assertHashCountPreserved(finalResult, t, tc)
{
	const count = text => String(text).split('#').length - 1
	const expected = count(tc.input)
	const actual = count(finalResult.join(''))
	t.assert.equal(actual, expected,
		`管線輸出的 '#' 數量應與輸入相同：input=${expected}, output=${actual}`,
	)
}
