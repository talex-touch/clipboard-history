const { $util, console, TuffItemBuilder } = globalThis

/**
 * Mocks a translation.
 * @param {string} text The text to translate.
 * @returns {Promise<{text: string, from: string, to: string}>}
 */
async function mockTranslate(text) {
  const isChinese = /[\u4E00-\u9FFF]/.test(text)
  const from = isChinese ? 'zh' : 'en'
  const to = isChinese ? 'en' : 'zh'

  return {
    text: `Translated: ${text}`,
    from,
    to,
  }
}

/**
 * @param {string} featureId
 * @param {string} query
 * @param {AbortSignal} signal
 * @returns {Promise<void>}
 */
async function handleTranslation(featureId, query, signal) {
  $util.search.updateQuery(query)
  $util.clearItems()

  try {
    const translation = await mockTranslate(query, signal)
    const item = new TuffItemBuilder(query)
      .setSource('plugin', 'plugin-features')
      .setTitle(translation.text)
      .setSubtitle(`Mock Translate: ${translation.from} → ${translation.to}`)
      .setIcon({ type: 'remix', value: 'translate' })
      .addTag('Translation', 'blue')
      .build()

    $util.pushItems([item])
  }
  catch (error) {
    console.error('Translation failed:', error)
    const errorItem = new TuffItemBuilder('error-item')
      .setSource('plugin', 'plugin-features')
      .setTitle('Translation Failed')
      .setSubtitle(error.message)
      .setIcon('remix:error-warning')
      .addTag('Error', 'red')
      .build()
    $util.pushItems([errorItem])
  }
}

const pluginLifecycle = {
  /**
   * @param {string} featureId
   * @param {string} query
   * @param {any} feature
   * @param {AbortSignal} signal
   */
  async onFeatureTriggered(featureId, query, feature, signal) {
    if (featureId === 'touch-translate' && query && query.trim()) {
      await handleTranslation(featureId, query.trim(), signal)
    }
  },
}

module.exports = pluginLifecycle