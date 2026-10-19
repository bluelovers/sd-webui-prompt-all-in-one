
import { describe, it } from 'node:test'
import { runCases } from './helpers/node-test-helpers'
import {
    basicCases,
    bracketProtectionCases,
    includeParenFalseCases,
    mismatchedBracketCases,
    newlineCases,
    nonStringGuardCases,
    noPeriodCases,
    quoteProtectionCases,
    realWorldCases,
    semicolonCases,
    whitespaceCases,
} from './fixture/data-splitByPeriod';
import { splitByPeriod } from '../src/utils/splitByPeriod'

/* ====================================================================
 *  執行測試
 * ==================================================================== */

describe('splitByPeriod', async () => {
    it('module loads successfully', async (t: TestContext) => {
        return splitByPeriod
    })

    runCases('basic splitting without brackets',           splitByPeriod, basicCases, { snapshot: true })
    runCases('no period at all',                            splitByPeriod, noPeriodCases, { snapshot: true })
    runCases('nested bracket protection (includeParen=true)', splitByPeriod, bracketProtectionCases, { snapshot: true })
    runCases('includeParen=false — stop splitting before open paren', splitByPeriod, includeParenFalseCases, { snapshot: true })
    runCases('mismatched / noisy brackets',                 splitByPeriod, mismatchedBracketCases, { snapshot: true })
    runCases('non-string input guard',                      splitByPeriod, nonStringGuardCases, { snapshot: true })
    runCases('whitespace handling',                         splitByPeriod, whitespaceCases, { snapshot: true })
    runCases('newline handling (priority over quotes/parens)', splitByPeriod, newlineCases, { snapshot: true })
    runCases('semicolon splitting (splitSemicolon option, default off)', splitByPeriod, semicolonCases, { snapshot: true })
    runCases('real-world prompt scenarios',                 splitByPeriod, realWorldCases, { snapshot: true })
    runCases('quote protection (double & single)',          splitByPeriod, quoteProtectionCases, { snapshot: true })
})
