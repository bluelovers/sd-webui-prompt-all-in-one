/**
 * prompt tag 的顯示 HTML 渲染工具。
 *
 * 欄位 incWeight / decWeight / value 由 tagMixin._setTag() 維護，
 * 本檔只讀取這些欄位組出顯示用 HTML，不修改 tag 本身。
 *
 * @module utils/promptTagRender/renderTag
 */

import common from "@/utils/common";
import { IPromptTag } from "../promptTags/tag-types";
import { IPromptOptionValueRecordWithLegacyRuntime } from '../promptOptions/definitions';
import { tagIsBreak, tagIsSharp } from '../promptTags/util';

export const enum EnumTagWeightSymbol
{
	/** NovelAI 的權重符號 options.useNovelAiWeightSymbol = true 時使用 */
	NovelAiWeightSymbolOpen = '{',
	NovelAiWeightSymbolClose = '}',

	/** 一般模型的權重符號 */
	IncWeightSymbolOpen = '(',
	IncWeightSymbolClose = ')',


	DecWeightSymbolOpen = '[',
	DecWeightSymbolClose = ']',
}

export interface ICharactersOptions
{
	tag: IPromptTag;
	className?: string;
}

export interface IWrapWeightCharactersOptions extends ICharactersOptions
{
	count: number;
	open: string;
	close: string;
	isDecWeight?: boolean;
}

/** BREAK 的固定顯示內容：左右虛線夾住 BREAK 字樣；不含使用者輸入，無須 escape */
const BREAK_HTML = '<div class="break-character">---------------------</div> <div class="character">BREAK</div> <div class="break-character">---------------------</div>'

/**
 * 以權重符號包住已移除外層括號的 value：
 * start / end 顯示重複的權重符號，中間 character 顯示原文。
 *
 * @param value - 已經 setLayers() 移除外層括號的 HTML
 * @param count - 權重符號的重複次數
 * @param open  - 開括號字元
 * @param close - 閉括號字元
 * @returns 組合後的 HTML
 */
function wrapWeightCharacters(value: string, options: IWrapWeightCharactersOptions): string
{
	let className = 'weight-character'
	if (options.isDecWeight)
	{
		className += ' dec-weight-character'
	}
	if (options.className?.length)
	{
		className += ' ' + options.className
	}
	const start = `<div class="${className}">${options.open.repeat(options.count)}</div>`
	const end = `<div class="${className}">${options.close.repeat(options.count)}</div>`
	return start + wrapCharacters(value, options) + end
}

function wrapCharacters(value: string, options?: ICharactersOptions): string
{
	let className = 'character'
	if (options?.className?.length)
	{
		className += ' ' + options.className
	}
	return `<div class="${className}">${value}</div>`
}

/**
 * 將單一 tag 渲染為顯示用 HTML。
 *
 * - 找不到 tag 回傳空字串。
 * - BREAK 以嚴格相等判定（不 trim），僅在 autoBreakBeforeWrap /
 *   autoBreakAfterWrap 任一開啟時改渲染成分隔線；
 *   與 promptTags/util 的 tagIsBreak()（trim 後比對）刻意不同。
 * - 權重：incWeight > 0 依 useNovelAiWeightSymbol 選用 {} 或 ()，
 *   decWeight > 0 固定選用 []，兩者皆為 0 時只包一層 character。
 * - 其餘 value 先經 escapeHtml，避免標籤內容中的 HTML 破壞版面。
 *
 * @param tag     - 要渲染的 tag；undefined 時回傳空字串
 * @param options - 渲染旗標
 * @returns 顯示用 HTML
 */
export function renderTagCore(tag: IPromptTag | undefined, options: IPromptOptionValueRecordWithLegacyRuntime): string
{
	if (!tag) return ''

	let value = tag.value
	if (tagIsBreak(tag) && (options.autoBreakBeforeWrap || options.autoBreakAfterWrap))
	{
		value = BREAK_HTML
	}
	else
	{
		value = common.escapeHtml(value)
		if (tag.incWeight > 0)
		{
			/** NovelAI 用 {}，其餘用 () */
			const open = options.useNovelAiWeightSymbol ? EnumTagWeightSymbol.NovelAiWeightSymbolOpen : EnumTagWeightSymbol.IncWeightSymbolOpen
			const close = options.useNovelAiWeightSymbol ? EnumTagWeightSymbol.NovelAiWeightSymbolClose : EnumTagWeightSymbol.IncWeightSymbolClose
			value = wrapWeightCharacters(common.setLayers(value, 0, open, close), {
				count: tag.incWeight,
				open,
				close,
				tag,
			})
		}
		else if (tag.decWeight > 0)
		{
			/** NovelAI 用 {}，其餘用 () */
			const open = EnumTagWeightSymbol.DecWeightSymbolOpen
			const close = EnumTagWeightSymbol.DecWeightSymbolClose
			value = wrapWeightCharacters(common.setLayers(value, 0, open, close), {
				count: tag.decWeight,
				open,
				close,
				tag,
				isDecWeight: true,
			})
		}
		else
		{
			let opts: ICharactersOptions = {
				tag,
			}
			if (tagIsSharp(tag))
			{
				opts.className = 'sharp-character'
			}
			value = wrapCharacters(value, opts)
		}
	}
	return value
}
