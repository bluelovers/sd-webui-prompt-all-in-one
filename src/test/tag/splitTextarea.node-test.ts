/**
 * splitTextarea.node-test.ts
 *
 * splitTextareaCore 與停用標籤定位的單元測試。
 *
 * 斷言規則：每個案例以 expected 直接鎖定行為意圖；
 * 快照僅作回歸紀錄，不得作為斷言使用（記錄結果 ≠ 驗證意圖）。
 *
 * 分組：
 *   1. collectDisabledContexts — 收集停用標籤的前後相鄰與行位置
 *   2. resolveDisabledPosition — 三層定位策略（前後 → 前 , 後 → 行號 , index）
 *   3. splitTextareaCore — 停用標籤經重建後插回原位的整合行為
 */

import { describe, it } from 'node:test'
import {
    collectDisabledContexts,
    resolveDisabledPosition,
    splitTextareaCore,
    type IDisabledTagContext,
    type ISplitTextareaHost,
} from '@/utils/promptTags/splitTextarea'
import type { IPromptTag, IPromptTagValue } from '@/utils/promptTags/tag-types'
import { _t_createTag_text, _t_createTag_wrap } from '../helpers/tag-factories'

/** 建立定位脈絡的簡寫，未指定欄位以「無相鄰、第 0 行第 0 個」預設 */
function ctx(partial: Partial<IDisabledTagContext>): IDisabledTagContext {
    return { value: 'X', prevValue: null, nextValue: null, line: 0, indexInLine: 0, ...partial }
}

/* ====================================================================
 *  1. collectDisabledContexts
 * ==================================================================== */

describe('collectDisabledContexts', () => {
    it('無停用標籤 → 空陣列', (t) => {
        const tags = [_t_createTag_text('a'), _t_createTag_wrap(), _t_createTag_text('b')]
        const result = collectDisabledContexts(tags)
        t.assert.deepEqual(result, [])
        t.assert.snapshot({ input: tags, result })
    })

    it('單一停用標籤 — 記錄前後 value 與行內位置', (t) => {
        const tags = [
            _t_createTag_text('a'),
            _t_createTag_text('X', { disabled: true }),
            _t_createTag_text('b'),
        ]
        const result = collectDisabledContexts(tags)
        t.assert.deepEqual(result, [
            { value: 'X', prevValue: 'a', nextValue: 'b', line: 0, indexInLine: 1 },
        ])
        t.assert.snapshot({ input: tags, result })
    })

    it('開頭停用 — prevValue 為 null；結尾停用 — nextValue 為 null', (t) => {
        const tags = [
            _t_createTag_text('X', { disabled: true }),
            _t_createTag_text('a'),
            _t_createTag_text('Y', { disabled: true }),
        ]
        const result = collectDisabledContexts(tags)
        t.assert.deepEqual(result, [
            { value: 'X', prevValue: null, nextValue: 'a', line: 0, indexInLine: 0 },
            { value: 'Y', prevValue: 'a', nextValue: null, line: 0, indexInLine: 2 },
        ])
        t.assert.snapshot({ input: tags, result })
    })

    it('換行後的停用 — line 推進、indexInLine 以行首起算', (t) => {
        const tags = [
            _t_createTag_text('a'),
            _t_createTag_wrap(),
            _t_createTag_text('X', { disabled: true }),
            _t_createTag_text('b'),
        ]
        const result = collectDisabledContexts(tags)
        t.assert.deepEqual(result, [
            { value: 'X', prevValue: '\n', nextValue: 'b', line: 1, indexInLine: 0 },
        ])
        t.assert.snapshot({ input: tags, result })
    })
})

/* ====================================================================
 *  2. resolveDisabledPosition — 三層策略
 * ==================================================================== */

describe('resolveDisabledPosition', () => {
    it('策略 1：前後皆吻合 → 插在二者之間', (t) => {
        const input = { ctx: ctx({ prevValue: 'a', nextValue: 'b' }), tagValues: ['a', 'b'] }
        const result = resolveDisabledPosition(input.ctx, input.tagValues)
        t.assert.equal(result, 1)
        t.assert.snapshot({ input, result })
    })

    it('策略 1：prevValue 為 null → 插在開頭', (t) => {
        const input = { ctx: ctx({ prevValue: null, nextValue: 'a' }), tagValues: ['a', 'b'] }
        const result = resolveDisabledPosition(input.ctx, input.tagValues)
        t.assert.equal(result, 0)
        t.assert.snapshot({ input, result })
    })

    it('策略 1：nextValue 為 null → 插在結尾', (t) => {
        const input = { ctx: ctx({ prevValue: 'b', nextValue: null }), tagValues: ['a', 'b'] }
        const result = resolveDisabledPosition(input.ctx, input.tagValues)
        t.assert.equal(result, 2)
        t.assert.snapshot({ input, result })
    })

    it('策略 2：僅前側吻合 → 插在前一個之後', (t) => {
        const input = { ctx: ctx({ prevValue: 'a', nextValue: 'gone' }), tagValues: ['a', 'c'] }
        const result = resolveDisabledPosition(input.ctx, input.tagValues)
        t.assert.equal(result, 1)
        t.assert.snapshot({ input, result })
    })

    it('策略 2：僅後側吻合 → 插在後一個之前', (t) => {
        const input = { ctx: ctx({ prevValue: 'gone', nextValue: 'c' }), tagValues: ['a', 'c'] }
        const result = resolveDisabledPosition(input.ctx, input.tagValues)
        t.assert.equal(result, 1)
        t.assert.snapshot({ input, result })
    })

    it('策略 3：前後皆不吻合 → 依行號與行內序號', (t) => {
        const input = {
            ctx: ctx({ prevValue: 'gone', nextValue: 'alsoGone', line: 1, indexInLine: 0 }),
            tagValues: ['a', '\n', 'b'],
        }
        const result = resolveDisabledPosition(input.ctx, input.tagValues)
        t.assert.equal(result, 2)
        t.assert.snapshot({ input, result })
    })

    it('策略 3：行不存在 → 附加到陣列末尾', (t) => {
        const input = {
            ctx: ctx({ prevValue: 'gone', nextValue: 'alsoGone', line: 5, indexInLine: 0 }),
            tagValues: ['a'],
        }
        const result = resolveDisabledPosition(input.ctx, input.tagValues)
        t.assert.equal(result, 1)
        t.assert.snapshot({ input, result })
    })

    it('策略 3：indexInLine 超出行尾 → 夾在行尾', (t) => {
        const input = {
            ctx: ctx({ prevValue: 'gone', nextValue: 'alsoGone', line: 0, indexInLine: 99 }),
            tagValues: ['a', 'b', '\n', 'c'],
        }
        const result = resolveDisabledPosition(input.ctx, input.tagValues)
        t.assert.equal(result, 2)
        t.assert.snapshot({ input, result })
    })

    it('同層多候選 — 優先取原行號者', (t) => {
        const input = {
            ctx: ctx({ prevValue: 'a', nextValue: 'b', line: 1 }),
            tagValues: ['a', 'b', '\n', 'a', 'b'],
        }
        const result = resolveDisabledPosition(input.ctx, input.tagValues)
        t.assert.equal(result, 4)
        t.assert.snapshot({ input, result })
    })

    it('同層多候選 — 無原行號者取最前者', (t) => {
        const input = {
            ctx: ctx({ prevValue: 'a', nextValue: 'b', line: 9 }),
            tagValues: ['a', 'b', '\n', 'a', 'b'],
        }
        const result = resolveDisabledPosition(input.ctx, input.tagValues)
        t.assert.equal(result, 1)
        t.assert.snapshot({ input, result })
    })
})

/* ====================================================================
 *  3. splitTextareaCore 整合 — 停用標籤插回
 * ==================================================================== */

/** 宿主替身：記錄 restoreTag / appendWrapTag 的呼叫序列 */
function createHost(opts: {
    value: string
    prompt: string
    tags: IPromptTag[]
}): { host: ISplitTextareaHost; restored: { value: IPromptTagValue; source: IPromptTag | null }[] } {
    const restored: { value: IPromptTagValue; source: IPromptTag | null }[] = []
    const host: ISplitTextareaHost = {
        value: opts.value,
        prompt: opts.prompt,
        options: {},
        tags: opts.tags,
        clearTags: () => { /* 替身不持有陣列，重建結果全由 restored 呈現 */ },
        appendWrapTag: () => { restored.push({ value: '\n', source: null }) },
        restoreTag: (value, source) => {
            restored.push({ value, source })
            return restored.length - 1
        },
    }
    return { host, restored }
}

describe('splitTextareaCore — 停用標籤還原', () => {
    it('輸入未變動 → changed=false 且不重建', (t) => {
        const opts = {
            value: 'a, b',
            prompt: 'a, b',
            tags: [_t_createTag_text('a'), _t_createTag_text('b')],
        }
        const { host, restored } = createHost(opts)
        const result = splitTextareaCore(host)
        t.assert.equal(result.changed, false)
        t.assert.equal(restored.length, 0)
        t.assert.snapshot({ input: opts, changed: result.changed, restored })
    })

    it('停用標籤不在輸入中 — 依前後相鄰插回原位', (t) => {
        const disabled = _t_createTag_text('X', { disabled: true })
        const opts = {
            value: 'a, b',
            prompt: 'a, X, b',
            tags: [_t_createTag_text('a'), disabled, _t_createTag_text('b')],
        }
        const { host, restored } = createHost(opts)
        const result = splitTextareaCore(host)
        t.assert.equal(result.changed, true)
        t.assert.deepEqual(
            restored.map(r => r.value),
            ['a', 'X', 'b'],
        )
        /** 還原時以舊標籤為來源，disabled 等屬性才會被帶回 */
        t.assert.equal(restored[1].source, disabled)
        t.assert.snapshot({ input: opts, changed: result.changed, values: restored.map(r => r.value) })
    })

    it('前側相鄰已被刪除 — 退而只比後側，仍插在後一個之前', (t) => {
        const opts = {
            value: 'b',
            prompt: 'a, X, b',
            tags: [
                _t_createTag_text('a'),
                _t_createTag_text('X', { disabled: true }),
                _t_createTag_text('b'),
            ],
        }
        const { host, restored } = createHost(opts)
        const result = splitTextareaCore(host)
        t.assert.deepEqual(
            restored.map(r => r.value),
            ['X', 'b'],
        )
        t.assert.snapshot({ input: opts, changed: result.changed, values: restored.map(r => r.value) })
    })

    it('停用標籤跨行 — 依行號插在換行之後', (t) => {
        const opts = {
            value: 'a\nb',
            prompt: 'a\nX\nb',
            tags: [
                _t_createTag_text('a'),
                _t_createTag_wrap(),
                _t_createTag_text('X', { disabled: true }),
                _t_createTag_text('b'),
            ],
        }
        const { host, restored } = createHost(opts)
        const result = splitTextareaCore(host)
        t.assert.deepEqual(
            restored.map(r => r.value),
            ['a', '\n', 'X', 'b'],
        )
        t.assert.snapshot({ input: opts, changed: result.changed, values: restored.map(r => r.value) })
    })

    it('前後皆比不到 — 退回行號定位，行不存在時附加到末尾', (t) => {
        const opts = {
            value: 'd',
            prompt: 'a, X, c',
            tags: [
                _t_createTag_text('a'),
                _t_createTag_text('X', { disabled: true }),
                _t_createTag_text('c'),
            ],
        }
        const { host, restored } = createHost(opts)
        const result = splitTextareaCore(host)
        t.assert.deepEqual(
            restored.map(r => r.value),
            ['d', 'X'],
        )
        t.assert.snapshot({ input: opts, changed: result.changed, values: restored.map(r => r.value) })
    })

    it('同 value 部分停用 — 文字槽位只比對啟用標籤，停用槽位沿用原標籤', (t) => {
        const disabledHash = _t_createTag_text('#', { disabled: true })
        const enabledHash = _t_createTag_text('#')
        const opts = {
            value: 'a, #',
            prompt: '#',
            tags: [disabledHash, enabledHash],
        }
        const { host, restored } = createHost(opts)
        const result = splitTextareaCore(host)
        t.assert.equal(result.changed, true)
        t.assert.deepEqual(
            restored.map(r => r.value),
            ['#', 'a', '#'],
        )
        /** 停用槽位必須帶回原停用標籤；輸入的 '#' 只能比對到啟用標籤 */
        t.assert.equal(restored[0].source, disabledHash)
        t.assert.equal(restored[1].source, null)
        t.assert.equal(restored[2].source, enabledHash)
        t.assert.snapshot({
            input: opts,
            changed: result.changed,
            values: restored.map(r => r.value),
            sources: restored.map(r => r.source),
        })
    })
})
