import { EnumPromptInvisibleChar } from './splitPromptTypes'

/**
 * 不可見字元清除正則（由 enum 派生，模組載入時構建一次）。
 * 由 EnumPromptInvisibleChar 取值組裝字元類別，確保新增不可見字元時
 * 只需擴充 enum，此處自動生效。
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
