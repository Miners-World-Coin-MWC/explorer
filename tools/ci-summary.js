#!/usr/bin/env node
// Prints a short Markdown status for the GitHub Actions run summary page.
const fs = require('fs')
const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch (e) { return null } }
const state = read('data/.richlist-state.json')
const list = read('data/richlist.json')
const out = ['### Richlist status']
if (state) out.push(`- Crawl progress saved up to block **${Number(state.lastHeight).toLocaleString('en-US')}**` + (state.skipped && state.skipped.length ? ` (${state.skipped.length} unreadable transaction(s) skipped)` : ''))
if (list) {
    const behind = list.tip != null ? list.tip - list.height : null
    out.push(`- Published richlist: block **${Number(list.height).toLocaleString('en-US')}**, ${Number(list.holders).toLocaleString('en-US')} holders, updated ${new Date(list.updated * 1000).toISOString()}` + (behind != null ? ` (${behind} blocks behind the tip when built)` : ''))
} else {
    out.push('- No richlist published yet: the **first full crawl is still in progress** (it continues automatically on the next run).')
}
console.log(out.join('\n'))
