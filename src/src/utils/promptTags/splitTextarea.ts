/**
 * 輸入框文字變動時的標籤切割與重建核心。
 *
 * 把輸入框內容解析為標籤陣列：
 * 以 splitTags 切割文字、
 * 把停用中的標籤依原位置插回，
 * 再逐段還原為 tag 物件。
 *
 * 輸入框 DOM 檢查（自動完成面板是否顯示）、翻譯與 refresh 由呼叫端接線，
 * 本模組只負責解析與重建。
 */

import { splitTags } from '../splitTags'
import type { IHostPromptOptions } from './types'
import type { IPromptTag, IPromptTagValue } from './tag-types'

/** 重建結果 */
export interface ISplitTextareaResult {
    /** 是否完成重建；false 表示輸入與當前 prompt 相同，未寫入任何標籤 */
    changed: boolean
    /** 本次新建（非還原舊屬性）的標籤索引，供翻譯流程使用 */
    newTagIndexes: number[]
}

/** 宿主（Vue 元件）注入的輸入與重建行為 */
export interface ISplitTextareaHost {
    /** 輸入框目前文字，核心內自行 trim */
    value: string
    /** 當前 prompt；與 value 相同時不重建 */
    prompt: string
    /** 切割與解析選項，呼叫端可直接傳元件 this */
    options: IHostPromptOptions
    /** 重建前的標籤：作為停用標籤的索引來源與舊屬性比對來源 */
    tags: readonly IPromptTag[]
    /** splitTags 的 JSON 防護回呼（輸入為合法 {} JSON 時通知呼叫端） */
    onJsonIgnored?: (text: string) => void
    /** 清空標籤陣列，作為重建起點 */
    clearTags: () => void
    /** 建立換行標籤（value 為 "\\n" 的段落） */
    appendWrapTag: () => void
    /** 依舊標籤還原屬性建立新標籤；source 為 null 時視為全新建立 */
    restoreTag: (value: IPromptTagValue, source: IPromptTag | null) => number
    /** 重建後同步句號分割（autoSplitByPeriod） */
    applySplitByPeriod?: () => void
}

/**
 * 解析輸入框文字並重建標籤陣列。
 *
 * 停用中的標籤不在輸入框文字內，需依其原索引插回切割結果，
 * 否則重建後會消失或位置漂移。
 * 其餘段落以舊標籤比對來源還原 localValue / disabled / 自訂屬性；
 * 比對不到者視為新建。
 *
 * @param host - 宿主注入的輸入、選項與重建行為
 * @returns 重建結果；changed 為 false 時呼叫端應略過後續刷新
 */
export function splitTextareaCore(host: ISplitTextareaHost): ISplitTextareaResult {
    const value = host.value.trim()
    /**
     * 輸入未變動：textarea 內容與當前 prompt 一致時重建只會產生
     * 相同標籤並觸發多餘的 refresh，直接略過。
     */
    if (value === host.prompt.trim()) {
        return { changed: false, newTagIndexes: [] }
    }

    const tagValues = splitTags(
        value,
        host.options.autoBreakBeforeWrap,
        host.options.autoBreakAfterWrap,
        host.options,
        { onJsonIgnored: host.onJsonIgnored },
    )

    /**
     * 停用標籤不會出現在輸入框文字中，依其在舊標籤陣列的索引
     * 插回切割結果，維持原本的相對位置。
     */
    const disabledTags: { tag: IPromptTag; index: number }[] = []
    host.tags.forEach((tag, index) => {
        if (tag.disabled) disabledTags.push({ tag, index })
    })
    disabledTags.forEach(({ tag, index }) => {
        tagValues.splice(index, 0, tag.value)
    })

    const oldTags = host.tags
    host.clearTags()

    /** 新建（非還原）的標籤索引，交給呼叫端決定是否翻譯 */
    const newTagIndexes: number[] = []
    for (const tagValue of tagValues) {
        if (tagValue === "\n") {
            host.appendWrapTag()
            continue
        }
        // if (tagValue.indexOf('Negative prompt:') === 0) break
        /** 以 value 比對舊標籤，命中即以該標籤為來源還原屬性 */
        let find: IPromptTag | null = null
        for (const item of oldTags) {
            if (item.value === tagValue) {
                find = item
                break
            }
        }
        const index = host.restoreTag(tagValue, find)
        if (!find && index !== -1) newTagIndexes.push(index)
    }

    /**
     * autoSplitByPeriod：重新解析標籤後，同步分割含 ". " 的標籤，
     * 讓 UI 顯示與輸出內容一致。
     */
    host.applySplitByPeriod?.()

    return { changed: true, newTagIndexes }
}
