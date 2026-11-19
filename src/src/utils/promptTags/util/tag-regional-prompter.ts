
/**
 * sd-webui-regional-prompter 行尾關鍵字判定：擴充將區域分割指令以「空白 + 關鍵字」
 * 形式置於 tag value 字尾，指令完成該行語意後不再接逗號；
 * genPrompt 換行前的逗號判定即以本模組的字尾判定為依據。
 *
 * @module utils/promptTags/util/tag-regional-prompter
 */
import { EnumPromptTagType, IPromptTagRegionalPrompterKeyword, IPromptTagValue } from '../tag-types'

/** tag value 字尾的觸發關鍵字聯合型別 (Union Type)：BREAK 與 regional prompter 區域分割指令同屬行尾關鍵字 */
export type IRegionalPrompterKeywordTrigger = EnumPromptTagType.VALUE_KEYWORD_BREAK | IPromptTagRegionalPrompterKeyword

/**
 * 區域分割關鍵字清單：endsWith 版與 RegExp 版的比對皆由此清單產生，
 * 新增關鍵字時兩版同時生效。
 */
const REGIONAL_PROMPTER_KEYWORDS = [
	EnumPromptTagType.VALUE_KEYWORD_BREAK,
	EnumPromptTagType.VALUE_KEYWORD_RP_ADDCOL,
	EnumPromptTagType.VALUE_KEYWORD_RP_ADDROW,
	EnumPromptTagType.VALUE_KEYWORD_RP_ADDCOMM,
	EnumPromptTagType.VALUE_KEYWORD_RP_ADDBASE,
] as const satisfies readonly IRegionalPrompterKeywordTrigger[]

/**
 * 行尾關鍵字比對式：所有關鍵字以 (...) 分組後接 $，使每個分支皆錨定字尾
 */
const regionalPrompterKeywordRegex = new RegExp(` (${REGIONAL_PROMPTER_KEYWORDS.join('|')})$`)

/**
 * 判斷 value 是否以「空白 + 區域關鍵字」結尾——Regional Prompter 指令置於行尾時，
 * 該行語意已完成，其後不應再接逗號。
 *
 * @param tagValue - 待判定的 tag value
 * @returns 以任一關鍵字結尾時為 true，並收窄為對應的字尾字面型別 (Literal Type)
 *
 * @deprecated 改用 _endWithRegionalPrompterKeywordRegex 效能更佳
 */
export function _endWithRegionalPrompterKeyword(tagValue: string): tagValue is `${string} ${IRegionalPrompterKeywordTrigger}`
{
	return REGIONAL_PROMPTER_KEYWORDS.some(keyword => tagValue.endsWith(' ' + keyword))
}

/**
 * 字尾判定的正規表示式 (Regular Expression) 版本，與 _endWithRegionalPrompterKeyword 語意等價、可互換。
 * 比對為編譯後的單次字尾掃描，無逐關鍵字的字串串接與函式呼叫開銷，效能較高。
 *
 * @param tagValue - 待判定的 tag value
 * @returns 以任一關鍵字結尾時為 true，並收窄為對應的字尾字面型別 (Literal Type)
 */
export function _endWithRegionalPrompterKeywordRegex(tagValue: IPromptTagValue): tagValue is `${string} ${IRegionalPrompterKeywordTrigger}`
{
	return regionalPrompterKeywordRegex.test(tagValue)
}

/**
 * 精確比對：value（呼叫端需已 trim）是否恰為區域關鍵字。
 * splitRaw 分段切割時用於「關鍵字位於段首」（如 "ADDCOL bird"）的判定。
 *
 * @param value - 已 trim 的待判定文字
 */
export function _isRegionalPrompterKeyword(value: IPromptTagValue): value is IRegionalPrompterKeywordTrigger
{
	return REGIONAL_PROMPTER_KEYWORDS.includes(value as IRegionalPrompterKeywordTrigger)
}

/**
 * 回傳 value 字尾「空白 + 關鍵字」命中的關鍵字；未命中回傳 null。
 * splitRaw 據此把 "cat ADDCOL" 切為 ["cat", "ADDCOL"]（與 BREAK 既有切割一致）。
 *
 * @param value - 待判定的累積文字（未 trim）
 */
export function _matchRegionalPrompterKeywordSuffix(value: IPromptTagValue): IRegionalPrompterKeywordTrigger
{
	const match = regionalPrompterKeywordRegex.exec(value)
	return match?.[1] as IRegionalPrompterKeywordTrigger
}
