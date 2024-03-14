import express from 'express'
import dayjs from 'dayjs'

const router = express.Router()

router.get('/summary', async (req, res) => {
  const { logger, cache, db } = req.app.locals
  const valid_periods = Array.from(
    { length: 24 },
    (_, i) => `${i + 1}h`
  ).concat(
    Array.from({ length: 60 }, (_, i) => `${i + 1}m`),
    Array.from({ length: 30 }, (_, i) => `${i + 1}d`)
  )
  const period = req.query.period || '24h' // Default period to 24 hours if not specified

  const now = dayjs().unix()

  if (!valid_periods.includes(period)) {
    return res.status(400).send({ error: 'Invalid period specified' })
  }

  let period_condition = ''
  let cache_ttl = 900 // Default cache TTL for 24h in seconds (15 minutes)
  if (period.endsWith('h')) {
    const hours = parseInt(period.slice(0, -1))
    period_condition = `AND local_timestamp >= ${now - hours * 3600}`
    cache_ttl = hours === 1 ? 300 : 900 // 5 minutes for 1h, 15 minutes otherwise
  } else if (period.endsWith('m')) {
    const minutes = parseInt(period.slice(0, -1))
    period_condition = `AND local_timestamp >= ${now - minutes * 60}`
    cache_ttl = 300 // 5 minutes for any minute range
  } else if (period.endsWith('d')) {
    const days = parseInt(period.slice(0, -1))
    period_condition = `AND local_timestamp >= ${now - days * 86400}`
    cache_ttl = days === 1 ? 900 : 3600 // 15 minutes for 1d, 1 hour for more than 1 day
  }

  const cache_key = `/api/blocks/confirmed/summary?period=${period}`
  const cached_data = cache.get(cache_key)
  if (cached_data) {
    return res.status(200).send(cached_data)
  }

  try {
    const confirmation_latency_ms_by_bucket = await db
      .raw(
        `
      SELECT 
        CASE 
          WHEN balance < 309485009821345068724781056 THEN 0
          WHEN balance < 2630622583481433084160638976 THEN 1
          WHEN balance < 4951760157141521099596496896 THEN 2
          WHEN balance < 23520860746422225223083360256 THEN 3
          WHEN balance < 42089961335702929346570223616 THEN 4
          WHEN balance < 60659061924983633470057086976 THEN 5
          WHEN balance < 79228162514264337593543950336 THEN 6
          WHEN balance < 227780967228509970581438857216 THEN 7
          WHEN balance < 376333771942755603569333764096 THEN 8
          WHEN balance < 524886576657001236557228670976 THEN 9
          WHEN balance < 673439381371246869545123577856 THEN 10
          WHEN balance < 821992186085492502533018484736 THEN 11
          WHEN balance < 970544990799738135520913391616 THEN 12
          WHEN balance < 1119097795513983768508808298496 THEN 13
          WHEN balance < 1267650600228229401496703205376 THEN 14
          WHEN balance < 2456073037942194465399862460416 THEN 15
          WHEN balance < 3644495475656159529303021715456 THEN 16
          WHEN balance < 4832917913370124593206180970496 THEN 17
          WHEN balance < 6021340351084089657109340225536 THEN 18
          WHEN balance < 7209762788798054721012499480576 THEN 19
          WHEN balance < 8398185226512019784915658735616 THEN 20
          WHEN balance < 9586607664225984848818817990656 THEN 21
          WHEN balance < 10775030101939949912721977245696 THEN 22
          WHEN balance < 11963452539653914976625136500736 THEN 23
          WHEN balance < 13151874977367880040528295755776 THEN 24
          WHEN balance < 14340297415081845104431455010816 THEN 25
          WHEN balance < 15528719852795810168334614265856 THEN 26
          WHEN balance < 16717142290509775232237773520896 THEN 27
          WHEN balance < 17905564728223740296140932775936 THEN 28
          WHEN balance < 19093987165937705360044092030976 THEN 29
          WHEN balance < 20282409603651670423947251286016 THEN 30
          WHEN balance < 39297168607075111446397799366656 THEN 31
          WHEN balance < 58311927610498552468848347447296 THEN 32
          WHEN balance < 77326686613921993491298895527936 THEN 33
          WHEN balance < 96341445617345434513749443608576 THEN 34
          WHEN balance < 115356204620768875536199991689216 THEN 35
          WHEN balance < 134370963624192316558650539769856 THEN 36
          WHEN balance < 153385722627615757581101087850496 THEN 37
          WHEN balance < 172400481631039198603551635931136 THEN 38
          WHEN balance < 191415240634462639626002184011776 THEN 39
          WHEN balance < 210429999637886080648452732092416 THEN 40
          WHEN balance < 229444758641309521670903280173056 THEN 41
          WHEN balance < 248459517644732962693353828253696 THEN 42
          WHEN balance < 267474276648156403715804376334336 THEN 43
          WHEN balance < 286489035651579844738254924414976 THEN 44
          WHEN balance < 305503794655003285760705472495616 THEN 45
          WHEN balance < 324518553658426726783156020576256 THEN 46
          WHEN balance < 932990841767976839501573559156736 THEN 47
          WHEN balance < 1541463129877526952219991097737216 THEN 48
          WHEN balance < 2149935417987077064938408636317696 THEN 49
          WHEN balance < 2758407706096627177656826174898176 THEN 50
          WHEN balance < 3366879994206177290375243713478656 THEN 51
          WHEN balance < 3975352282315727403093661252059136 THEN 52
          WHEN balance < 4583824570425277515812078790639616 THEN 53
          WHEN balance < 5192296858534827628530496329220096 THEN 54
          WHEN balance < 24663410078040431235519857563795456 THEN 55
          WHEN balance < 44134523297546034842509218798370816 THEN 56
          WHEN balance < 63605636517051638449498580032946176 THEN 57
          WHEN balance < 83076749736557242056487941267521536 THEN 58
          WHEN balance < 706152372760736557480147500773933056 THEN 59
          WHEN balance < 1329227995784915872903807060280344576 THEN 60
          ELSE 61
        END AS bucket_index,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (election_time - local_timestamp::bigint * 1000)) AS median_confirmation_latency,
        MIN(election_time - local_timestamp::bigint * 1000) AS min_confirmation_latency,
        MAX(election_time - local_timestamp::bigint * 1000) AS max_confirmation_latency,
        AVG(election_time - local_timestamp::bigint * 1000) AS avg_confirmation_latency,
        COUNT(*) AS confirmed_blocks_count
      FROM blocks
      WHERE confirmed = 1
      AND election_time IS NOT NULL
      ${period_condition}
      GROUP BY bucket_index
    `
      )
      .then((resp) => {
        const { rows } = resp
        const buckets = Array(62).fill({ median: 0, min: 0, max: 0, avg: 0, count: 0 }) // Initialize buckets
        rows.forEach((row) => {
          buckets[row.bucket_index] = {
            median: row.median_confirmation_latency,
            min: row.min_confirmation_latency,
            max: row.max_confirmation_latency,
            avg: row.avg_confirmation_latency,
            confirmed_blocks: row.confirmed_blocks_count
          }
        })
        return buckets.reduce((acc, bucket, index) => {
          acc[`bucket_${index}`] = {
            median: Number(bucket.median),
            min: Number(bucket.min),
            max: Number(bucket.max),
            avg: Number(bucket.avg),
            confirmed_blocks: Number(bucket.confirmed_blocks)
          }
          return acc
        }, {})
      })

    cache.set(cache_key, { confirmation_latency_ms_by_bucket }, cache_ttl)
    res.status(200).send({ confirmation_latency_ms_by_bucket })
  } catch (error) {
    logger(error)
    res.status(500).send({ error: error.toString() })
  }
})

export default router
