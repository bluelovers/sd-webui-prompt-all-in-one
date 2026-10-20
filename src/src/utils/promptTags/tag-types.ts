import type { ITSAnyOfUnion, ITSUnionToOptional, ITSNullable, ITSTypeAndStringLiteral } from 'ts-type'

export const enum EnumPromptTagType
{
	lora = 'lora',
	lyco = 'lyco',
	wrap = 'wrap',

	text = 'text',

	/* =============== */

	/** when value is "BREAK" */
	VALUE_BREAK = 'BREAK',
	/** when value is "#" */
	VALUE_SHARP = '#',

	/** when value is "\n" */
	VALUE_NEWLINE = '\n',
}

export const enum EnumIsEnglish
{
	NOT_ENGLISH = 0,
	ENGLISH = 1,
	UNKNOWN = -1,
}

export type IPromptTagType = EnumPromptTagType.lora | EnumPromptTagType.lyco | EnumPromptTagType.wrap | EnumPromptTagType.text;

export type IPromptTagValueEnum = Exclude<EnumPromptTagType, IPromptTagType>;
export type IPromptTagValue = ITSTypeAndStringLiteral<IPromptTagValueEnum> | (string & {});

/**
 * src/src/mixins/phystonPrompt/tagMixin.js
 * RESTOREABLE_PROPERTIES
 */
export interface IPromptTagRuntimeExtraProps
{
	splitNoComma?: boolean;
}

export interface IPromptTagRuntimeProps
{
	weightNum?: number;
	incWeight?: number;
	decWeight?: number;
}

export interface IPromptTag extends IPromptTagRuntimeExtraProps, IPromptTagRuntimeProps
{
	type: IPromptTagType;
	value: IPromptTagValue;
	originalValue?: string;

	disabled?: boolean;

	isLora?: boolean;
	loraExists?: boolean;
	loraName?: string;

	isLyco?: boolean;
	lycoExists?: boolean;
	lycoName?: string;

	isEmbedding?: boolean;
	embeddingName?: string;
}

export interface IPromptTagWithLocal extends IPromptTag
{
	toLocal?: boolean;
	localValue?: string;
	isEnglish?: EnumIsEnglish;
}
