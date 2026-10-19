
/**
 * 快照（snapshot）型別定義。
 *
 * 對應 helpers 內 t.assert.snapshot() 實際寫入的結構，
 * 與 *.node-test.ts.snapshot 檔的序列化結果逐欄位一致。
 * 建立此模組的目的是把「快照契約」從各 helper 的組裝程式中抽出來單一維護：
 * 日後若調整快照欄位，只需對照此檔與單一事實來源。
 */
import type { IPeriodPart } from '../../../src/utils/splitByPeriod'
import type { ITagSegment } from '../../../src/utils/splitTags'
import type { IGenPromptTag } from '../../../src/utils/promptTags/genPrompt'
import type {
	IGenPromptArgs,
	ISplitByPeriodArgs,
	IUpdatePromptAppendRecord,
} from './node-test-case-types'

/**
 * 與原版函式比較後附加到快照的欄位。
 * 由 helpers/node-test-helpers.attachOriginalComparison 附加；
 * 無原版（originalFn 為 null）時兩個欄位都不會寫入。
 */
export interface IOriginalComparisonSnap {
	/** 與原版結果是否有差異（原版不存在時不寫入此欄位） */
	changedFromOriginal?: boolean
	/** 僅在 changedFromOriginal=true 時附加的原版結果 */
	originalResult?: ITagSegment[]
}

/**
 * runCases 的通用快照（options.snapshot=true 時寫入）。
 * 結構固定為 { input, args?, result }，args 僅在案例有傳時才出現。
 */
export interface IRunCasesSnap<
	TInput = unknown,
	TArgs extends unknown[] = unknown[],
	TResult = unknown,
> {
	/** 案例輸入（tc.input） */
	input: TInput
	/** 額外參數（tc.args；未傳時省略） */
	args?: TArgs
	/** 被測函式的回傳值 */
	result: TResult
}

/** splitByPeriod 的快照（runCases + snapshot:true）。 */
export type ISplitByPeriodSnap = IRunCasesSnap<unknown, ISplitByPeriodArgs, IPeriodPart[]>

/** genPrompt 的快照（runCases + snapshot:true）。 */
export type IGenPromptSnap = IRunCasesSnap<IGenPromptTag[], IGenPromptArgs, string>

/**
 * splitTags 單獨測試的快照（runSplitTagsTests，splitByPeriod 為 null）。
 * 此時只記錄第一階段結果，欄位名為 result。
 */
export interface ISplitTagsSnap extends IOriginalComparisonSnap {
	/** 傳入 splitTags 的輸入（可能是非字串防禦值） */
	input: unknown
	/** splitTags 的切割結果 */
	result: ITagSegment[]
}

/**
 * splitTags → splitByPeriod 串接管線快照（runSplitTagsTests，splitByPeriod 非 null）。
 * 管線時 splitTags 的結果改以 splitTagsResult 命名，並額外記錄管線階段。
 */
export interface ISplitTagsPipelineSnap extends IOriginalComparisonSnap {
	/** 傳入 splitTags 的輸入 */
	input: unknown
	/** 第一階段（splitTags）的切割結果 */
	splitTagsResult: ITagSegment[]
	/** splitByPeriod 是否改變了 splitTags 的輸出 */
	splitByPeriodChanged: boolean
	/** 僅在 splitByPeriodChanged=true 時寫入的管線最終結果 */
	splitByPeriodResult?: ITagSegment[]
}

/** updatePrompt 快照的 args 區塊（固定為布林三元組，便於跨案例對照）。 */
export interface IUpdatePromptSnapArgs {
	/** BREAK 前補換行（未傳時以 false 落盤） */
	autoBreakBeforeWrap: boolean
	/** BREAK 後補換行（未傳時以 false 落盤） */
	autoBreakAfterWrap: boolean
	/** 是否注入真 genPrompt（個別測試為 false，複合測試為 true） */
	usesRealGenPrompt: boolean
}

/**
 * updatePrompt 的快照（runUpdatePromptTests）。
 * 被測函式無回傳值，故以宿主替身收集的執行摘要落盤。
 */
export interface IUpdatePromptSnap {
	/** 案例持有的標籤陣列（tc.tags） */
	input: readonly IGenPromptTag[]
	/** 執行時的選項（預設值已補齊，未傳者為 false） */
	args: IUpdatePromptSnapArgs
	/** 宿主 appendTag 收到的參數（依呼叫順序） */
	appended: IUpdatePromptAppendRecord[]
	/** refresh 呼叫次數 */
	refreshCount: number
	/** commit 收到的 prompt（未提交時為空陣列） */
	committed: string[]
}
