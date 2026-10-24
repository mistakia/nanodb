const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const env = process.env.NODE_ENV || 'test'

// Production secrets are sops/age-encrypted at rest in config.production.json
// (host-only, gitignored; recipient policy in .sops.yaml) and decrypted by the
// system `sops` binary. Test and development load plaintext config.${env}.js,
// which holds no secrets. Fail-closed: a missing identity, binary or file, or
// any sops error, throws.

const resolve_age_key_file = () =>
  process.env.SOPS_AGE_KEY_FILE ||
  path.join(os.homedir(), '.config', 'sops', 'age', 'keys.txt')

const load_sops_json = (file_path) => {
  const result = spawnSync(
    'sops',
    ['--decrypt', '--input-type', 'json', '--output-type', 'json', file_path],
    {
      encoding: 'utf8',
      env: { ...process.env, SOPS_AGE_KEY_FILE: resolve_age_key_file() }
    }
  )
  if (result.error) {
    throw new Error(`sops invocation failed: ${result.error.message}`)
  }
  if (result.status !== 0) {
    const detail = (result.stderr || '').trim() || `exit ${result.status}`
    throw new Error(`sops --decrypt failed for ${file_path}: ${detail}`)
  }
  return JSON.parse(result.stdout)
}

module.exports =
  env === 'production'
    ? load_sops_json(path.join(__dirname, 'config.production.json'))
    : require(`./config.${env}.js`)
