/**
 * trimInnerOfBracket.node-test.ts
 *
 * trimInnerOfBracket 的單元測試：以 expected 鎖定行為意圖，並以 suiteSnapshot 記錄回歸快照。
 *
 * 執行方式：
 *   cd src && node --run test:node:target -- test/trimInnerOfBracket.node-test.ts
 *
 * 意圖分組：
 *   1. 守門：空字串 / 無括號字元 / 首尾不配對 —— 原樣回傳
 *   2. 內側空白修剪（半形 () [] {} <>；全形括號被守門擋下，原樣回傳）
 *   3. `,x,` 前後逗號清除 —— 僅半形 ()；內容為單一英數字或數值時保留原樣
 *   4. 無變動案例維持原樣（避免改寫誤傷正常 tag）
 */

import { describe } from 'node:test'
import { runCases } from './helpers/node-test-helpers'
import type { IRunCase } from './helpers/types/node-test-case-types'
import type { IHostPromptOptions } from '#/src/utils/promptTags/types'
import { trimInnerOfBracket } from '#/src/utils/promptTags/util/tag-weight'
import { IRunCasesSnap } from './helpers/types/snap-types'

/** 案例型別：輸入字串 → 回傳字串；hostOptions 被測函式未使用，故不傳 args */
type ITrimInnerCase = IRunCase<string, [IHostPromptOptions], ReturnType<typeof _trimInnerOfBracketForTest>>

/* ====================================================================
 *  測試案例定義
 * ==================================================================== */

/** ── 1. 守門：原樣回傳 ── */
const guardCases: ITrimInnerCase[] = [
	{
		input: '',
		partialExpected: {
			changed: false,
		},
		note: 'empty string'
	},
	{
		input: 'plain tag',
		partialExpected: {
			changed: false,
		},
		note: 'no bracket char at all'
	},
	{
		input: 'a(b',
		partialExpected: {
			changed: false,
		},
		note: 'bracket char present but ends unpaired'
	},
	{
		input: '(abc',
		partialExpected: {
			changed: false,
		},
		note: 'open paren without close'
	},
	{
		input: '(a]',
		partialExpected: {
			changed: false,
		},
		note: 'mismatched pair ( ( … ] )'
	},
]

/** ── 2. 內側空白修剪（全括號型別）── */
const whitespaceCases: ITrimInnerCase[] = [
	{
		input: '( tag )',
		partialExpected: {
			result: '(tag)',
		},
		note: 'half-width parens trimmed'
	},
	{
		input: '(( tag ))',
		partialExpected: {
			result: '((tag))',
		},
		note: 'multiple layers trimmed in one pass'
	},
	{
		input: '[ tag ]',
		partialExpected: {
			result: '[tag]',
		},
		note: 'square brackets trimmed'
	},
	{
		input: '{ tag }',
		partialExpected: {
			result: '{tag}',
		},
		note: 'NovelAI braces trimmed'
	},
	{
		input: '< lora:foo >',
		partialExpected: {
			changed: true,
		},
		note: 'angle brackets trimmed'
	},
	{
		input: '（ tag ）',
		partialExpected: {
			changed: false,
		},
		note: 'full-width parens untouched — guard regex only matches half-width bracket chars'
	},
	{
		input: '(x\t)',
		partialExpected: {
			result: '(x)',
		},
		note: 'edge tab trimmed'
	},
	{
		input: '(  )',
		partialExpected: {
			result: '()',
		},
		note: 'whitespace-only inner → empty'
	},
	{
		input: '()',
		partialExpected: {
			changed: false,
		},
		note: 'already empty inner unchanged'
	},
]

/** ── 3. `,x,` 前後逗號清除（僅半形 ()）── */
const commaCases: ITrimInnerCase[] = [
	{
		input: '(,1girl,)', partialExpected: {
			result: '(1girl)',
		},
		note: 'leading/trailing commas stripped'
	},
	{
		input: '( , 1girl , )', partialExpected: {
			result: '(1girl)',
		},
		note: 'commas + spaces stripped together'
	},
	{
		input: '((,1girl,))', partialExpected: {
			result: '((1girl))',
		},
		note: 'stripped across multiple layers'
	},
	{
		input: '(,tag, with space)', partialExpected: {
			result: '(tag, with space)',
		},
		note: 'only edge commas stripped, internal comma kept'
	},
	{
		input: '(,1girl,:1.5)', partialExpected: {
			result: '(1girl,:1.5)',
		},
		note: 'trailing comma sits before weight number — only leading one stripped'
	},
	{
		input: '(,a,)', partialExpected: {
			result: '(,a,)',
		},
		note: 'single letter preserved'
	},
	{
		input: '(,x,)', partialExpected: {
			result: '(,x,)',
		},
		note: 'single letter preserved'
	},
	{
		input: '(,1,)', partialExpected: {
			result: '(,1,)',
		},
		note: 'single digit preserved'
	},
	{
		input: '(,12,)', partialExpected: {
			result: '(,12,)',
		},
		note: 'plain number preserved'
	},
	{
		input: '(,1.5,)', partialExpected: {
			result: '(,1.5,)',
		},
		note: 'decimal number preserved'
	},
	{
		input: '(x:1.5,)', partialExpected: {
			result: '(x:1.5)',
		},
		note: 'weight preserved'
	},
	{
		input: '(x :1.5,)', partialExpected: {
			changed: true,
		},
		note: 'weight preserved'
	},
	{
		input: '( ,a, )', partialExpected: {
			result: '(,a,)',
		},
		note: 'whitespace trimmed even when comma rule declines'
	},
	{
		input: '(,)', partialExpected: {
			changed: false,
		},
		note: 'lone comma pair collapses to empty'
	},
	{
		input: '(,,)', partialExpected: {
			changed: false,
		},
		note: 'double comma collapses to empty'
	},
	{
		input: '( , , )', partialExpected: {
			changed: true,
		},
		note: 'comma + spaces collapse to empty'
	},
	{
		input: '[,1girl,]', partialExpected: {
			changed: false,
		},
		note: 'square brackets — comma rule not applied'
	},
	{
		input: '{,1girl,}', partialExpected: {
			changed: false,
		},
		note: 'NovelAI braces — comma rule not applied'
	},
]

/** ── 4. 無變動 ── */
const unchangedCases: ITrimInnerCase[] = [
	{
		input: '(tag)', partialExpected: {
			changed: false,
		},
		note: 'no surrounding whitespace/commas'
	},
	{
		input: '(a)', partialExpected: {
			changed: false,
		},
		note: 'single letter as whole inner'
	},
	{
		input: '(1)', partialExpected: {
			changed: false,
		},
		note: 'single digit as whole inner'
	},
	{
		input: '(1girl)', partialExpected: {
			changed: false,
		},
		note: 'normal tag with leading digit'
	},
	{
		input: '(風景)', partialExpected: {
			changed: false,
		},
		note: 'CJK content untouched'
	},
	{
		input: '[tag]', partialExpected: {
			changed: false,
		},
		note: 'dec-weight brackets untouched'
	},
]

const emojiCases: ITrimInnerCase[] = [
	{
		input: '(,风,)',
		partialExpected: {
			changed: false,
		},
	},
	{
		input: '(´;ω;`)',
		partialExpected: {
			changed: false,
		},
	},
	{
		input: '(`･ω･´)',
		partialExpected: {
			changed: false,
		},
	},
	{
		input: '(*^_^ *)',
		partialExpected: {
			changed: false,
		},
	},
	{
		input: '(◕‿◕)’',
		partialExpected: {
			changed: false,
		},
	},
	{
		input: '(^▽^)v',
		partialExpected: {
			changed: false,
		},
	},
	{
		input: '(o゜▽゜)o☆',
		partialExpected: {
			changed: false,
		},
	},
	{
		input: '(o´∀｀)o',
		partialExpected: {
			changed: false,
		},
	},
	{
		input: '( ¯ ³¯)♡',
		partialExpected: {
			changed: false,
		},
	},
	{
		input: '(´∀`*)ﾉ',
		partialExpected: {
			changed: false,
		},
	},
	{
		input: '(つд⊂)',
		partialExpected: {
			changed: false,
		},
	},
]

function _trimInnerOfBracketForTest(input: string, hostOptions?: IHostPromptOptions)
{
	const result = trimInnerOfBracket(input)
	return {
		result,
		changed: result !== input,
	}
}

describe('trimInnerOfBracket', async () =>
{
	runCases('guards — empty / no bracket char / unpaired ends', _trimInnerOfBracketForTest, guardCases, { suiteSnapshot: true })
	runCases('inner whitespace trim (half-width bracket types)', _trimInnerOfBracketForTest, whitespaceCases, { suiteSnapshot: true })
	runCases('leading/trailing comma strip (half-width parens only)', _trimInnerOfBracketForTest, commaCases, { suiteSnapshot: true })
	runCases('unchanged passthrough', _trimInnerOfBracketForTest, unchangedCases, { suiteSnapshot: true })
	runCases('emoji cases', _trimInnerOfBracketForTest, emojiCases, { suiteSnapshot: true, suiteAllowSnapshotOnly: true })
})
