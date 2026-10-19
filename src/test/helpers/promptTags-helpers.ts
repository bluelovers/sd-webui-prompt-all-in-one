import type { IGenPromptTag } from '../../src/utils/promptTags/genPrompt'
import { updatePrompt as updatePromptCore } from '../../src/utils/promptTags/updatePrompt'
import type { IUpdatePromptHost } from '../../src/utils/promptTags/updatePrompt'
import type {
	IUpdatePromptAppendRecord,
	IUpdatePromptHostOptions,
	IUpdatePromptSummary,
	IUpdatePromptTestsOptions,
} from './types/node-test-case-types'
import { EnumPromptPlaceholder, type IUpdatePromptSnap } from './types/snap-types'
import { caseTitle, forEachCase } from './node-test-helpers'

/**
 * 建立 updatePrompt 的宿主替身。
 *
 * 元件的 updatePrompt() 只負責編排，實際行為（插入標籤、重新整理、
 * 產生 prompt、提交結果）全由宿主注入。此函式以最小替身實作同一份介面：
 *   - appendTag 依 index splice（對應 _appendTag 的插入語意，空值直接忽略）
 *   - refresh   對應 updateTags()，可選擇重入 updatePrompt 模擬遞迴
 *   - genPrompt 對應 this.genPrompt()，可注入被抽出的真函式
 *   - commit    對應寫入 this.prompt / textarea 的那段程式
 *
 * @param opts - 見 IUpdatePromptHostOptions
 * @returns {{ host: object, summary: IUpdatePromptSummary }} 宿主與執行摘要
 */
export function createUpdatePromptHost({
	tags,
	autoBreakBeforeWrap,
	autoBreakAfterWrap,
	genPrompt = null,
	reenter = false,
}: IUpdatePromptHostOptions): { host: IUpdatePromptHost, summary: IUpdatePromptSummary } {
	const workingTags: IGenPromptTag[] = tags.map(tag => ({ ...tag }))
	const appended: IUpdatePromptAppendRecord[] = []
	const summary: IUpdatePromptSummary = {
		appended,
		refreshCount: 0,
		genPromptCount: 0,
		committed: [],
		tags: workingTags,
	}

	const host = {
		tags: workingTags,
		autoBreakBeforeWrap,
		autoBreakAfterWrap,
		appendTag(value: string, localValue: string, disabled: boolean, index: number, type: string) {
			appended.push({ value, localValue, disabled, index, type })
			/** 與 _appendTag 一致：空值不建立標籤 */
			if (value === '') return
			workingTags.splice(index, 0, { type, value, localValue, disabled })
		},
		refresh() {
			summary.refreshCount++
			if (reenter) updatePromptCore(host)
		},
		genPrompt() {
			summary.genPromptCount++
			/**
			 * 未注入真 genPrompt 時回傳 EnumPromptPlaceholder.GenPrompt（刻意非空）。
			 *
			 * 為何不回傳 ''：updatePrompt 在無插入時會 commit(host.genPrompt())，
			 * 回傳空字串會讓 commit 變成「有提交但內容為空」，與「未提交」難以區分。
			 * 回傳可辨識的佔位字串，快照的 committed 就會明確出現該佔位值，
			 * 讀者一眼可辨「此案例走的是宿主替身、非真組字邏輯」。
			 * 對照欄位：快照 args.usesRealGenPrompt=false 即代表使用此佔位
			 * （見 helpers/types/snap-types.IUpdatePromptSnapArgs）。
			 * 值本身定義於 EnumPromptPlaceholder（見 helpers/types/snap-types），
			 * 與各 fixture 的 expectedPrompt 共用同一份。
			 */
			return genPrompt ? genPrompt(workingTags) : EnumPromptPlaceholder.GenPrompt
		},
		commit(prompt: string) {
			summary.committed.push(prompt)
		},
	}

	return { host, summary }
}

/**
 * 執行一組 updatePrompt 測試案例。
 *
 * 與 runSplitTagsTests 相同的做法：被測函式由呼叫端注入，
 * 這裡只負責「建立宿主替身 → 執行 → 對照期望 → 組裝快照」。
 *
 * 流程：
 *   Step 1  建立宿主替身（見本檔 createUpdatePromptHost）
 *   Step 2  執行 updatePrompt
 *   Step 3  對照期望（expectedWrapCount / expectedPrompt，或案例自訂 assert）
 *   Step 4  組裝快照 { input, appended, refreshCount, committed }
 *
 * @param {Object}   opts
 * @param {Object[]} opts.cases        - 測試案例陣列
 * @param {Function} opts.updatePrompt - 被測的 updatePrompt
 * @param {Function|null} [opts.genPrompt] - 注入真 genPrompt（複合測試）；不傳時以替身取代
 * @param {boolean}  [opts.reenter=false]  - refresh 時重入 updatePrompt（模擬元件遞迴）
 */
export function runUpdatePromptTests({
	cases,
	updatePrompt,
	genPrompt = null,
	reenter = false,
}: IUpdatePromptTestsOptions): void {
    /** 註冊骨架與 skip 處理共用 forEachCase（見 helpers/node-test-helpers.forEachCase） */
    forEachCase(
        cases,
        /** 案例以 tags 描述輸入，這裡補上 input 供 caseTitle 產生可讀標題 */
        tc => caseTitle({ ...tc, input: tc.tags }),
        (tc, t) => {
            /** Step 1: 建立宿主替身 */
            const { host, summary } = createUpdatePromptHost({
                tags: tc.tags,
                autoBreakBeforeWrap: tc.autoBreakBeforeWrap,
                autoBreakAfterWrap: tc.autoBreakAfterWrap,
                genPrompt: genPrompt
                    ? () => genPrompt(host.tags, false, tc.genPromptOptions)
                    : null,
                reenter,
            })

            /** Step 2: 執行 */
            updatePrompt(host)

            /** Step 3: 對照期望 */
            if (tc.assert) {
                tc.assert(summary, t)
            } else {
                if (tc.expectedWrapCount !== undefined) {
                    t.assert.equal(summary.appended.length, tc.expectedWrapCount,
                        `插入的換行數量不符：expected=${tc.expectedWrapCount}, actual=${summary.appended.length}`,
                    )
                }
                if (tc.expectedPrompt !== undefined) {
                    const expectedCommitted = tc.expectedPrompt == null ? [] : [tc.expectedPrompt]
                    t.assert.deepEqual(summary.committed, expectedCommitted,
                        `提交的 prompt 不符：expected=${JSON.stringify(expectedCommitted)}, actual=${JSON.stringify(summary.committed)}`,
                    )
                }
            }

            /** Step 4: 組裝快照（key 順序與既有 .snapshot 一致，不可隨意重排） */
            const snap: IUpdatePromptSnap = {
                input: tc.tags,
                args: {
                    autoBreakBeforeWrap: tc.autoBreakBeforeWrap ?? false,
                    autoBreakAfterWrap: tc.autoBreakAfterWrap ?? false,
                    usesRealGenPrompt: !!genPrompt,
                },
                appended: summary.appended,
                refreshCount: summary.refreshCount,
                committed: summary.committed,
            }
            t.assert.snapshot(snap)
        },
    )
}
