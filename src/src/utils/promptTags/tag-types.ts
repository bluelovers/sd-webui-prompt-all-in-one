import type { ITSAnyOfUnion, ITSUnionToOptional, ITSNullable, ITSTypeAndStringLiteral } from 'ts-type'

export const enum EnumPromptTagType
{
	lora = 'lora',
	lyco = 'lyco',
	wrap = 'wrap',

	text = 'text',

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

export type IPromptTagValueEnum = EnumPromptTagType.VALUE_BREAK | EnumPromptTagType.VALUE_SHARP;
export type IPromptTagValue = ITSTypeAndStringLiteral<IPromptTagValueEnum> | (string & {});

/**
 * src/src/mixins/phystonPrompt/tagMixin.js
 * RESTOREABLE_PROPERTIES
 */
export interface IPromptTagExtraProps
{
	splitNoComma?: boolean;
}

export interface IPromptTag extends IPromptTagExtraProps
{
	type: string;
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
