import type { IGenPromptTag } from '../../src/utils/promptTags/genPrompt'
import { EnumPromptTagType, IPromptTag, IPromptTagValue } from '../../src/utils/promptTags/tag-types'

export type ITestPromptTagProps = Partial<Omit<IGenPromptTag, 'type' | 'value'>>;

export function _t_createTag_core(type: IPromptTag['type'], value: IPromptTag['value'], props?: ITestPromptTagProps): IGenPromptTag {
	return {
		type,
		value,
		...props
	}
}

/** 一般文字標籤（對應 _appendTag 的 type='text'）。 */
export function _t_createTag_text(value: IPromptTag['value'], props?: ITestPromptTagProps): IGenPromptTag {
	return _t_createTag_core(EnumPromptTagType.text, value, props)
}

/** 換行標籤（對應 _appendTag 的 type='wrap'）。 */
export function _t_createTag_wrap(props?: ITestPromptTagProps): IGenPromptTag {
	return _t_createTag_core(EnumPromptTagType.wrap, EnumPromptTagType.VALUE_NEWLINE, props)
}

export function _t_createTag_brk(props?: ITestPromptTagProps): IGenPromptTag {
	return _t_createTag_core(EnumPromptTagType.text, EnumPromptTagType.VALUE_BREAK, props)
}

/** Lora 標籤（tagIsLoraLike 以 isLora / isLyco 判定）。 */
export function _t_createTag_lora(name: string, props?: ITestPromptTagProps): IGenPromptTag {
	return _t_createTag_core(EnumPromptTagType.lora, `<lora:${name}:1>`, { ...props, isLora: true })
}
