/**
 * 輸入框文字變動時的標籤切割與重建核心。
 *
 * 把輸入框內容解析為標籤陣列：
 * 以 splitTags 切割文字、
 * 依相鄰特徵與行位置把停用中的標籤插回，
 * 再逐段還原為 tag 物件。
 *
 * 輸入框 DOM 檢查（自動完成面板是否顯示）、翻譯與 refresh 由呼叫端接線，
 * 本模組只負責解析與重建。
 */

import { splitTags } from '../splitTags'
import { tagIsDisabled } from './util'
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

/** 停用標籤的還原定位脈絡 */
export interface IDisabledTagContext {
    /** 停用標籤的 value */
    value: IPromptTagValue
    /** 舊陣列中前一個標籤的 value；停用標籤位於開頭時為 null */
    prevValue: IPromptTagValue | null
    /** 舊陣列中後一個標籤的 value；停用標籤位於結尾時為 null */
    nextValue: IPromptTagValue | null
    /** 所在行號（以換行標籤計數，0 起） */
    line: number
    /** 行內序號（該行的第幾個標籤，0 起，含停用標籤自身） */
    indexInLine: number
}

/**
 * 收集所有停用標籤的還原定位脈絡。
 *
 * 停用標籤不會出現在輸入框文字中，重建時須另行插回；僅憑舊索引，
 * 在使用者增刪過其他標籤後即會錯位，故先記錄其前後相鄰標籤與行位置，
 * 供還原時重新定位。
 *
 * @param tags - 重建前的標籤陣列
 * @returns 依舊陣列索引遞增排列的定位脈絡
 */
export function collectDisabledContexts(tags: readonly IPromptTag[]): IDisabledTagContext[] {
    const contexts: IDisabledTagContext[] = []
    /** 目前行號與該行第一個標籤的索引，遇換行標籤推進 */
    let line = 0
    let lineStart = 0
    tags.forEach((tag, index) => {
        if (tagIsDisabled(tag)) {
            contexts.push({
                value: tag.value,
                prevValue: index > 0 ? tags[index - 1].value : null,
                nextValue: index + 1 < tags.length ? tags[index + 1].value : null,
                line,
                indexInLine: index - lineStart,
            })
        }
        if (tag.value === "\n") {
            line++
            lineStart = index + 1
        }
    })
    return contexts
}

/**
 * 在切割結果中定位停用標籤的插入位置。
 *
 * 定位策略（依序嘗試，命中即止）：
 *   1. 前後 — 前一個與後一個標籤皆吻合（null 視為陣列邊界）
 *   2. 後側唯一 — 前鄰非開頭訊號且後鄰僅出現一次時，定案於其緊前方
 *   3. 前 , 後 — 先只比前一個，再只比後一個
 *   4. 行號 , index — 退回以行號與行內序號定位（行數不足時附加到末尾）
 *
 * 同層有多個候選時，優先取與原行號相同者，其餘取最前者。
 *
 * @param ctx       - 停用標籤的定位脈絡
 * @param tagValues - 當前切割結果（先前已插回的停用標籤亦在其中）
 * @returns 插入位置（0 = 最前，tagValues.length = 最末）
 */
export function resolveDisabledPosition(ctx: IDisabledTagContext, tagValues: readonly IPromptTagValue[]): number {
    const length = tagValues.length
    /** lineAt[p] = 插入位置 p 所屬行號（位置 p 之前的換行數） */
    const lineAt: number[] = []
    let currentLine = 0
    for (let p = 0; p <= length; p++) {
        lineAt[p] = currentLine
        if (p < length && tagValues[p] === "\n") currentLine++
    }

    /** 前側吻合：prevValue 為 null 時僅陣列開頭成立 */
    const prevOk = (p: number) => ctx.prevValue === null
        ? p === 0
        : p > 0 && tagValues[p - 1] === ctx.prevValue
    /** 後側吻合：nextValue 為 null 時僅陣列結尾成立 */
    const nextOk = (p: number) => ctx.nextValue === null
        ? p === length
        : p < length && tagValues[p] === ctx.nextValue

    /** 同層候選中優先取原行號，其餘取最前者 */
    const pick = (candidates: number[]): number => {
        let fallback = -1
        for (const p of candidates) {
            if (lineAt[p] === ctx.line) return p
            if (fallback === -1) fallback = p
        }
        return fallback
    }

    /** 策略 1：前後皆吻合 */
    const both: number[] = []
    for (let p = 0; p <= length; p++) {
        if (prevOk(p) && nextOk(p)) both.push(p)
    }
    const bothPos = pick(both)
    if (bothPos !== -1) return bothPos

    /** 後側候選：停用標籤必緊鄰其後鄰之前，後鄰是比前鄰更穩定的錨點 */
    const nextOnly: number[] = []
    for (let p = 0; p <= length; p++) {
        if (nextOk(p)) nextOnly.push(p)
    }

    /**
     * 策略 2：後側唯一命中即定案 —— 後鄰僅出現一次時，插入位置必定在其緊
     * 前方。前鄰可能是本次被修改的標籤（例如停用標籤上方那一行的文字），
     * 此時以其優先定位會退回到錯誤的行首，使停用標籤脫離原本相鄰的標籤。
     *
     * 僅在 prevValue 非 null 時套用：null 代表停用標籤原為陣列開頭，
     * 「插在最前」是比後鄰更強的訊號，不得被覆蓋。後鄰為 null（原為末尾）
     * 同理不套用。
     */
    if (ctx.prevValue !== null && ctx.nextValue !== null && nextOnly.length === 1) {
        return nextOnly[0]
    }

    /** 策略 3：先只比前一個，再只比後一個 */
    const prevOnly: number[] = []
    for (let p = 0; p <= length; p++) {
        if (prevOk(p)) prevOnly.push(p)
    }
    const prevPos = pick(prevOnly)
    if (prevPos !== -1) return prevPos

    const nextPos = pick(nextOnly)
    if (nextPos !== -1) return nextPos

    /** 策略 3：行號 + 行內序號；行不存在時附加到陣列末尾 */
    let lineStart = length
    if (ctx.line === 0) {
        lineStart = 0
    } else {
        let wraps = 0
        for (let p = 0; p < length; p++) {
            if (tagValues[p] !== "\n") continue
            wraps++
            if (wraps === ctx.line) {
                lineStart = p + 1
                break
            }
        }
    }
    /** 行終點 = 該行之後的第一個換行，行內序號超出時夾在行尾 */
    let lineEnd = length
    for (let p = lineStart; p < length; p++) {
        if (tagValues[p] === "\n") {
            lineEnd = p
            break
        }
    }
    return Math.min(lineStart + ctx.indexInLine, lineEnd)
}

/**
 * 解析輸入框文字並重建標籤陣列。
 *
 * 停用中的標籤不在輸入框文字內，需依其前後相鄰標籤與行位置重新定位
 * 後插回切割結果，否則重建後會消失或位置漂移。
 * 文字槽位以舊「啟用」標籤比對來源還原 localValue / disabled / 自訂屬性；
 * 停用插入槽位直接沿用原停用標籤，比對不到者視為新建。
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
     * 停用標籤不會出現在輸入框文字中：先記錄其前後相鄰標籤與行位置，
     * 再逐一定位插回切割結果，維持原本的相對位置。
     * slotSources 與 tagValues 平行推進：停用槽位記原停用標籤、文字槽位為 null，
     * 同 value 同時存在啟用與停用時，重建才不會把停用狀態錯套給啟用標籤。
     */
    const oldTags = host.tags
    const disabledContexts = collectDisabledContexts(oldTags)
    /** 與 disabledContexts 同序同長度（兩者皆依舊陣列順序逐個收集停用標籤） */
    const disabledTags = oldTags.filter(tag => tagIsDisabled(tag))
    const slotSources: (IPromptTag | null)[] = tagValues.map(() => null)
    disabledContexts.forEach((ctx, i) => {
        const position = resolveDisabledPosition(ctx, tagValues)
        tagValues.splice(position, 0, ctx.value)
        slotSources.splice(position, 0, disabledTags[i])
    })

    host.clearTags()

    /**
     * 文字槽位的啟用來源池：排除停用與換行標籤（換行由 appendWrapTag 處理），
     * 依舊陣列順序以游標逐一消耗。同 value 的多個啟用標籤（例如多個 "#"）
     * 各自配回自己的舊標籤；停用標籤不進此池，故不會與文字槽位互相搶佔，
     * 其狀態也不會外洩到啟用標籤上。
     */
    const enabledSources = oldTags.filter(tag => !tagIsDisabled(tag) && tag.value !== "\n")
    let enabledCursor = 0

    /** 新建（非還原）的標籤索引，交給呼叫端決定是否翻譯 */
    const newTagIndexes: number[] = []
    for (let i = 0; i < tagValues.length; i++) {
        const tagValue = tagValues[i]
        if (tagValue === "\n") {
            host.appendWrapTag()
            continue
        }
        // if (tagValue.indexOf('Negative prompt:') === 0) break
        /**
         * 來源比對：停用槽位沿用收集時記下的原停用標籤；文字槽位只從
         * 啟用來源池取用下一個同 value 者——停用標籤不出現在輸入框文字，
         * 若首個同 value 命中者是停用標籤，其 disabled 屬性會錯套到使用者
         * 輸入的啟用標籤上；而每次都從頭比對，會讓多個同 value 的啟用標籤
         * 全部還原到同一個舊標籤，彼此互相覆蓋屬性。
         */
        let find: IPromptTag | null = slotSources[i]
        if (!find) {
            for (let j = enabledCursor; j < enabledSources.length; j++) {
                if (enabledSources[j].value === tagValue) {
                    find = enabledSources[j]
                    enabledCursor = j + 1
                    break
                }
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
