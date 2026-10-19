
import { describe, it } from 'node:test'
import type { TestContext } from 'node:test'
import crypto from 'node:crypto'
import type { ITagSegment } from '../../src/utils/splitTags'
import type {
    IOriginalComparisonSnap,
    IRunCasesSnap,
    ISplitTagsPipelineSnap,
    ISplitTagsSnap,
} from './types/snap-types'
import type {
    IRunCase,
    IRunCasesOptions,
    ISplitTagsFn,
    ISplitTagsPipelineCase,
    ISplitTagsTestsOptions,
} from './types/node-test-case-types'

/** caseTitle / compareWithOriginal 需要的最小案例形狀（各類案例皆滿足）。 */
interface ICaseBare {
    input: unknown
    args?: unknown[]
    note?: string
}

/**
 * 截斷字串並以 "…" 結尾（共用工具）。
 */
export function truncate(str: string, maxLen = 60): string {
    if (str.length <= maxLen) return str
    return str.slice(0, maxLen) + '…'
}

/**
 * 將輸入值字串化為可讀的展示字串：JSON.stringify（精確轉義引號/控制字元）+ 超長截斷。
 * 例：
 *   a. b. c                          → "a. b. c"
 *   with "Small joys." below.        → "with \"Small joys.\" below."（引號正確轉義）
 *   a<newline>b                      → "a\nb"
 */
export function formatTitle(input: unknown, maxLen = 60): string {
    const notString = typeof input !== 'string'
    const raw = notString ? String(input) : input

    let result = truncate(raw, maxLen)

    if (notString && result.length === raw.length) {
        result = input
    }

    return JSON.stringify(result)
}

/**
 * 產生測試標題 — splitTags 與 splitByPeriod 共用（單一事實來源）。
 *
 * 規則：
 *   - 字串輸入 + 有 note ：「note — [sha256前8碼] "引號包裹值"」（note、hash、值完整呈現）
 *   - 字串輸入 + 無 note ：「[sha256前8碼] "引號包裹值"」
 *   - 非字串輸入        ：note，無 note 時以 formatTitle 呈現值
 *   - 有 args 時附加「 ({...})」後綴（同輸入不同參數時避免標題碰撞）
 *
 */
export function caseTitle(tc: ICaseBare): string {
    let title: string
    if (typeof tc.input === 'string') {
        const identified = `[${promptHash(tc.input)}] ${formatTitle(tc.input)}`
        title = tc.note ? `${tc.note} — ${identified}` : identified
    } else {
        title = tc.note || formatTitle(tc.input)
    }
    if (tc.args !== undefined && tc.args.length > 0) {
        const args = tc.args.map(a => typeof a === 'object' && a !== null
            ? `{${Object.entries(a).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')}}`
            : JSON.stringify(a)
        ).join(', ')
        title += ` (${args})`
    }
    return title
}

/**
 * 執行一組 data-driven 的測試案例。
 *
 * @example
 *   // 直接傳入已載入的函式
 *   runCases('basic', myFn, [
 *     { input: 'a. b. c', expected: ['a.', 'b.', 'c'] },
 *   ])
 *
 *   // 啟用快照
 *   runCases('basic', myFn, [ ... ], { snapshot: true })
 *
 *   // 傳入 factory function（lazy import）
 *   runCases('basic', () => import('./myModule.js').then(m => m.default), [
 *     { input: 'a. b. c', expected: ['a.', 'b.', 'c'] },
 *   ])
 */
export function runCases<TInput, TArgs extends unknown[], TResult>(
    suiteName: string,
    fn: (input: TInput, ...args: TArgs) => TResult | Promise<TResult>,
    cases: readonly IRunCase<TInput, TArgs, TResult>[],
    options: IRunCasesOptions = {},
): void {
    /** snapshot: true 時額外寫入快照 { input, args?, result }（與 splitTags 同格式） */
    const { snapshot = false } = options
    describe(suiteName, async () => {
        for (const tc of cases) {
            const title = caseTitle(tc)
            /** 獨立成 const，無法從 it() 取得 t 的 contextually-typed，故明確標註 TestContext */
            const handler = async (t: TestContext) => {
                /** args 為空時展開空陣列：等價於「不傳額外參數」 */
                const result = await fn(tc.input, ...(tc.args ?? ([] as unknown as TArgs)))
                if (snapshot) {
                    /** key 順序 input → args? → result 會被序列化到 .snapshot，須與既有快照一致 */
                    const snap: IRunCasesSnap<TInput, TArgs, TResult> = tc.args !== undefined
                        ? { input: tc.input, args: tc.args, result }
                        : { input: tc.input, result }
                    t.assert.snapshot(snap)
                }
                if (tc.assert) {
                    tc.assert(result)
                } else {
                    t.assert.deepEqual(result, tc.expected)
                }
            }
            if (tc.skip) {
                it.skip(title, handler)
            } else {
                it(title, handler)
            }
        }
    })
}

/**
 * 執行一組 splitTags 測試案例（可選接上 splitByPeriod 管線）。
 *
 * 單一事實來源：splitTags 單獨測試、splitTags → splitByPeriod 管線測試、
 * 管線專屬測試與 issues 回歸測試共用此函式，
 * 差別僅在 splitByPeriod 是否為 null，以及案例上帶的斷言欄位。
 *
 * 流程：
 *   Step 1    splitTags 切割
 *   Step 1.5  可選 — 案例級 assertResult（splitTags 中間結果斷言）
 *   Step 2    可選 — splitByPeriod 管線
 *   Step 2.5  可選 — 案例級 assertPipeline（管線最終結果斷言，驗證兩階段合計的不變式）
 *   Step 3    與原版比較
 *   Step 4    組裝快照
 */
export function runSplitTagsTests({
    cases,
    splitTags,
    originalFn,
    splitByPeriod,
}: ISplitTagsTestsOptions): void {
    for (const tc of cases) {
        const title = caseTitle(tc)
        it(title, (t) => {
            /** Step 1: splitTags 切割 */
            const tagResult: ITagSegment[] = splitTags(tc.input, ...(tc.args ?? []))

            /** Step 1.5: 可選 — 自訂斷言（issues 回歸案例的雙保險，獨立於快照之外） */
            if (tc.assertResult) tc.assertResult(tagResult, t)

            /** Step 2: 可選 — splitByPeriod 管線 */
            let finalResult: ITagSegment[] = tagResult
            let changed = false
            if (splitByPeriod) {
                finalResult = tagResult.flatMap(tag => splitByPeriod(tag, tc.splitByPeriodOptions))
                changed = JSON.stringify(tagResult) !== JSON.stringify(finalResult)

                if (tc.expectChanged !== undefined) {
                    t.assert.equal(changed, tc.expectChanged)
                }

                if (changed) {
                    console.log(`  ⚠ splitByPeriodChanged: true  (${tagResult.length} → ${finalResult.length} segments)`)
                } else {
                    console.log(`  ✓ splitByPeriodChanged: false`)
                }
            }

            /** Step 2.5: 可選 — 管線最終結果的自訂斷言（不變式，獨立於快照之外） */
            if (tc.assertPipeline) tc.assertPipeline(finalResult, t, tc)

            /** Step 3: 與原版比較 */
            const { changedFromOriginal, originalResult } = compareWithOriginal(originalFn, tc, tagResult)

            if (tc.expectOriginalChanged !== undefined) {
                t.assert.equal(changedFromOriginal, tc.expectOriginalChanged)
            }

            /** Step 4: 組裝快照（key 順序與既有 .snapshot 一致，不可隨意重排） */
            let snap: ISplitTagsPipelineSnap | ISplitTagsSnap
            if (splitByPeriod) {
                const pipelineSnap: ISplitTagsPipelineSnap = {
                    input: tc.input,
                    splitTagsResult: tagResult,
                    splitByPeriodChanged: changed,
                }
                if (changed) pipelineSnap.splitByPeriodResult = finalResult
                snap = pipelineSnap
            } else {
                snap = { input: tc.input, result: tagResult }
            }

            attachOriginalComparison(snap, changedFromOriginal, originalResult)
            t.assert.snapshot(snap)
        })
    }
}

/**
 * 將新舊版函式結果進行比較。
 */
export function compareWithOriginal(
    originalFn: ISplitTagsFn | null,
    tc: ISplitTagsPipelineCase,
    result: ITagSegment[],
): { changedFromOriginal: boolean | null, originalResult: ITagSegment[] | null } {
    if (!originalFn) return { changedFromOriginal: null, originalResult: null }
    const originalResult = originalFn(tc.input, ...(tc.args ?? []))
    const changedFromOriginal = JSON.stringify(result) !== JSON.stringify(originalResult)
    return { changedFromOriginal, originalResult }
}

/**
 * 將原版比較結果附加到快照物件。
 * changedFromOriginal=true 時同時附加 originalResult。
 *
 * @param snap                  - 快照物件（會被 mutate）
 * @param changedFromOriginal
 * @param originalResult
 */
export function attachOriginalComparison(
    snap: IOriginalComparisonSnap,
    changedFromOriginal: boolean | null,
    originalResult: ITagSegment[] | null,
): void {
    if (changedFromOriginal === null) return
    snap.changedFromOriginal = changedFromOriginal
    if (changedFromOriginal) snap.originalResult = originalResult
}

/**
 * 產生輸入字串的短期雜湊（前 8 碼 hex），用於長輸入的快照標題。
 */
export function promptHash(str: string): string {
    return crypto.createHash('sha256').update(str).digest('hex').slice(0, 8)
}
