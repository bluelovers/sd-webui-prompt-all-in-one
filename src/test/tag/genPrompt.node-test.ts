/**
 * genPrompt.node-test.ts
 *
 * 以 Node.js 原生測試運行器（node:test + node:assert）撰寫的測試腳本。
 * 專門執行「genPrompt」的個別測試案例：
 * 驗證標籤串接、各自動優化選項、disabled 過濾與邊界輸入。
 */

import { describe, it } from 'node:test'
import { runCases } from '../helpers/node-test-helpers'
import { genPrompt } from '@/utils/promptTags/genPrompt'
import { genPromptCases } from 'test/fixture/tag/data-genPrompt'

/* ====================================================================
 *  執行測試
 * ==================================================================== */

describe('genPrompt', () => {
    it('modules load successfully', (t) => {
        t.assert.equal(typeof genPrompt, 'function')
    })

    /**
     * ── genPrompt 案例 ──
     * 案例與期望值皆定義於 fixture/data-genPrompt.ts 的 genPromptCases，
     * 共用 runCases 的案例格式與快照寫入。
     */
    runCases('genPrompt cases', genPrompt, genPromptCases, { snapshot: true })
})
