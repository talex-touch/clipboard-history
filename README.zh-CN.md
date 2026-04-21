<p align="center">
  <a href="https://github.com/talex-touch/tuff" target="_blank" rel="noopener noreferrer">
    <img width="180" src="https://avatars.githubusercontent.com/u/172330535?s=200&v=4" alt="tuff logo">
  </a>
</p>

<h1 align='center'>tuff 插件模板</h1>

<p align='center'>
<a href="./README.md">English</a> | <b>简体中文</b>
</p>

<br>

## 特性

- ⚡️ 使用 [tsup](https://tsup.egoist.dev/) 进行打包。
- 🦾 TypeScript, of course.
- ⚙️ 使用 [Vitest](https://github.com/vitest-dev/vitest) 进行单元测试。
- ☁️ 零配置部署到 npm。
- 🖼️ 图片详情按需解析剪贴板原图，原图不可用时明确展示缩略图降级状态。
- 🔁 宿主 transport 不支持 stream 时，剪贴板变更订阅会降级而不阻断插件启动。

<br>

## 现在可以试试!

> 需要 Node >=18

### GitHub 模板

[在 GitHub 上从这个模板创建一个仓库](https://github.com/talex-touch/tuff-plugin-template/generate).

### 克隆到本地

如果你喜欢更干净的 git 历史记录，可以手动克隆

```bash
npx degit talex-touch/tuff-plugin-template my-tuff-plugin
cd my-tuff-plugin
pnpm i # 如果你没有安装 pnpm, 运行: npm install -g pnpm
```

## 清单

当你使用这个模板时，请尝试按照清单来正确更新你的信息

- [ ] 在 `LICENSE` 中更改作者名
- [ ] 在 `package.json` 中更改作者名
- [ ] 在 `package.json` 中更改项目名
- [ ] 清理 READMEs 并移除路由

然后，尽情享受吧 :)

## 使用

### 开发

只需运行即可访问 http://localhost:3333

```bash
pnpm dev
```

### 构建

要构建应用，请运行

```bash
pnpm build
```

然后你会在 `dist` 目录中看到已准备好用于发布的生成文件。
