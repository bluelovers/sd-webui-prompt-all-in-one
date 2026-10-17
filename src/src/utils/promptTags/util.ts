import { ITSAnyOfUnion } from 'ts-type';
import { EnumPromptTagType, IPromptTag } from './tag-types';

export function tagIsLoraLike(item?: IPromptTag): item is IPromptTag & ITSAnyOfUnion<{ isLora: true; } | { isLyco: true }>
{
	return item?.isLora || item?.isLyco
}

export function tagIsWrap(item?: IPromptTag): item is IPromptTag & { type: EnumPromptTagType.wrap }
{
	return item?.type === EnumPromptTagType.wrap
}

export function tagIsBreak(item?: IPromptTag): item is IPromptTag & { value: EnumPromptTagType.BREAK }
{
	return item?.value?.trim() === EnumPromptTagType.BREAK
}
