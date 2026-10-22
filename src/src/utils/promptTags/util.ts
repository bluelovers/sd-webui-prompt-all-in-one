import { ITSAnyOfUnion } from 'ts-type';
import { EnumPromptTagType, IPromptTag } from './tag-types';

export function tagIsLoraLike(tag?: IPromptTag): tag is IPromptTag & ITSAnyOfUnion<{ isLora: true; } | { isLyco: true }>
{
	return tag?.isLora || tag?.isLyco
}

export function tagIsWrap(tag?: IPromptTag): tag is IPromptTag & { type: EnumPromptTagType.wrap }
{
	return tag?.type === EnumPromptTagType.wrap
}

export function tagIsBreak(tag?: IPromptTag): tag is IPromptTag & { value: EnumPromptTagType.VALUE_BREAK }
{
	return tag?.value?.trim() === EnumPromptTagType.VALUE_BREAK
}

export function tagIsDisabled(tag?: IPromptTag): tag is IPromptTag & { disabled: true }
{
	return tag?.disabled!
}

export function tagIsEmbedding(tag?: IPromptTag): tag is IPromptTag & { isEmbedding: true }
{
	return tag?.isEmbedding!
}

export function tagIsExtraNetworks(tag?: IPromptTag): tag is IPromptTag & ITSAnyOfUnion<{ isLora: true } | { isLyco: true } | { isEmbedding: true }>
{
	return tagIsLoraLike(tag) || tagIsEmbedding(tag)
}

/**
 * 是否為「#」tag —— 普通 tag，但 value 剛好是 `#`。
 *
 * 注意與 phystonPrompt.vue genPrompt() 的 lineHasSharp 判定不同：
 * 該處檢查 value 以「#」開頭或結尾（含 # 的文字），此處只認 value 純為 `#` 的 tag。
 *
 * @param item - 要判定的 tag
 */
export function tagIsSharp(item?: IPromptTag): item is IPromptTag & { value: EnumPromptTagType.VALUE_SHARP }
{
	return item?.value?.trim() === EnumPromptTagType.VALUE_SHARP
}

export interface IFindTagOptions<T extends IPromptTag>
{
	/** 起始索引（含）*/
	startIndex: number;
	/** 自訂略過條件：回傳 true 則跳過該 tag */
	ignore?: (tag: T, index: number, tags: readonly T[]) => boolean;
	/** 是否略過 disabled 的 tag */
	ignoreDisabled?: boolean;
	/** 停止點判定：第一個未被略過的 tag 是否為目標 */
	untilTarget: (tag: T, index: number, tags: readonly T[]) => boolean;
}

export interface IFindTagResult<T extends IPromptTag>
{
	/** 是否有搜尋到目標 */
	found: boolean;
	/** 停止時的 index（無可停 tag 時為 tags.length） */
	index: number;
	/** 停止時的 tag，無則 null */
	tag: T | undefined;
	/** 被略過的 tag 數量 */
	ignoredCount: number;
	/** 被略過的行數 */
	linesCount: number;
	/** 傳入的起點 */
	startIndex: number;
}

/**
 * 由 startIndex 向前掃描標籤：略過 ignore() / ignoreDisabled 指定的 tag，
 * 停在第一個「未被略過」的 tag，並回報它是否為 untilTarget() 所指的目標。
 *
 * Scan forward from startIndex: skip tags flagged by ignore() / ignoreDisabled,
 * stop at the first non-skipped tag, and report whether it matches untilTarget().
 *
 * 三種結束情形 / three ways to finish:
 *   1. 停在第一個未被略過的 tag，found = untilTarget(tag) / stopped at first non-skipped tag
 *   2. 所有剩餘 tag 皆被略過 → found=false、tag=null、index=tags.length / all remaining skipped
 *   3. startIndex 已超出陣列 → found=false、tag=null、index=startIndex / startIndex out of range
 *
 * 設計與原 _shouldRemoveCommaByAutoOptimize() 內嵌迴圈等價：該迴圈略過分行 tag 後，
 * 只檢查緊接的第一個非分行 tag 是否為 BREAK，不會繼續往後找，故此處亦停在第一個未略過者。
 *
 * @param tags    - 要掃描的標籤陣列 / tag array to scan
 * @param options - 起點與略過、目標條件 / start point, skip and target predicates
 */
export function findTagUntil<T extends IPromptTag>(
	tags: readonly T[],
	options: IFindTagOptions<T>,
): IFindTagResult<T>
{
	const { startIndex, ignore, ignoreDisabled, untilTarget } = options
	const total = tags.length
	let index = startIndex < 0 ? 0 : startIndex
	let ignoredCount = 0
	let linesCount = 0

	let tag: T

	while (index < total)
	{
		tag = tags[index]
		const skipped = (ignoreDisabled && tagIsDisabled(tag)) || !!ignore?.(tag, index, tags)
		if (skipped)
		{
			if (tagIsWrap(tag)) {
				linesCount++
			}
			ignoredCount++
			index++
			continue
		}

		return {
			found: !!untilTarget(tag, index, tags),
			index,
			tag,
			ignoredCount,
			linesCount,
			startIndex,
		}
	}

	return {
		found: false,
		index,
		tag,
		ignoredCount,
		linesCount,
		startIndex,
	}
}
