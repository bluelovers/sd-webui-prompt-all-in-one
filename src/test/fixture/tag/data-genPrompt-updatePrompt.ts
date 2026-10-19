
import type { IGenPromptTag } from '../../../src/utils/promptTags/genPrompt';
import type { IUpdatePromptCase } from '../../helpers/types/node-test-case-types';


/** 一般文字標籤（對應 _appendTag 的 type='text'）。 */
const text = (value: string): IGenPromptTag => ({ type: 'text', value, localValue: '' })

/** 換行標籤（對應 _appendTag 的 type='wrap'）。 */
const wrap = (): IGenPromptTag => ({ type: 'wrap', value: '\n', localValue: '\n' })

/** BREAK 標籤（tagIsBreak 以 value.trim() === 'BREAK' 判定）。 */
const brk = (value = 'BREAK'): IGenPromptTag => ({ type: 'BREAK', value, localValue: '' })

/** Lora 標籤（tagIsLoraLike 以 isLora / isLyco 判定）。 */
const lora = (name: string): IGenPromptTag => ({ type: 'lora', value: `<lora:${name}:1>`, isLora: true, localValue: '' })


export const genPromptUpdatePromptCases: IUpdatePromptCase[] = [
	/**
	 * ── 第一組：BREAK → 換行 → 重跑 → 組字 ──
	 * 這組案例以「真 genPrompt + refresh 重入 updatePrompt」執行，
	 * 與元件的實際流程一致：updatePrompt 插入換行 → updateTags → updatePrompt → commit。
	 * 期望值是插入後的標籤經 genPrompt 組出的「最終 prompt」。
	 */
	{
		tags: [text('cat'), brk(), text('dog')],
		autoBreakBeforeWrap: true,
		autoBreakAfterWrap: true,
		genPromptOptions: { autoRemoveBeforeLineComma: true, autoRemoveLastComma: true },
		note: '前後都補換行 + 移除換行前逗號與末段逗號 — 三段乾淨輸出',
		assert: (summary, t) => {
			t.assert.equal(summary.appended.length, 2)
			t.assert.equal(summary.refreshCount, 1, '插入後應重跑一次（refresh → updatePrompt）')
			t.assert.equal(summary.genPromptCount, 1)
			t.assert.deepEqual(summary.committed, ['cat\nBREAK\ndog'])
		},
	},
	{
		tags: [text('cat'), brk(), text('dog')],
		autoBreakBeforeWrap: true,
		autoBreakAfterWrap: true,
		genPromptOptions: { autoRemoveLastComma: true },
		note: '未開 autoRemoveBeforeLineComma — 換行前仍保留預設逗號（現況鎖定）',
		expectedPrompt: 'cat, \nBREAK\ndog',
	},
	{
		tags: [text('cat'), brk(), text('dog')],
		autoBreakAfterWrap: true,
		genPromptOptions: { autoRemoveLastComma: true },
		note: '只在 BREAK 後補換行 — 前段以空白分隔',
		expectedPrompt: 'cat BREAK\ndog',
	},
	{
		tags: [text('a'), brk(), text('b'), brk(), text('c')],
		autoBreakBeforeWrap: true,
		autoBreakAfterWrap: true,
		genPromptOptions: { autoRemoveBeforeLineComma: true, autoRemoveLastComma: true },
		note: '兩個 BREAK 四處插入 — 第二輪已無可插入處，流程收斂',
		assert: (summary, t) => {
			t.assert.equal(summary.appended.length, 4)
			t.assert.equal(summary.refreshCount, 1, '只應重跑一次')
			t.assert.deepEqual(summary.committed, ['a\nBREAK\nb\nBREAK\nc'])
		},
	},
	/**
	 * ── 第二組：不需插入 — 首輪即組字 ──
	 */
	{
		tags: [text('cat'), text('dog')],
		genPromptOptions: { autoRemoveLastComma: true },
		note: '沒有 BREAK — 首輪直接以 genPrompt 組字',
		assert: (summary, t) => {
			t.assert.equal(summary.refreshCount, 0)
			t.assert.equal(summary.genPromptCount, 1)
			t.assert.deepEqual(summary.committed, ['cat, dog'])
		},
	},
	{
		tags: [text('cat'), wrap(), brk(), text('dog')],
		autoBreakBeforeWrap: true,
		genPromptOptions: { autoRemoveLastComma: true },
		note: 'BREAK 前已是換行 — 不重複插入，直接組字',
		expectedWrapCount: 0,
		expectedPrompt: 'cat, \nBREAK dog',
	},
	{
		tags: [lora('foo'), lora('bar')],
		genPromptOptions: { autoOptimizeSplitSymbol: true, autoRemoveLoraAfterComma: true },
		note: '連續 Lora — 與 BREAK 無關，首輪直接組字且逗號被換成空白',
		expectedWrapCount: 0,
		expectedPrompt: '<lora:foo:1> <lora:bar:1> ',
	},
]
