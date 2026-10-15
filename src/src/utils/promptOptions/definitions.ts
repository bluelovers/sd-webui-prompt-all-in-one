/**
 * 「prompts 系列選項」。
 *
 * 這裡的每一筆定義會同時驅動：
 *   - src/src/App.vue              ：data() 預設值、watch、dataListsKeys、init() 載入
 *   - src/src/components/phystonPrompt.vue ：props
 *   - src/src/components/promptFormat.vue  ：props、emits
 *
 * 新增選項時只需在此加入一筆定義（並補上 i18n 與 promptFormat 模板的 checkbox），
 * 無需再逐一修改上述四處樣板碼，避免漏改造成「重新整理後設定遺失」一類的缺陷。
 */

import { EnumPromptOptionAfterSave, EnumPromptOptionComponent, type IPromptOptionDefinitionCore } from './types'

interface I_PromptOptionDefinition extends IPromptOptionDefinitionCore {
    /**
     * 選項鍵名：同時作為 data 鍵、後端存檔鍵與 v-model 名稱。
     */
    key: string
    /**
     * 已更名或棄用的舊存檔鍵（僅供載入遷移讀取，不再寫入）。
     * Legacy storage keys kept read-only for migration on load.
     */
    legacyStorageKeys?: readonly string[]
}

/**
 * prompts 系列選項定義清單（順序即 UI / dataListsKeys 的呈現順序）。
 */
const _promptOptions = [
    {
        key: 'autoRemoveSpace',
        /** App.vue data() 預設為 true */
        dataDefault: true, //
        /** 子元件未傳入時的預設 */
        propDefault: false,
        afterSave: EnumPromptOptionAfterSave.updatePrompt,
        emittedBy: [EnumPromptOptionComponent.phystonPrompt, EnumPromptOptionComponent.promptFormat], // phystonPrompt 頭部選單與 promptFormat checkbox 都有 emit / emitted by both components' UIs
        note: '移除 tag 前後多餘空白；變更後需重新產生輸出。',
    },
    {
        key: 'autoRemoveLastComma',
        dataDefault: false,
        propDefault: false,
        afterSave: EnumPromptOptionAfterSave.updatePrompt,
        emittedBy: [EnumPromptOptionComponent.promptFormat],
        note: '移除輸出結尾多餘逗號；變更後需重新產生輸出。',
    },
    {
        key: 'autoKeepWeightZero',
        dataDefault: false,
        propDefault: false,
        afterSave: EnumPromptOptionAfterSave.saveOnly,
        emittedBy: [EnumPromptOptionComponent.promptFormat],
        note: '權重為 0 時保留 (x:0)；僅需儲存設定。',
    },
    {
        key: 'autoKeepWeightOne',
        dataDefault: false,
        propDefault: false,
        afterSave: EnumPromptOptionAfterSave.saveOnly,
        emittedBy: [], // 兩個子元件都沒有會 emit 此選項的 UI（無 checkbox），屬純 prop 選項 / no UI emits it in either child; prop-only
        note: '權重為 1 時保留 (x:1)；僅需儲存設定。',
    },
    {
        key: 'autoBreakBeforeWrap',
        dataDefault: false,
        propDefault: false,
        afterSave: EnumPromptOptionAfterSave.updatePrompt,
        emittedBy: [EnumPromptOptionComponent.promptFormat],
        note: '分行標籤前自動插入 BREAK；變更後需重新產生輸出。',
    },
    {
        key: 'autoBreakAfterWrap',
        dataDefault: false,
        propDefault: false,
        afterSave: EnumPromptOptionAfterSave.updatePrompt,
        emittedBy: [EnumPromptOptionComponent.promptFormat],
        note: '分行標籤後自動插入 BREAK；變更後需重新產生輸出。',
    },
    {
        key: 'autoRemoveLoraBeforeComma',
        dataDefault: false,
        propDefault: false,
        afterSave: EnumPromptOptionAfterSave.saveOnly,
        emittedBy: [EnumPromptOptionComponent.promptFormat],
        note: '移除 Lora 標籤前的逗號；僅需儲存設定。',
    },
    {
        key: 'autoRemoveLoraAfterComma',
        dataDefault: false,
        propDefault: false,
        afterSave: EnumPromptOptionAfterSave.saveOnly,
        emittedBy: [EnumPromptOptionComponent.promptFormat],
        note: '移除 Lora 標籤後的逗號；僅需儲存設定。',
    },
    {
        key: 'useNovelAiWeightSymbol',
        dataDefault: false,
        propDefault: false,
        afterSave: EnumPromptOptionAfterSave.saveOnly,
        emittedBy: [EnumPromptOptionComponent.promptFormat],
        note: '使用 NovelAI 權重符號（[] 語法）；僅需儲存設定。',
    },
    {
        key: 'autoRemoveBeforeLineComma',
        dataDefault: false,
        propDefault: false,
        afterSave: EnumPromptOptionAfterSave.saveOnly,
        emittedBy: [EnumPromptOptionComponent.promptFormat],
        note: '移除分行標籤前一行結尾的逗號；僅需儲存設定。',
    },
    {
        key: 'autoSplitByPeriod',
        dataDefault: false,
        propDefault: false,
        afterSave: EnumPromptOptionAfterSave.resplitAndPrompt,
        emittedBy: [EnumPromptOptionComponent.promptFormat],
        note: '選項變更時，先分割 tags 陣列，再重新產生輸出。原因：僅呼叫 updatePrompt() 只會在輸出字串層級分割，tags 陣列不會被修改，導致 UI 顯示與輸出不一致，因此需先呼叫 applySplitByPeriod() 同步修改 tags。',
    },
    {
        key: 'autoSplitByPeriodIncludeParen',
        dataDefault: false,
        propDefault: false,
        afterSave: EnumPromptOptionAfterSave.updatePrompt,
        emittedBy: [EnumPromptOptionComponent.promptFormat],
        note: '控制是否允許拆分括號前的 ". "（如 "word1. (test)"）。由於 tags 已在 autoSplitByPeriod 開啟時被分割，此選項的變更不會影響已分割的 tags，僅影響後續新載入標籤的分割行為，因此只需重新產生輸出。',
    },
    {
        key: 'autoSplitByPeriodSemicolon',
        dataDefault: false,
        propDefault: false,
        afterSave: EnumPromptOptionAfterSave.resplitAndPrompt,
        emittedBy: [EnumPromptOptionComponent.promptFormat],
        note: '控制 ";" 是否併入句號機制成為分割點；需重新執行 applySplitByPeriod() 才能將既有含分號的 tag 分割。/ Whether ";" joins the period split points; re-run applySplitByPeriod() to split existing tags.',
    },
    {
        key: 'autoOptimizeSplitSymbol',
        dataDefault: false,
        propDefault: false,
        afterSave: EnumPromptOptionAfterSave.resplitAndPrompt,
        /** 舊存檔鍵遷移：更名前的使用者設定；後續寫入一律走新鍵 */
        legacyStorageKeys: ['autoSplitByPeriodRemoveWrapComma'],
        emittedBy: [EnumPromptOptionComponent.promptFormat],
        note: '自動優化分割符號（獨立選項，不再屬於 autoSplitByPeriod 子選項）。其分行前條件（「:」結尾 / 該行含 # tag / 分行前為 Lora）在 genPrompt() 輸出層直接判定，並影響 splitNoComma 標記，因此需同時 applySplitByPeriod() 與 updatePrompt()。',
    },
    {
        key: 'allowKeepEmptyLine',
        dataDefault: false,
        propDefault: false,
        afterSave: EnumPromptOptionAfterSave.saveOnly,
        emittedBy: [EnumPromptOptionComponent.promptFormat],
        note: '僅影響 prompt 解析階段（splitTags 的連續換行壓縮上限），不影響輸出格式，因此只需儲存設定；下次解析（載入提示詞 / 輸入變動）時生效。',
    },
] as const satisfies I_PromptOptionDefinition[]

type I_PromptOptionEntry = typeof _promptOptions[number]

type I_ExtractLegacyStorageKeys<T> = T extends Pick<I_PromptOptionDefinition, 'legacyStorageKeys'> ? T['legacyStorageKeys'][number] : never

/**
 * 選項鍵名：同時作為 data 鍵、後端存檔鍵與 v-model 名稱。
 */
export type IPromptOptionKey = I_PromptOptionEntry['key']
export type IPromptOptionKeyLegacyStorage = I_ExtractLegacyStorageKeys<I_PromptOptionEntry>
export type IPromptOptionKeyAndLegacyStorage = IPromptOptionKey | IPromptOptionKeyLegacyStorage

export type IPromptOptionValue = I_PromptOptionEntry['dataDefault']

export interface IPromptOptionDefinition extends IPromptOptionDefinitionCore {
    /**
     * 選項鍵名：同時作為 data 鍵、後端存檔鍵與 v-model 名稱。
     */
    key: IPromptOptionKey
    /**
     * 已更名或棄用的舊存檔鍵（僅供載入遷移讀取，不再寫入）。
     */
    legacyStorageKeys?: readonly IPromptOptionKeyLegacyStorage[]
}

/**
 * prompts 系列選項定義清單（順序即 UI / dataListsKeys 的呈現順序）。
 */
export const promptOptions = _promptOptions as readonly IPromptOptionDefinition[]
