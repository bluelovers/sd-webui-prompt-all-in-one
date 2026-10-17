import type { ITSAnyOfUnion, ITSUnionToOptional, ITSNullable } from 'ts-type'

export const enum EnumPromptTagType
{
	lora = 'lora',
	lyco = 'lyco',
	wrap = 'wrap',
	/** when value is "BREAK" */
	BREAK = 'BREAK',
}

export const enum EnumIsEnglish
{
	NOT_ENGLISH = 0,
	ENGLISH = 1,
	UNKNOWN = -1,
}

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
	value: string | EnumPromptTagType.BREAK;
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
