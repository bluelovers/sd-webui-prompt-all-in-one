/**
 * promptOptions 模組的型別定義。
 */
import type { ITSTypeAndStringLiteral } from 'ts-type'

/**
 * 實際會 emit 該選項 v-model 事件（update:key）的子元件。
 * Child components that actually emit the option's v-model event (update:key).
 *
 * Note：Vue 3 的 emits 僅是宣告/排除 $attrs 穿透，$emit 未宣告仍可觸達父層；
 * 因此 emits 宣告應只列「實際會 emit」的事件，其餘（僅由父層 prop 傳入）不宣告。
 */
export const enum EnumPromptOptionComponent {
    phystonPrompt = 'phystonPrompt',
    promptFormat = 'promptFormat',
}

/**
 * 實際會 emit 該選項 v-model 事件（update:key）的子元件。
 *
 * 相容於 js 調用
 */
export type IPromptOptionComponent = ITSTypeAndStringLiteral<EnumPromptOptionComponent>

/**
 * 選項儲存完成後的後續動作。
 * Follow-up action executed after an option value is persisted.
 */
export const enum EnumPromptOptionAfterSave {
    /** 僅儲存 (Persist)，不重新產生輸出 */
    saveOnly = 'saveOnly',
    /** 儲存後對所有 prompt 執行 updatePrompt() */
    updatePrompt = 'updatePrompt',
    /** 儲存後先重新分割 tags 陣列，再重新產生輸出 */
    resplitAndPrompt = 'resplitAndPrompt',
}

/**
 * 選項儲存完成後的後續動作。
 *
 * 相容於 js 調用
 */
export type IPromptOptionAfterSave = ITSTypeAndStringLiteral<EnumPromptOptionAfterSave>

/**
 * 單一「prompts 系列選項」的定義。
 *
 * 一筆定義同時驅動：App.vue 的 data() / watch / dataListsKeys / init()，
 * 以及 phystonPrompt.vue 與 promptFormat.vue 的 props、emits。
 */
export interface IPromptOptionDefinitionCore {
    /**
     * App.vue data() 的預設值。
     */
    dataDefault: boolean
    /**
     * 子元件 props 的預設值（父層未傳入時套用）。
     */
    propDefault: boolean
    /**
     * 儲存完成後的後續動作。
     * Follow-up action after the value is persisted.
     */
    afterSave: IPromptOptionAfterSave
    /**
     * 實際會 emit 此選項 v-model 事件的子元件（決定 emits 宣告，不影響 props）。
     */
    emittedBy: readonly IPromptOptionComponent[]
    /**
     * 選項行為說明，僅供維護者閱讀，不影響執行。
     */
    note: string
}

/**
 * Vue watch 選項物件（產生器輸出型別）。
 */
export interface IPromptOptionWatcher {
    handler: (this: unknown, value: boolean, oldValue: boolean) => void
    immediate: boolean
}

/**
 * Vue props 定義物件（產生器輸出型別）。
 */
export interface IPromptOptionPropBoolean {
    type: BooleanConstructor
    default: boolean
}
