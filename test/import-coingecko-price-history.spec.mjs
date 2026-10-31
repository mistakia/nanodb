/* global describe it */
import chai from 'chai'

import { format_market_chart_rows } from '../scripts/import-coingecko-price-history.mjs'

const expect = chai.expect

const DAY_MS = 24 * 60 * 60 * 1000
const OCT_21 = Date.UTC(2026, 9, 21)

describe('import-coingecko-price-history', () => {
  it('prices day D at the next UTC midnight with the volume from D', () => {
    const rows = format_market_chart_rows(`{
      "prices": [[${OCT_21}, 0.33818624382639695], [${OCT_21 + DAY_MS}, 0.3432884012482018], [${OCT_21 + DAY_MS + 3600000}, 0.35]],
      "market_caps": [],
      "total_volumes": [[${OCT_21}, 231247.6161640346], [${OCT_21 + DAY_MS}, 274571.8426032668], [${OCT_21 + DAY_MS + 3600000}, 1]]
    }`)
    expect(rows).to.deep.equal([
      {
        timestamp_utc: '2026-10-21 00:00:00',
        price: '0.3432884012482018',
        volume: '231247.6161640346',
        source: 'coingecko'
      }
    ])
  })

  it('throws on an error body', () => {
    expect(() =>
      format_market_chart_rows('{"error":{"status":{"error_code":10012}}}')
    ).to.throw(/unexpected CoinGecko market_chart response/)
  })
})
