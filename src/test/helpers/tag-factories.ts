
import type { IGenPromptTag } from '../../src/utils/promptTags/genPrompt'

/**
 * 標籤工廠（單一事實來源）。
 *
 * data-genPrompt / data-updatePrompt / data-genPrompt-updatePrompt 原本各自
 * 複製一份 text / wrap / brk（其中兩份再複製一次 lora），共 12 個定義、4 個實體。
 * 各份的細節（localValue 是否與 value 相同、lora 是否帶 isLora）散落三處，
 * 漏改其一就會讓不同 fixture 對「同一顆標籤」描述不一致。
 * 抽出後，fixture 如何描述一顆標籤只存在這一份。
 */

/** 一般文字標籤（對應 _appendTag 的 type='text'）。 */
export const text = (value: string): IGenPromptTag => ({ type: 'text', value, localValue: '' })

/** 換行標籤（對應 _appendTag 的 type='wrap'，value 與 localValue 都是 "\n"）。 */
export const wrap = (): IGenPromptTag => ({ type: 'wrap', value: '\n', localValue: '\n' })

/** BREAK 標籤（tagIsBreak 以 value.trim() === 'BREAK' 判定）。 */
export const brk = (value = 'BREAK'): IGenPromptTag => ({ type: 'BREAK', value, localValue: '' })

/** Lora 標籤（tagIsLoraLike 以 isLora / isLyco 判定）。 */
export const lora = (name: string): IGenPromptTag => ({ type: 'lora', value: `<lora:${name}:1>`, isLora: true, localValue: '' })
