/**
 * promptOptions 模組入口：由 definitions.ts 生成各元件所需的樣板資料。
 *
 * 生成目標:
 *   - App.vue data() 預設值            → getPromptOptionData()
 *   - App.vue watch                    → getPromptOptionWatchers()
 *   - App.vue init() dataListsKeys     → promptOptionStorageKeys
 *   - App.vue init() 載入回填          → loadPromptOptions()
 *   - phystonPrompt.vue props          → getPromptOptionProps()
 *   - promptFormat.vue props / emits  → getPromptOptionProps() / getPromptOptionEmits('promptFormat')
 */

import { IPromptOptionKey, IPromptOptionKeyAndLegacyStorage, IPromptOptionKeyLegacyStorage, IPromptOptionValue, promptOptions } from './definitions'
import { EnumPromptOptionAfterSave, type IPromptOptionComponent, type IPromptOptionPropBoolean, type IPromptOptionWatcher } from './types'

export { promptOptions } from './definitions'
export type { IPromptOptionAfterSave, IPromptOptionComponent, IPromptOptionPropBoolean as IPromptOptionProp, IPromptOptionWatcher } from './types'

/**
 * watcher handler 內部所需的 App 實例最小結構。
 */
interface I_PromptOptionWatchHost {
    startWatchSave: boolean
    gradioAPI: { setData: (key: string, value: unknown) => Promise<unknown> }
    prompts: ReadonlyArray<{ id: string }>
    $refs: Record<string, Array<{ applySplitByPeriod: () => void; updatePrompt: () => void }>>
}

/**
 * 生成 App.vue data() 使用的預設值表。
 *
 * 預設值來自定義的 dataDefault（可能與子元件 propDefault 不同，如 autoRemoveSpace）。
 */
export function getPromptOptionData(): Record<IPromptOptionKey, boolean> {
    const data = {} as Record<IPromptOptionKey, boolean>
    for (const option of promptOptions) {
        data[option.key] = option.dataDefault
    }
    return data
}

/**
 * 生成 App.vue watch 使用的監聽器表。
 *
 * 行為由 afterSave 決定：
 *   saveOnly          → 僅儲存（原樣保留原行為）
 *   updatePrompt      → 儲存後對所有 prompt 執行 updatePrompt()
 *   resplitAndPrompt  → 儲存後先 applySplitByPeriod() 再 updatePrompt()
 */
export function getPromptOptionWatchers(): Record<IPromptOptionKey, IPromptOptionWatcher> {
    const watchers = {} as Record<IPromptOptionKey, IPromptOptionWatcher>
    for (const option of promptOptions) {
        watchers[option.key] = {
            handler: function (this: I_PromptOptionWatchHost, value: boolean) {
                if (!this.startWatchSave) return
                console.log(`on${option.key}Change`, value)
                this.gradioAPI.setData(option.key, value).then(() => {
                    if (option.afterSave === EnumPromptOptionAfterSave.saveOnly) return
                    this.prompts.forEach(item => {
                        const promptRef = this.$refs[item.id] && this.$refs[item.id][0]
                        if (!promptRef) return
                        if (option.afterSave === EnumPromptOptionAfterSave.resplitAndPrompt) promptRef.applySplitByPeriod()
                        promptRef.updatePrompt()
                    })
                }).catch(() => {
                })
            },
            immediate: false,
        }
    }
    return watchers
}

/**
 * dataListsKeys 需要的存檔鍵（含遷移用舊鍵）。
 */
export const promptOptionStorageKeys = promptOptions.flatMap(option =>
    [option.key, ...(option.legacyStorageKeys ?? [])] satisfies IPromptOptionKeyAndLegacyStorage[],
)

/**
 * 將 getDatas() 回傳的資料回填到目標物件（App.vue init() 內使用）。
 *
 * 任一選項主鍵為空時，依序嘗試其 legacyStorageKeys（舊鍵遷移）；
 * 主鍵與舊鍵皆為空則保留預設值。語義等同原本逐鍵的 if (data.x !== null) 區塊。
 */
export function loadPromptOptions(target: Record<IPromptOptionKey, IPromptOptionValue>, data: Record<IPromptOptionKeyAndLegacyStorage, IPromptOptionValue>): void {
    for (const option of promptOptions) {
        let value = data[option.key]
        if (value === null || value === undefined) {
            for (const legacyKey of option.legacyStorageKeys ?? []) {
                const legacyValue = data[legacyKey]
                if (legacyValue !== null && legacyValue !== undefined) {
                    value = legacyValue
                    break
                }
            }
        }
        if (value === null || value === undefined) continue
        target[option.key] = value
    }
}

/**
 * 生成子元件（phystonPrompt.vue / promptFormat.vue）的 props 表。
 *
 * 所有 prompts 系列選項皆為 Boolean；預設值取自 propDefault。
 */
export function getPromptOptionProps() {
    const props = {} as Record<IPromptOptionKey, IPromptOptionPropBoolean>
    for (const option of promptOptions) {
        props[option.key] = {type: Boolean, default: option.propDefault}
    }
    return props
}

/**
 * 生成指定子元件的 emits（v-model 事件名 'update:key'）。
 *
 * 僅列入該元件實際會 emit 的選項（definitions 的 emittedBy）：
 * Vue 3 的 emits 是宣告而非開關——未宣告的 $emit 仍會觸達父層，
 * 因此宣告應反映「實際用途」，避免維護一份會與現實脫節的清單。
 */
export function getPromptOptionEmits(component: IPromptOptionComponent) {
    return promptOptions
        .filter(option => option.emittedBy.includes(component))
        .map(option => `update:${option.key}` as const)
}
