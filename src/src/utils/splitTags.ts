import {
    EnumPromptBracketClose,
    EnumPromptBracketOpen,
    EnumPromptBreakKeyword,
    EnumPromptQuoteChar,
    EnumPromptSplitMarker,
    isPromptBracketOpen,
    promptBracketPairs,
    type IPromptBracketClose,
    type IPromptBracketOpen,
} from './splitPromptTypes'

/**
 * 分割選項。
 * 廢充選項集中於此物件，避免參數隨功能增加而爆炸。
 */
export interface ISplitTagsOptions {
    /** 是否允許保持一個空行（預設 false）。
     *  false：連續換行一律壓縮為單一換行（\n+ → \n）。
     *  true：連續換行最多保留一個空行（\n{3,} → \n\n），兩個以上的空行仍會被壓縮。 */
    allowKeepEmptyLine?: boolean
}

/**
 * 分割入口的輸入型別。
 * 傳入 false / null / undefined 與空白字串時回傳空陣列（沿用既有防禦行為）。
 * TODO: 目前為寬鬆型別——js 呼叫端可能傳入非預期值，日後收斂為 string 並在呼叫端修正。
 */
export type ISplitTagsInput = string | false | null | undefined

/**
 * 單一分割結果片段。
 * TODO: 目前為寬鬆型別（純 string），日後收斂為區辨聯集
 *       （文字片段 | 分行標記 | BREAK 關鍵字），以型別取代散布的字串比對。
 */
export type ITagSegment = string

/**
 * 行級 runtime 狀態介面。
 * 所有「僅作用於當前行」的變數集中於此，分行時由 reset() 一併重置。
 */
export interface IPromptLineState {
    /** null = 不在引號內；EnumPromptQuoteChar = 目前開啟的引號字元（不跨行保留） */
    quoteChar: EnumPromptQuoteChar | null
    /** 目前括號巢狀深度 */
    bracketCount: number
    /** 目前開啟的開括號（'' = 無括號） */
    startBracketChar: IPromptBracketOpen | ''
    /** 目前括號對應的閉括號（'' = 無括號） */
    endBracketChar: IPromptBracketClose | ''
    /** 重置括號狀態（逗號 / BREAK 分段時使用；引號不受影響） */
    resetBracket(): void
    /** 行級完整重置（分行時使用）：結束引號 + 重置括號 */
    reset(): void
}

/**
 * 表情符號保護占位組。
 */
interface IEmojiGuard {
    /** 表情符號原文 */
    emoji: string
    /** 對應的比對正則（全域） */
    re: RegExp
}

/**
 * 表情符號占位符：切割期間以占位符取代表情，避免被誤判為括號/標點。
 *
 * @param {number} index - 表情在 EMOJI_GUARDS 中的索引
 * @returns {string}
 */
const emojiPlaceholder = (index: number): string => `|||EXPRESSION${index}|||`

/** 受保護的表情符號清單（索引即占位符編號，兩端共用）。 */
const EMOJI_GUARDS: readonly IEmojiGuard[] = [
    { emoji: ">_<", re: /\>_\</g },
    { emoji: ":<", re: /\:\</g },
    { emoji: ">:<", re: /\>\:\</g },
    { emoji: ":>", re: /\:\>/g },
    { emoji: ":-(", re: /\:\-\(/g },
    { emoji: ":-)", re: /\:\-\)/g },
]

/** 「空白 + BREAK」字串：用於偵測段尾 BREAK 並移除。 */
const BREAK_WITH_SPACE = ' ' + EnumPromptBreakKeyword.BREAK

/**
 * 分割标签（对外入口）。
 *
 * @param {ISplitTagsInput} tags
 * @param {boolean} autoBreakBeforeWrap
 * @param {boolean} autoBreakAfterWrap
 * @param {ISplitTagsOptions} [options] - 扩充选项集中于此物件，避免参数随功能增加而爆炸。
 * @returns {ITagSegment[]}
 */
export default (tags: ISplitTagsInput, autoBreakBeforeWrap = false, autoBreakAfterWrap = false, options: ISplitTagsOptions = {}): ITagSegment[] => {
    if (tags === null || tags === undefined || tags === false || tags === "" || tags.trim() === "") return []
    return splitRaw(tags, true, autoBreakBeforeWrap, autoBreakAfterWrap, options)
}

/**
 * 建立「僅作用於當前行」的 runtime 狀態物件。
 *
 * 為何集中管理：過去行級變數（引號、括號）以散落的個別變數維護，
 * 分行時逐一手列重置，發生過「新增行級變數卻忘了納入重置清單」的遺漏
 * （quoteChar 未隨分行重置 → 未關閉引號跨行吞掉整段後續標籤，產生孤兒逗號 tag）。
 * 集中為單一物件後，重置只需一行 lineState.reset()，
 * 未來新增行級變數只需加進 createLineState() 與 reset()，不會再有遺漏。
 *
 * @returns {IPromptLineState}
 */
function createLineState(): IPromptLineState {
    return {
        quoteChar: null,
        bracketCount: 0,
        startBracketChar: '',
        endBracketChar: '',
        resetBracket() {
            this.bracketCount = 0
            this.startBracketChar = ''
            this.endBracketChar = ''
        },
        reset() {
            this.quoteChar = null
            this.resetBracket()
        },
    }
}

/**
 * 分割核心（可遞迴重處理）。
 *
 * @param {string}  tags
 * @param {boolean} allowSingleQuote - 是否允許單引號開啟引號。
 *   主呼叫為 true；當分段（分行或收尾）時發現單引號未關閉（quoteChar 為單引號），
 *   該段會以 false 遞迴重處理——忽略此未關閉的單引號，
 *   重新套用逗號／分行／BREAK／括號切割規則。
 *   雙引號不受影響（未關閉雙引號仍保護到結尾）。
 * @param {boolean} autoBreakBeforeWrap
 * @param {boolean} autoBreakAfterWrap
 * @param {ISplitTagsOptions} [options]
 * @returns {ITagSegment[]}
 */
function splitRaw(tags: string, allowSingleQuote: boolean, autoBreakBeforeWrap: boolean, autoBreakAfterWrap: boolean, options: ISplitTagsOptions = {}): ITagSegment[] {
    const { allowKeepEmptyLine = false } = options

    /**
     * 中文/日文標點轉換（原為全域 pre-process，改為在迴圈內 quote-aware 執行）
     * 避免引號內的「、」。「」被提前轉換，失去原始語義。
     */
    function convertPunctuation(ch: string): string {
        switch (ch) {
            /** ，中文逗号 */
            case '\uFF0C': return ','
            /** 。中文句号 */
            case '\u3002': return '.'
            /** 、中文顿号 */
            case '\u3001': return ','
            /** ；中文分号 */
            case '\uFF1B': return ','
            /** ．日文句号(fullwidth) */
            case '\uFF0E': return ','
            default: return ch
        }
    }

    /** 制表符 */
    tags = tags.replace(/\t/g, EnumPromptSplitMarker.newline)
    /** 回车符 */
    tags = tags.replace(/\r/g, EnumPromptSplitMarker.newline)
    /**
     * 连续换行符压缩：
     *   allowKeepEmptyLine=false（预设）— 一律压缩为单个换行（\n+ → \n）
     *   allowKeepEmptyLine=true          — 最多保留一个空行（\n{3,} → \n\n）
     */
    tags = allowKeepEmptyLine
        ? tags.replace(/\n{3,}/g, '\n\n')
        : tags.replace(/\n+/g, EnumPromptSplitMarker.newline)

    const emojis = EMOJI_GUARDS
    emojis.forEach((emoji, index) => {
        tags = tags.replace(emoji.re, emojiPlaceholder(index))
    })

    let length = tags.length
    let temp = ''
    /**
     * 行級 runtime 狀態：所有「僅作用於當前行」的變數集中於此。
     * 分行時由 splitAtNewline() 呼叫 lineState.reset() 一併重置。
     * 新增行級變數時只需加進 createLineState()，不會再發生遺漏重置。
     */
    const lineState = createLineState()
    let result: ITagSegment[] = []

    /**
     * 推送一段文字：唯一的事實來源，分行分段、逗號分段、BREAK、收尾皆共用。
     * 若此時單引號未關閉（false positive，如所有格 orks'），
     * 忽略該單引號、以 allowSingleQuote=false 遞迴重處理此段，
     * 重新套用逗號／分行／BREAK／括號規則後再推送結果。
     * 未關閉的雙引號不觸發重處理（保持保護到結尾的既有行為）。
     */
    function pushSegment(): void {
        const text = temp.trim()
        if (text === '') return
        if (allowSingleQuote && lineState.quoteChar === EnumPromptQuoteChar.single) {
            result.push(...splitRaw(text, false, autoBreakBeforeWrap, autoBreakAfterWrap, options))
        } else {
            result.push(text)
        }
    }

    /**
     * 分行切割：唯一事實來源，引號內／外、括號內／外共用，保證行為完全一致。
     * 設計規則：分行優先級最高——不論引號或括號狀態，\n 一律觸發切割；
     * 且引號不跨行保留：切割後由 lineState.reset() 將行級狀態（含 quoteChar）
     * 一併重置，下一行視為全新上下文（跨段括號亦不強制配對）。
     */
    function splitAtNewline(): void {
        pushSegment()
        result.push(EnumPromptSplitMarker.newline)
        lineState.reset()
        temp = ''
    }

    for (let i = 0; i < length; i++) {
        const char = tags[i]

        /** ── 引號追蹤（優先級最高）── */
        if (lineState.quoteChar) {
            /** 在引號內：遇到相同引號字元則關閉 */
            if (char === lineState.quoteChar) {
                lineState.quoteChar = null
            }
            /** 分行優先級大於引號：即使在引號內，\n 仍觸發切割，並結束該行引號 */
            if (char === EnumPromptSplitMarker.newline) {
                splitAtNewline()
                continue
            }
            temp += char
            continue
        } else if (char === EnumPromptQuoteChar.double) {
            /** 雙引號一律視為引號開啟（不會是撇號） */
            lineState.quoteChar = EnumPromptQuoteChar.double
            temp += char
            continue
        } else if (char === EnumPromptQuoteChar.single && allowSingleQuote) {
            /**
             * 單引號需區分撇號（it's、pathâ's、👍's）與引號開啟（'hello'）。
             * 撇號的特徵：前後都不是空白（\S 已涵蓋 tab、nbsp 及所有 Unicode 空白）。
             * 選 \S 而非 \w/\p{L}：過嚴會把非 ASCII 相鄰的撇號誤判為引號開頭，
             * 導致整串未閉合而黏成一段（災難性）；過鬆僅漏開引號（局部）。
             * allowSingleQuote=false（未關閉單引號的重處理）時跳過此分支，
             * 單引號視為一般字元，逗號照常切割。
             */
            const prevChar = i > 0 ? tags[i - 1] : ''
            const nextChar = i < length - 1 ? tags[i + 1] : ''
            const isApostrophe = /^\S$/.test(prevChar) && /^\S$/.test(nextChar)
            if (!isApostrophe) {
                lineState.quoteChar = EnumPromptQuoteChar.single
                temp += char
                continue
            }
            temp += char
            continue
        }

        /** 中文/日文標點轉換：僅在引號外執行，引號內保留原始字元 */
        const converted = convertPunctuation(char)

        if (converted === EnumPromptSplitMarker.newline) {
            /** 分行優先級大於引號：與引號內共用同一切割邏輯 */
            splitAtNewline()
        } else if (converted === ",") {
            if (lineState.startBracketChar === '') {
                /** 前面没有括号 */
                pushSegment()
                lineState.resetBracket()
                temp = ''
            } else {
                /** 前面有括号 */
                temp += converted
            }
        } else {
            if (lineState.startBracketChar === '') {
                /** 前面没有括号 */
                if (isPromptBracketOpen(converted)) {
                    /** 括号开始 */
                    lineState.bracketCount = 1
                    lineState.startBracketChar = converted
                    lineState.endBracketChar = promptBracketPairs[converted]
                    temp += converted
                } else {
                    if (converted === " " && temp.trim() === EnumPromptBreakKeyword.BREAK) {
                        pushSegment()
                        lineState.resetBracket()
                        temp = ''
                    } else {
                        temp += converted
                        if (temp.endsWith(BREAK_WITH_SPACE)) {
                            temp = temp.substring(0, temp.length - BREAK_WITH_SPACE.length)
                            pushSegment()
                            result.push(EnumPromptBreakKeyword.BREAK)
                            lineState.resetBracket()
                            temp = ''
                        }
                    }
                }
            } else {
                /** 前面有括号 */
                if (converted === lineState.endBracketChar) {
                    /** 是结束括号的标识，减掉括号计数 */
                    lineState.bracketCount--
                    if (lineState.bracketCount === 0) {
                        /** 括号计数为0，括号结束 */
                        lineState.startBracketChar = ''
                        lineState.endBracketChar = ''
                        temp += converted
                    } else {
                        temp += converted
                    }
                } else if (converted === lineState.startBracketChar) {
                    /** 是开始括号的标识，加上括号计数 */
                    lineState.bracketCount++
                    temp += converted
                } else {
                    temp += converted
                }
            }
        }
    }
    pushSegment()

    let result2: ITagSegment[] = []
    for (let value of result) {
        if (value === EnumPromptSplitMarker.newline) {
            result2.push(value)
            continue
        }
        let start = value[0]
        let end = value[value.length - 1]
        /**
         * 以明確字元比對（非 isPromptBracketOpen 全列）：
         * 舊版僅保護 [ ( { 包裹的片段，<...> 不在此列（交由下方 lora 抽取處理），
         * 保持行為一致，勿改為全括號判斷。
         */
        if (start === EnumPromptBracketOpen.square && end === EnumPromptBracketClose.square) {
            result2.push(value)
            continue
        }
        if (start === EnumPromptBracketOpen.paren && end === EnumPromptBracketClose.paren) {
            result2.push(value)
            continue
        }
        if (start === EnumPromptBracketOpen.curly && end === EnumPromptBracketClose.curly) {
            result2.push(value)
            continue
        }

        /**
         * lora 標籤與權重括號格式範例（本段邏輯只會拆出 <lora:...>，其餘靠括號防護保留）：
         * aaa <lora:KuutanKoihime:0.7>  <lora:add_detail:0.6><lora:clothesTransparent_v20:1:1,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0>, [<lora:A:1>:<lora:B:1>:10], [lora:A:1::10], [<lora:A:1>:10], [<lora:A:1>:0.5], [[<lora:A:1>::25]:10], [<lora:A:1> #increment:10], [<lora:A:1> #decrease:10], [<lora:A:1> #cmd\(warmup\(0.5\)\):10]
         */
        let regex = /\<lora:[^\>]+\>/
        let match: RegExpExecArray | null = null
        let values: string[] = []
        while (match = regex.exec(value)) {
            let startIndex = match.index
            let endIndex = startIndex + match[0].length
            let before = value.substring(0, startIndex).trim()
            let after = value.substring(endIndex).trim()
            let middle = match[0]
            values.push(before)
            values.push(middle)
            value = after
        }
        values.push(value)
        for (let value2 of values) {
            if (value2 === '' || value2.trim() === '') continue
            emojis.forEach((emoji, index) => {
                value2 = value2.replace(emojiPlaceholder(index), emoji.emoji)
            })
            result2.push(value2)
        }
    }
    result = result2

    return result
}

/*
export default {
    dontSplitRegexes: [
        // [night light:magical forest: 5, 15]
        // [night light:magical forest:norvegian territory: 5, 15, 25:catmull]
        // (fire extinguisher: 1.0, 2.0)
        // [(fire extinguisher: 1.0, 2.0)::5]
        // [lion:bird:girl: , 7, 10]
        /(\[([\w\s\_\-]+:)+\s*([0-9\.]*,?\s*)+(:[\w\s\_\-]+)*\])+/g,
        /(\(([\w\s\_\-]+:)+\s*([0-9\.]*,?\s*)+(:[\w\s\_\-]+)*\))+/g,
        // EasyNegative (normal quality,Low quality,worst quality:1.4)
        /(([^,]+)?\s*\\*\(([\w\s\_\-\|]+\,*(:[0-9\.]+)?\,?\s*)+\\*\)\s*([^,]+)?)+/g,
        // EasyNegative [normal quality,Low quality,worst quality:1.4]
        /(([^,]+)?\s*\\*\[([\w\s\_\-\|]+\,*(:[0-9\.]+)?\,?\s*)+\\*\]\s*([^,]+)?)+/g,
        // <lora:clothesTransparent_v20:1:1,0,0,0,1,1,1,1,1,1,1,1,0,0,0,0,0>
        /(\<[^\>]+\>)+/g,
    ],

    /!**
     * 分割标签
     * @param tags {string}
     * @returns {string[]}
     *!/
    splitTags(tags) {
        tags = tags.trim()
        tags = tags.replace(/\t/g, '\n') // 制表符
        // tags = tags.replace(/\n/g, '\n') // 换行符
        tags = tags.replace(/\r/g, '\n') // 回车符
        tags = tags.replace(/\n+/g, '\n') // 连续换行符

        tags = tags.replace(/\n+/g, ',')
        console.log(tags)

        let list = []
        const lines = tags.split("\n")
        const lineCount = lines.length
        lines.forEach((line, index) => {
            line = line.trim()
            if (line === '') return
            // 替换
            line = line.replace(/，/g, ',') // 中文逗号
            line = line.replace(/。/g, ',') // 中文句号
            line = line.replace(/、/g, ',') // 中文顿号
            line = line.replace(/；/g, ',') // 中文分号
            line = line.replace(/．/g, ',') // 日文句号
            line = line.replace(/;/g, ',') // 英文分号
            const replace = '----====physton====----'
            const replaceRex = new RegExp(replace, 'g')
            for (const regex of this.dontSplitRegexes) {
                // 将其中的逗号替换掉
                line = line.replace(regex, (match) => {
                    return match.replace(/,/g, replace)
                })
            }
            line.split(",").forEach((tag, index) => {
                tag = tag.trim()
                if (tag === '') return
                // 把逗号替换回来
                tag = tag.replace(replaceRex, ',')
                list.push(tag)
            })
            if (index < lineCount - 1) {
                list.push('\n')
            }
        })
        return list
    },
}*/
