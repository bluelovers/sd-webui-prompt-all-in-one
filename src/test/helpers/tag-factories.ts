
import type { IGenPromptTag } from '../../src/utils/promptTags/genPrompt'
import { EnumPromptTagType } from '../../src/utils/promptTags/tag-types'

/**
 * 標籤工廠（單一事實來源）。
 *
 * data-genPrompt / data-updatePrompt / data-genPrompt-updatePrompt 原本各自
 * 複製一份 text / wrap / brk（其中兩份再複製一次 lora），共 12 個定義、4 個實體。
 * 各份的細節（lora 是否帶 isLora）散落三處，漏改其一就會讓不同 fixture
 * 對「同一顆標籤」描述不一致。抽出後，fixture 如何描述一顆標籤只存在這一份。
 *
 * 型別與特殊值不再以字面值重複描述，一律取自 tag-types 的 EnumPromptTagType，
 * 與被測模組的 tagIsWrap / tagIsBreak / tagIsLoraLike 認定的是同一份常數。
 */

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
