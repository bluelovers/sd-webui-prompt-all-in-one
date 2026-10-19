
import type { TestContext } from 'node:test'
import type {
	ISplitTagsInput,
	ISplitTagsOptions,
	ITagSegment,
} from '../../src/utils/splitTags'
import type {
	ISplitByPeriodOptions,
	IPeriodPart,
} from '../../src/utils/splitByPeriod'

/**
 * splitTags 的額外參數 tuple。
 * 與 splitTags(tags, autoBreakBeforeWrap, autoBreakAfterWrap, options) 對應。
 */
export type ISplitTagsArgs = [
	autoBreakBeforeWrap?: boolean,
	autoBreakAfterWrap?: boolean,
	options?: ISplitTagsOptions,
]

/**
 * splitByPeriod 的額外參數 tuple。
 * 與 splitByPeriod(str, options) 對應。
 */
export type ISplitByPeriodArgs = [
	options?: ISplitByPeriodOptions,
]

/**
 * splitByPeriod 單獨測試案例。
 * 格式與 fixture/data-splitByPeriod.ts 表頭說明一致。
 */
export interface ISplitByPeriodCase {
	/** 傳入 splitByPeriod 的第一個參數 */
	input: unknown
	/** 額外參數陣列（會 spread 到 splitByPeriod(input, ...args)） */
	args?: ISplitByPeriodArgs
	/** 期望回傳值（與 assert 二選一） */
	expected?: IPeriodPart[]
	/** 附加說明（顯示在測試標題中） */
	note?: string
	/** 自訂斷言 fn(result)，若有則取代 expected */
	assert?: (result: IPeriodPart[]) => void
	/** true 時跳過此案例 */
	skip?: boolean
}

/**
 * splitTags 測試案例。
 * 格式與 fixture/data-splitTags.ts 表頭說明一致。
 */
export interface ISplitTagsCase {
	/** 傳入 splitTags 的第一個參數（非字串防禦值亦可） */
	input: ISplitTagsInput
	/** 額外參數陣列 [autoBreakBeforeWrap, autoBreakAfterWrap, options] */
	args?: ISplitTagsArgs
	/** 附加說明（顯示在測試標題中） */
	note?: string
	/** 期望與 splitTags_original 的結果是否有差異 */
	expectOriginalChanged?: boolean
	/** 自訂斷言 fn(tagResult, t)——除快照外再鎖定關鍵行為 */
	assertResult?: (tagResult: ITagSegment[], t: TestContext) => void
}

/**
 * splitTags → splitByPeriod 串接管線案例。
 * 在 ISplitTagsCase 之上追加管線階段的欄位。
 */
export interface ISplitTagsPipelineCase extends ISplitTagsCase {
	/** 逐 tag 傳入 splitByPeriod 的選項 */
	splitByPeriodOptions?: ISplitByPeriodOptions
	/** 期望 splitByPeriod 是否改變了 splitTags 的輸出 */
	expectChanged?: boolean
	/**
	 * 管線最終結果的自訂斷言 fn(finalResult, t, tc)。
	 * 與 assertResult 的差異：拿到的是 splitByPeriod 之後的最終陣列，
	 * 可驗證「兩階段合計」的不變式（如分隔符數量守恆）。
	 */
	assertPipeline?: (finalResult: ITagSegment[], t: TestContext, tc: ISplitTagsPipelineCase) => void
}
