module.exports = {
  bracketSpacing: true,
  jsxSingleQuote: true,
  jsxBracketSameLine: true,
  semi: false,
  singleQuote: true,
  trailingComma: 'none',
  overrides: [
    {
      files: '*.postgre.sql',
      options: {
        language: 'postgresql'
      }
    }
  ]
}
