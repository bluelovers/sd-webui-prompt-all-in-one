import type { IGenPromptTag } from '../../src/utils/promptTags/genPrompt'
import { EnumPromptTagType } from '../../src/utils/promptTags/tag-types'

/** 一般文字標籤（對應 _appendTag 的 type='text'）。 */
export const text = (value: string): IGenPromptTag => ({ type: EnumPromptTagType.text, value })

/** 換行標籤（對應 _appendTag 的 type='wrap'）。 */
export const wrap = (): IGenPromptTag => ({
	type: EnumPromptTagType.wrap,
	value: EnumPromptTagType.VALUE_NEWLINE,
})

/**
 * BREAK 標籤（tagIsBreak 以 value.trim() === 'BREAK' 判定）。
 *
 * type 與 value 都取 EnumPromptTagType.VALUE_BREAK：本 fixture 的 BREAK 標籤
 * 型別即為 'BREAK'（見 *.snapshot 的 "type": "BREAK"），故兩處引用同一常數。
 */
export const brk = (value: string = EnumPromptTagType.VALUE_BREAK): IGenPromptTag => ({
	type: EnumPromptTagType.VALUE_BREAK,
	value,
})

/** Lora 標籤（tagIsLoraLike 以 isLora / isLyco 判定）。 */
export const lora = (name: string): IGenPromptTag => ({
	type: EnumPromptTagType.lora,
	value: `<lora:${name}:1>`,
	isLora: true,
})
