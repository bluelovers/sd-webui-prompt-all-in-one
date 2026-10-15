/**
 * prompt 切割模組共用型別（splitTags / splitByPeriod）。
 *
 * 依 utils/promptOptions/types.ts 的慣例：
 *   - 魔術字串一律建立為 const enum，.ts 檔內一律使用 enum。
 *   - 同時匯出 ITSTypeAndStringLiteral<Enum> 型別別名，
 *     相容於純 js 呼叫端傳入原始字串（js 端無 enum 概念）。
 */
import type { ITSTypeAndStringLiteral } from 'ts-type'

/**
 * 引號字元。
 * 雙引號一律視為引號開啟；單引號需先排除撇號（it's）。
 */
export const enum EnumPromptQuoteChar {
    double = '"',
    single = "'",
}

/**
 * 引號字元（相容於 js：接受原始字串）。
 */
export type IPromptQuoteChar = ITSTypeAndStringLiteral<EnumPromptQuoteChar>

/**
 * 開括號。
 * 括號僅保護內部逗號不被切割，不保護分行。
 */
export const enum EnumPromptBracketOpen {
    paren = '(',
    square = '[',
    angle = '<',
    curly = '{',
}

/**
 * 開括號（相容於 js：接受原始字串）。
 */
export type IPromptBracketOpen = ITSTypeAndStringLiteral<EnumPromptBracketOpen>

/**
 * 閉括號（與 EnumPromptBracketOpen 同序配對）。
 */
export const enum EnumPromptBracketClose {
    paren = ')',
    square = ']',
    angle = '>',
    curly = '}',
}

/**
 * 閉括號（相容於 js：接受原始字串）。
 */
export type IPromptBracketClose = ITSTypeAndStringLiteral<EnumPromptBracketClose>

/**
 * BREAK 關鍵字（WebUI 特殊分段關鍵字，獨立成 tag 不併入文字）。
 */
export const enum EnumPromptBreakKeyword {
    BREAK = 'BREAK',
}

/**
 * BREAK 關鍵字（相容於 js：接受原始字串）。
 */
export type IPromptBreakKeyword = ITSTypeAndStringLiteral<EnumPromptBreakKeyword>

/**
 * 切割結果中的分行標記：結果陣列以本值元素表示「此處換行」。
 */
export const enum EnumPromptSplitMarker {
    newline = '\n',
}

/**
 * 分行標記（相容於 js：接受原始字串）。
 */
export type IPromptSplitMarker = ITSTypeAndStringLiteral<EnumPromptSplitMarker>

/**
 * 分割點分隔符（splitByPeriod 的句號 / 分號機制）。
 */
export const enum EnumPromptSplitDelimiter {
    period = '.',
    semicolon = ';',
}

/**
 * 分割點分隔符（相容於 js：接受原始字串）。
 */
export type IPromptSplitDelimiter = ITSTypeAndStringLiteral<EnumPromptSplitDelimiter>

/* ====================================================================
 *  定義（由 enum 派生的執行期資料，對應 promptOptions/definitions.ts 的角色）
 *
 *  以顯式列舉建立而非 Object.values()：在 const enum 完全內聯的編譯設定下，
 *  顯式列舉仍可正確取值，不依賴 enum 物件存在。
 * ==================================================================== */

/** 開括號全體（用於開括號識別）。
 *  TODO: 若未來新增括號種類，只需在 EnumPromptBracketOpen/Close 與此清單同步補上。 */
export const promptBracketOpens: readonly EnumPromptBracketOpen[] = [
    EnumPromptBracketOpen.paren,
    EnumPromptBracketOpen.square,
    EnumPromptBracketOpen.angle,
    EnumPromptBracketOpen.curly,
]

/** 閉括號全體（用於閉括號識別）。
 *  TODO: 同上，與 EnumPromptBracketClose 同步。 */
export const promptBracketCloses: readonly EnumPromptBracketClose[] = [
    EnumPromptBracketClose.paren,
    EnumPromptBracketClose.square,
    EnumPromptBracketClose.angle,
    EnumPromptBracketClose.curly,
]

/**
 * 開括號 → 閉括號配對表。
 */
export const promptBracketPairs: Readonly<Record<EnumPromptBracketOpen, EnumPromptBracketClose>> = {
    [EnumPromptBracketOpen.paren]: EnumPromptBracketClose.paren,
    [EnumPromptBracketOpen.square]: EnumPromptBracketClose.square,
    [EnumPromptBracketOpen.angle]: EnumPromptBracketClose.angle,
    [EnumPromptBracketOpen.curly]: EnumPromptBracketClose.curly,
}

/**
 * 閉括號 → 開括號配對表（splitByPeriod 的 stack 配對用）。
 */
export const promptBracketPairsReversed: Readonly<Record<EnumPromptBracketClose, EnumPromptBracketOpen>> = {
    [EnumPromptBracketClose.paren]: EnumPromptBracketOpen.paren,
    [EnumPromptBracketClose.square]: EnumPromptBracketOpen.square,
    [EnumPromptBracketClose.angle]: EnumPromptBracketOpen.angle,
    [EnumPromptBracketClose.curly]: EnumPromptBracketOpen.curly,
}

/**
 * 型別守衛：是否為開括號。
 *
 * @param {string} ch - 待檢查字元（來源為輸入字串逐字元，故形參為 string）
 * @returns {boolean}
 */
export function isPromptBracketOpen(ch: string): ch is EnumPromptBracketOpen {
    return (promptBracketOpens as readonly string[]).includes(ch)
}

/**
 * 型別守衛：是否為閉括號。
 *
 * @param {string} ch - 待檢查字元
 * @returns {boolean}
 */
export function isPromptBracketClose(ch: string): ch is EnumPromptBracketClose {
    return (promptBracketCloses as readonly string[]).includes(ch)
}
