const { logger } = globalThis

const pluginLifecycle = {
  /**
   * clipboard-history 使用 webcontent 交互，实际功能由前端页面承载。
   * Prelude 仅保留轻量生命周期入口，避免模板遗留逻辑干扰。
   */
  async onFeatureTriggered(featureId) {
    logger?.log?.(`[clipboard-history] feature triggered: ${featureId}`)
  },
}

module.exports = pluginLifecycle
