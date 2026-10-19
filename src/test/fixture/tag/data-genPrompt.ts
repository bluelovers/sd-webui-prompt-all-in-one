
import type { IGenPromptTag } from '../../../src/utils/genPrompt';
import type { IGenPromptCase } from '../../helpers/types/node-test-case-types';


/** 一般文字標籤（對應 _appendTag 的 type='text'）。 */
const text = (value: string): IGenPromptTag => ({ type: 'text', value, localValue: '' })

/** 換行標籤（對應 _appendTag 的 type='wrap'，value 與 localValue 都是 "\n"）。 */
const wrap = (): IGenPromptTag => ({ type: 'wrap', value: '\n', localValue: '\n' })

/** BREAK 標籤（tagIsBreak 以 value.trim() === 'BREAK' 判定）。 */
const brk = (value = 'BREAK'): IGenPromptTag => ({ type: 'BREAK', value, localValue: '' })

/** Lora 標籤（tagIsLoraLike 以 isLora / isLyco 判定）。 */
const lora = (name: string): IGenPromptTag => ({ type: 'lora', value: `<lora:${name}:1>`, isLora: true, localValue: '' })


export const genPromptCases: IGenPromptCase[] = [
	/**
	 * ── 第一組：預設選項全關 ──
	 * 只驗證「標籤串接 + 預設逗號」的基本行為，其餘選項案例的基準。
	 */
	{
		input: [text('cat'), text('dog')],
		note: '兩個一般標籤 — 預設以 ", " 串接，末段仍帶逗號（autoRemoveLastComma 關閉）',
		expected: 'cat, dog, ',
	},
	{
		input: [text('cat'), text('dog')],
		args: [false, { autoRemoveLastComma: true }],
		note: 'autoRemoveLastComma — 最後一個標籤不加逗號',
		expected: 'cat, dog',
	},
	{
		input: [text('cat'), text('dog')],
		args: [false, { autoRemoveSpace: true }],
		note: 'autoRemoveSpace — 分割符號不含空白',
		expected: 'cat,dog,',
	},
	/**
	 * ── 第二組：換行（wrap）與 BREAK ──
	 */
	{
		input: [text('cat'), wrap(), text('dog')],
		note: '中間為換行標籤 — 換行符獨立成段，前段仍保留預設逗號',
		expected: 'cat, \ndog, ',
	},
	{
		input: [text('cat'), wrap(), text('dog')],
		args: [false, { autoRemoveBeforeLineComma: true }],
		note: 'autoRemoveBeforeLineComma — 換行前的逗號一併移除',
		expected: 'cat\ndog, ',
	},
	{
		input: [text('cat'), brk(), text('dog')],
		note: 'BREAK 標籤 — 前段以空白分隔，BREAK 後段以空白分隔',
		expected: 'cat BREAK dog, ',
	},
	/**
	 * ── 第三組：autoOptimizeSplitSymbol ──
	 * 規則 1（連續 Lora）與規則 2（下一個是 BREAK）由 shouldRemoveCommaByAutoOptimize 判定。
	 */
	{
		input: [lora('foo'), lora('bar')],
		args: [false, { autoOptimizeSplitSymbol: true }],
		note: 'autoOptimizeSplitSymbol — 連續 Lora 之間的逗號被移除（規則 1）',
		expected: '<lora:foo:1> <lora:bar:1>, ',
	},
	{
		input: [lora('foo'), lora('bar')],
		args: [false, { autoOptimizeSplitSymbol: true, autoRemoveLoraAfterComma: true }],
		note: 'autoOptimizeSplitSymbol + autoRemoveLoraAfterComma — 末段 Lora 的逗號換成空白（autoRemoveSpace 關閉時保留空白）',
		expected: '<lora:foo:1> <lora:bar:1> ',
	},
	/**
	 * ── 第四組：disabled 過濾 ──
	 */
	{
		input: [text('cat'), { ...text('dog'), disabled: true }],
		note: '預設過濾 disabled 標籤',
		expected: 'cat, ',
	},
	{
		input: [text('cat'), { ...text('dog'), disabled: true }],
		args: [true],
		note: 'ignoreDisabled=true — 保留 disabled 標籤',
		expected: 'cat, dog, ',
	},
	/**
	 * ── 第五組：'#' 標記 ──
	 * 規則 3（該行含 # 開頭/結尾）在 shouldRemoveCommaBeforeWrap 中被註解停用，
	 * lineHasSharp 仍會累計但不影響結果——此案例把現況鎖定下來。
	 */
	{
		input: [text('#'), wrap(), text('cat')],
		args: [false, { autoOptimizeSplitSymbol: true }],
		note: "autoOptimizeSplitSymbol — '#' 本身不觸發換行前逗號移除（規則 3 目前停用）",
		expected: '#, \ncat, ',
	},
	/**
	 * ── 第六組：autoSplitByPeriod ──
	 * splitNoComma 由 applySplitByPeriod 標記，genPrompt 只負責依標記去逗號。
	 */
	{
		input: [{ ...text('a'), splitNoComma: true }, text('b')],
		args: [false, { autoSplitByPeriod: true }],
		note: 'autoSplitByPeriod — 已標記 splitNoComma 的中間段不加逗號',
		expected: 'a b, ',
	},
	/**
	 * ── 第七組：邊界 ──
	 */
	{
		input: [],
		note: '空標籤陣列 — 回傳空字串',
		expected: '',
	},
	{
		input: [{ ...text('cat'), disabled: true }],
		note: '全部為 disabled — 回傳空字串',
		expected: '',
	},
]
