import { EnumPromptInvisibleChar } from './splitPromptTypes'

/**
 * trimPromptText.ts
 *
 * 獨立的 prompt 文字清理邏輯，供 splitTags 等切割入口在處理前呼叫。
 *
 * 兩項工作：
 *   1. 清除不可見字元（EnumPromptInvisibleChar：\x00 NULL、\u200b 零寬空格）。
 *      這些字元肉眼不可見，會使標籤比對（lora / embedding 名稱）與權重解析
 *      悄悄失敗，來源多為網頁 / 終端機複製貼上。
 *   2. 修剪邊界水平空白（空格、tab、\u00a0、\u3000 等）。
 *
 * 設計約束：不得修剪換行（\n / \r）。
 * 在 prompt 切割領域中，換行是「結構」而非「噪音」——splitTags 以 "\n" 標記
 * 表示分行（wrap tag），前後換行有語意，修剪會破壞既有行為
 * （如 '\nabc' → ['\n','abc']、'abc\n' → ['abc','\n']）。
 *
 * @module utils/trimPromptText
 */

/**
 * 不可見字元清除正則（由 enum 派生，模組載入時構建一次）。
 * 由 EnumPromptInvisibleChar 取值組裝字元類別，確保新增不可見字元時
 * 只需擴充 enum，此處自動生效（單一事實來源）。
 */
const INVISIBLE_CHARS_RE = new RegExp(
    `[${EnumPromptInvisibleChar.nullChar}${EnumPromptInvisibleChar.zeroWidthSpace}]`,
    'g',
)

/**
 * 邊界水平空白修剪正則（僅字串頭尾，不含內部）。
 * [^\S\n\r] = 是空白、但不是 \n 也不是 \r（保留換行結構）。
 */
const EDGE_HORIZONTAL_WHITESPACE_RE = /^[^\S\n\r]+|[^\S\n\r]+$/g

/**
 * 清理 prompt 文字：清除不可見字元 + 修剪邊界水平空白（保留換行）。
 *
 * @param {string} text - 原始 prompt 文字
 * @returns {string} 清理後的文字
 */
export function trimPromptText(text: string): string {
    return text
        .replace(INVISIBLE_CHARS_RE, '')
        .replace(EDGE_HORIZONTAL_WHITESPACE_RE, '')
}

export default trimPromptText
