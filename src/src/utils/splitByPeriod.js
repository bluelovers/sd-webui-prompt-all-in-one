/**
 * splitByPeriod.js
 *
 * 將字串以句號（"."）為分隔符切割為多個片段，
 * 同時尊重巢狀括號的完整性——僅在所有括號已完全關閉的位置才執行切割。
 *
 * 設計目標：
 *   1. 零外部依賴，純函式，可獨立測試。
 *   2. 不依賴任何前端框架（Vue / React）或瀏覽器 API。
 *   3. 透過参数控制是否允許在括號前方切割。
 *
 * @module utils/splitByPeriod
 */

/**
 * 開括號 → 閉括號的映射表（用於 stack 配對驗證）
 * @type {Record<string, string>}
 */
const PAREN_MAP = { ')': '(', ']': '[', '}': '{' }

/**
 * 判斷字元是否為開括號。
 * @param {string} ch
 * @returns {boolean}
 */
function isOpenParen(ch) {
    return ch === '(' || ch === '[' || ch === '{'
}

/**
 * 判斷字元是否為閉括號。
 * @param {string} ch
 * @returns {boolean}
 */
function isCloseParen(ch) {
    return ch === ')' || ch === ']' || ch === '}'
}

/**
 * 以句號 "." 為分隔符切割字串，並在切割時防護巢狀括號。
 *
 * 算法說明（stack-based 單次遍歷）：
 *   - 維護一個 stack 追蹤目前尚未關閉的括號深度。
 *   - 僅在 stack 為空（所有括號已關閉）時，才在句號處嘗試切割。
 *   - 切割後跳過句號後的連續空白，將下一個非空白字元作為新片段的起點。
 *   - 當 includeParen 為 false 時，若句號後的下一個非空白字元是開括號，
 *     則停止繼續切割（break），避免將 "(111. 222). xxx" 錯誤拆散。
 *
 * @param {string}  str          - 要切割的原始字串。
 * @param {Object}  [options]             - 切割選項。
 * @param {boolean} [options.includeParen] - 是否允許在括號前方切割（無預設值）。
 *   - true  ：句號後遇到開括號仍執行切割。
 *   - false / undefined：句號後遇到開括號時停止切割（保留括號與前段的關聯）。
 * @returns {string[]} 切割後的片段陣列。若無可切割點則回傳包含完整字串的單元素陣列。
 *
 * @example
 *   splitByPeriod("xxx. (111. 222)", { includeParen: true })
 *   // → ["xxx.", "(111. 222)"]
 *
 *   splitByPeriod("(111. 222). xxx", { includeParen: true })
 *   // → ["(111. 222).", "xxx"]
 *
 *   splitByPeriod("xxx. (111. 222", { includeParen: true })
 *   // → ["xxx.", "(111. 222"]
 *
 *   splitByPeriod("(111. 222. xxx", { includeParen: true })
 *   // → ["(111. 222. xxx"]   （括號未關閉，stack 非空，不切割）
 *
 *   splitByPeriod("a. b. c", { includeParen: true })
 *   // → ["a.", "b.", "c"]
 *
 *   splitByPeriod("xxx. (111. 222)", { includeParen: false })
 *   // → ["xxx. (111. 222)"]  （includeParen=false，句號後為開括號，停止切割）
 */
export function splitByPeriod(str, { includeParen } = {}) {
    if (typeof str !== 'string') return [String(str)]

    const len = str.length
    const parts = []
    const stack = []
    let start = 0

    // includeParen=false 時，若下一個非空白字元是開括號則停止切割
    const notAllowParen = !includeParen

    for (let ci = 0; ci < len; ci++) {
        const ch = str[ci]

        if (isOpenParen(ch)) {
            stack.push(ch)
        } else if (isCloseParen(ch)) {
            // 僅在 stack 頂端為配對的開括號時才 pop，避免不配對的閉括號干扰
            if (stack.length > 0 && stack[stack.length - 1] === PAREN_MAP[ch]) {
                stack.pop()
            }
        } else if (ch === '.' && stack.length === 0) {
            // 僅在括號已全部關閉（stack 為空）時才考慮切割
            if (ci < len - 1 && /\s/.test(str[ci + 1])) {
                // 找出句號與空白後的第一個非空白字元
                let nextStart = ci + 1
                while (nextStart < len && /\s/.test(str[nextStart])) {
                    nextStart++
                }

                // includeParen=false 時，若下一個非空白字元是開括號則停止切割
                const nextChar = nextStart < len ? str[nextStart] : ''
                if (notAllowParen && isOpenParen(nextChar)) {
                    break
                }

                // 執行切割：保留句號在前一段末尾
                parts.push(str.substring(start, ci + 1))
                start = nextStart
                ci = nextStart - 1  // 迴圈指標跳至空白後的字元前一位
            }
        }
    }

    // 收尾：將最後一段（句號之後或無句號的完整字串）加入
    parts.push(str.substring(start))

    return parts
}

export default splitByPeriod
