import config from '../config.js'

const report_job = async ({
  job_id,
  success,
  reason,
  duration_ms,
  schedule,
  schedule_type
}) => {
  const { api_url, api_key } = config.job_tracker || {}
  if (!api_url || !api_key) {
    return
  }

  const controller = new AbortController()
  const timeout_id = setTimeout(() => controller.abort(), 5000)
  try {
    const response = await fetch(`${api_url}/api/jobs/report`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${api_key}`
      },
      body: JSON.stringify({
        job_id,
        success,
        reason,
        duration_ms,
        schedule,
        schedule_type,
        project: 'nanodb',
        server: 'database'
      })
    })
    clearTimeout(timeout_id)
    if (!response.ok) {
      console.error(`job tracker report failed: HTTP ${response.status}`)
    }
  } catch (error) {
    clearTimeout(timeout_id)
    console.error(`job tracker report failed: ${error.message}`)
  }
}

export default report_job
