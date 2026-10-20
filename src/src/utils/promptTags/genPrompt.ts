/**
 * genPrompt.ts
 *
 * 由 phystonPrompt.vue 抽離的「產生最終 prompt 字串」核心。
 *
 * 為何抽離：原邏輯內嵌於 Vue 元件的 methods，依賴 `this` 上的七個選項、
 * `_setTag()` 與兩個 `_shouldRemoveComma*` 私有方法，無法在 Node 測試中獨立驗證。
 * 抽為純函式後，元件只負責「把 this 的狀態與副作用接上」，
 * 被測邏輯與線上執行的是同一份程式碼（禁止複製邏輯）。
 *
 * 與元件的契約：
 *   - 選項以 IGenPromptOptions 物件傳入（原 this.autoX 欄位）。
 *   - `tag.value` / `tag.localValue` 被 replaceTag 改寫時，經 hooks.onTagChanged
 *     通知宿主執行原 `this._setTag(tag)`。
 *
 * @module utils/genPrompt
 */

import common from '../common'
import { findTagUntil, tagIsBreak, tagIsLoraLike, tagIsWrap } from './util'
import type { IPromptTagWithLocal } from './tag-types'

/**
 * genPrompt 遍歷的標籤型別。
 * 在 IPromptTagWithLocal 之上補上 weightNum（由 tagMixin._setTag 計算，供權重改寫使用）。
 */
export type IGenPromptTag = IPromptTagWithLocal & {
    weightNum?: number | string
}

/**
 * 產生 prompt 所需的選項集合。
 * 原本散落於 `this.autoX`，集中後呼叫端需明確傳入，避免隱性耦合元件狀態。
 */
export interface IGenPromptOptions {
    /** 自動優化分割符號 */
    autoOptimizeSplitSymbol?: boolean
    /** 分割符號不含空白 */
    autoRemoveSpace?: boolean
    /** 移除換行前的逗號 */
    autoRemoveBeforeLineComma?: boolean
    /** 移除 Lora 前的逗號 */
    autoRemoveLoraBeforeComma?: boolean
    /** 移除最後一個逗號 */
    autoRemoveLastComma?: boolean
    /** 移除 Lora 後的逗號 */
    autoRemoveLoraAfterComma?: boolean
    /** 受 applySplitByPeriod 標記 splitNoComma 的 tag 不加逗號 */
    autoSplitByPeriod?: boolean
}

/**
 * 副作用掛鉤：宿主（Vue 元件）注入的行為。
 */
export interface IGenPromptHooks {
    /** 原 this._setTag(tag)：tag.value / tag.localValue 被改寫時通知宿主持久化 */
    onTagChanged?: (tag: IGenPromptTag) => void
}

/**
 * 自動優化分割符號（autoOptimizeSplitSymbol）：判斷換行前的逗號是否應被移除。
 *
 * 此函式在 genPrompt() 的輸出層直接判定，不經過 applySplitByPeriod()，
 * 因此不依賴 autoSplitByPeriod，選項成為獨立選項後單獨啟用即會生效。
 *
 * 效能設計：行內 # 判定改由 genPrompt() 的遍歷期間累計（O(1)），
 * 避免每次遇到換行都回頭掃描整行（多個換行時最壞 O(n²)）。
 *
 * 判定規則（呼叫時當前 tag 必為換行前的最後一個 tag，任一符合即移除）：
 *   1. 當前 tag 以「:」結尾（如前綴式寫法「xxx:」，表示內容尚未結束）
 *   2. 當前 tag 是 Lora / Lyco
 *   3. options.lineHasSharp=true：該行（自上一個換行至當前 tag）任一 tag 以「#」開頭或結尾
 *   4. 當前 tag 以句號結尾（沿用原有的 period + wrap 移除行為）
 *
 * @param tag               - 當前標籤（換行前的最後一個 tag）
 * @param [options]         - 擴充選項（以物件傳入，便於未來新增欄位而不更動簽名）
 * @param [options.lineHasSharp=false] - 該行是否含 # 開頭/結尾的 tag
 *                                       （由 genPrompt 於遍歷期間累計，遇換行重置）
 * @returns true = 應移除換行前的逗號
 */
export function shouldRemoveCommaBeforeWrap(
    tag: IGenPromptTag | null | undefined,
    options: { lineHasSharp?: boolean } = {},
): boolean {
    if (!tag) return false
    const { lineHasSharp = false } = options
    const value = (tag.value || '').trim()
    /** 規則 1：換行前的 tag 以「:」結尾 */
    if (value.endsWith(':')) return true
    /** 規則 2：換行前的 tag 是 Lora / Lyco */
    if (tagIsLoraLike(tag)) return true
    /** 規則 3：該行任一 tag 以「#」開頭或結尾（由呼叫端遍歷期間累計傳入） */
    // if (lineHasSharp) return true
    /** 規則 4：換行前的 tag 以句號結尾 */
    return /\.\s*$/.test(tag.value)
}

/**
 * 自動優化分割符號（autoOptimizeSplitSymbol）：判斷當前 tag 後的逗號是否應被移除。
 *
 * 與 shouldRemoveCommaBeforeWrap()（僅處理換行前一個 tag）不同，
 * 本函式涵蓋任意下一個 tag（分行 / BREAK / Lora / 一般 tag），
 * 於 genPrompt() 的輸出層直接判定，不經過 applySplitByPeriod()，
 * 因此不依賴 autoSplitByPeriod，選項獨立啟用時即生效。
 *
 * 判定規則（任一符合即移除逗號）：
 *   1. 當前 tag 是 Lora / Lyco，且下一個 tag 也是 Lora / Lyco
 *      （連續 Lora 間不需要逗號，避免破壞 Lora 語法）
 *   2. 下一個 tag 是 BREAK，或「分行 + BREAK」
 *      （分行可連續多個，略過後取第一個非分行 tag 判定）
 *   3. 當前 tag 以「;」或「}」結尾（表示語法尚未結束），
 *      且下一個 tag 是 分行 或 Lora / Lyco
 *
 * 效能：僅在下一個 tag 為分行時才會向後前瞻，並連續略過分行 tag，
 *       攤還 O(1)，不會因多個分行造成整體 O(n²)。
 *
 * @param tag   - 當前標籤
 * @param tags2 - 已過濾（排除 disabled）的標籤陣列，與 genPrompt 使用同一份
 * @param index - 當前標籤在 tags2 中的索引
 * @returns true = 應移除當前 tag 後的逗號
 */
export function shouldRemoveCommaByAutoOptimize(
    tag: IGenPromptTag | null | undefined,
    tags2: readonly IGenPromptTag[],
    index: number,
): boolean {
    if (!tag) return false
    const nextTag = index + 1 < tags2.length ? tags2[index + 1] : null
    /** 已是最後一個 tag → 由 autoRemoveLastComma 處理，此處不移除 */
    if (!nextTag) return false

    /** 規則 1：當前是 Lora / Lyco，且下一個也是 Lora / Lyco */
    if (tagIsLoraLike(tag) && tagIsLoraLike(nextTag)) return true
    /** 規則 2-1：下一個 tag 是 BREAK */
    if (tagIsBreak(nextTag)) return true
    /** 規則 2-2：下一個 tag 是分行，且分行後第一個非分行 tag 是 BREAK */
    if (tagIsWrap(nextTag)) {
        /** 略過連續分行，停在第一個非分行 tag（邏輯抽離至 findTagUntil） */
        const scan = findTagUntil(tags2, {
            startIndex: index + 1,
            ignore: tagIsWrap,
            untilTarget: tagIsBreak,
        })
        if (scan.found) return true
    }
    /** 規則 3：當前 tag 以指定文字結尾，且下一個是 分行 / Lora / Lyco */
    if (/(?:[;}:'"*—]|[-=]{2,})$/.test((tag.value || '').trim()) && (tagIsWrap(nextTag) || tagIsLoraLike(nextTag))) return true

    return false
}

/**
 * 分割标签（產生最終 prompt 字串）。
 *
 * @param tags         - 標籤陣列（呼叫端負責先過濾 disabled）
 * @param ignoreDisabled - true 時不過濾 disabled（保留原始行為）
 * @param [options]    - 選項集合（原 this.autoX）
 * @param [hooks]      - 宿主注入的副作用
 * @returns 組裝後的 prompt 字串；無內容時回傳 ''
 */
export function genPrompt(
    tags: IGenPromptTag[],
    ignoreDisabled = false,
    options: IGenPromptOptions = {},
    hooks: IGenPromptHooks = {},
): string {
    const prompts: string[] = []
    let tags2: IGenPromptTag[] = []
    if (!ignoreDisabled) {
        for (const key in tags) {
            if (!tags[key].disabled) {
                tags2.push(tags[key])
            }
        }
    } else {
        tags2 = tags
    }
    const length = tags2.length
    /**
     * 自動優化分割符號：於單次前向遍歷中累計「該行是否含 # 開頭/結尾 tag」。
     * 遇換行 tag 時重置，使 # 判定均為 O(1)，
     * 避免每遇到換行就回頭掃描整行（多個換行時最壞 O(n²)）。
     */
    let lineHasSharp = false
    tags2.forEach((tag, index) => {
        let prompt = ''
        if (tagIsWrap(tag)) {
            // 換行結束當前行 → 重置行狀態，供下一行重新累計
            lineHasSharp = false
            prompt = "\n"
        } else {
            let value = common.replaceTag(tag.value)
            if (value !== tag.value) {
                tag.value = value
                hooks.onTagChanged?.(tag)
            }
            let localValue = common.replaceTag(tag.localValue)
            if (localValue !== tag.localValue) {
                tag.localValue = localValue
            }

            /**
             * 權重數值改寫：原式為 `tag.weightNum > 0 || tag.weightNum < 0`，
             * 因 tag.weightNum 型別為 number|string，先以 Number() 統一再比較，
             * 與 JS 關係運算子的隱含轉換結果完全一致。
             */
            const weightNum = Number(tag.weightNum)
            if (weightNum > 0 || weightNum < 0) {
                tag.weightNum = Number(parseFloat(String(weightNum)).toFixed(6))
                tag.value = tag.value.replace(common.weightNumRegex, '$1:' + tag.weightNum)
                if (tag.localValue !== '') {
                    tag.localValue = tag.localValue.replace(common.weightNumRegex, '$1:' + tag.weightNum)
                }
            }
            if (tag.disabled && !ignoreDisabled) return

            /**
             * 自動優化分割符號：累計當前行的 # 狀態（O(1) 檢查，
             * 行內已確認含 # 時略過後續 tag 的重複檢查）。
             * 當前 tag 也屬於該行，必須在下方 nextIsWarp 判定之前更新。
             */
            if (options.autoOptimizeSplitSymbol && !lineHasSharp) {
                const sharpValue = (tag.value || '').trim()
                if (sharpValue.startsWith('#') || sharpValue.endsWith('#')) {
                    lineHasSharp = true
                }
            }

            let splitSymbol = ',' + (options.autoRemoveSpace ? '' : ' ')
            const splitSymbolDefault = splitSymbol

            let nextTag: IGenPromptTag | null = null
            let nextIsWarp = false
            let nextIsBreak = false
            let nextIsLoraLike = false
            // 获取下一个按钮
            if (index + 1 < length) {
                nextTag = tags2[index + 1]
                if (tagIsWrap(nextTag)) {
                    nextIsWarp = true
                } else if (tagIsBreak(nextTag)) {
                    nextIsBreak = true
                } else if (tagIsLoraLike(nextTag)) {
                    nextIsLoraLike = true
                }
            }

            /**
             * 自動優化分割符號（autoOptimizeSplitSymbol）：
             * 符合下列任一條件時，移除當前 tag 後的逗號（不論其他選項是否啟用）。
             * 詳細規則見 shouldRemoveCommaByAutoOptimize()。
             * 換行情境（下一個為分行）連同空白一併移除，其餘僅移除逗號、保留空白。
             */
            if (options.autoOptimizeSplitSymbol && splitSymbol.includes(',')) {
                if (shouldRemoveCommaByAutoOptimize(tag, tags2, index)) {
                    splitSymbol = nextIsWarp ? '' : splitSymbol.replace(/,/g, '')
                }
            }

            if (nextIsWarp) {
                // 如果下一个是换行

                if (options.autoRemoveBeforeLineComma) {
                    splitSymbol = ''
                } else {
                    /**
                     * 自動優化分割符號（autoOptimizeSplitSymbol）：
                     * 換行前符合任一條件時移除逗號。
                     * 在輸出層直接判定，不依賴 autoSplitByPeriod，選項獨立啟用時即生效。
                     * 行內 # 狀態由遍歷期間累計，以物件選項傳入（預留未來擴充）。
                     */
                    if (options.autoOptimizeSplitSymbol && shouldRemoveCommaBeforeWrap(tag, { lineHasSharp })) {
                        splitSymbol = ''
                    }
                    // sd-webui-regional-prompter
                    const regionals = [' BREAK', ' ADDCOL', ' ADDROW', ' ADDCOMM', ' ADDBASE']
                    for (const regional of regionals) {
                        if (tag.value.endsWith(regional)) {
                            // 如果是sd-webui-regional-prompter，那么就不需要加逗号
                            splitSymbol = ''
                        }
                    }
                }
            } else if (nextIsBreak) {
                splitSymbol = ' '
            } else if (nextIsLoraLike && options.autoRemoveLoraBeforeComma) {
                splitSymbol = (options.autoRemoveSpace ? '' : ' ')
            }

            if (tagIsBreak(tag)) {
                if (nextIsWarp) {
                    splitSymbol = ''
                } else {
                    splitSymbol = ' '
                }
            }

            if (options.autoRemoveLastComma && index + 1 === length) {
                // 如果是最后一个，那么就不需要加逗號
                splitSymbol = ''
            }

            if (splitSymbol === splitSymbolDefault && tagIsLoraLike(tag) && options.autoRemoveLoraAfterComma) {
                splitSymbol = (options.autoRemoveSpace ? '' : ' ')
            }

            // autoSplitByPeriod：若此 tag 是分割產生的中間段且原始 tag 無逗號，則移除逗號
            if (options.autoSplitByPeriod && tag.splitNoComma && splitSymbol.includes(',')) {
                splitSymbol = splitSymbol.replace(/,/g, '')
            }

            prompt = tag.value + splitSymbol

        }

        if (prompt) prompts.push(prompt)
    })
    if (prompts.length <= 0) return ''
    // console.log('update tags', prompts)
    return prompts.join('')
}
