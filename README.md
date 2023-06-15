# @inventorjs/sdk-loader

## 概述
基于 systemjs 实现的通用 sdk 加载器，可实现根据 sdk 资源配置，加载 sdk ，返回 sdk 模块，支持 js, chunks 和 css.

## 功能列表
* 基于 systemjs 实现模块模块管理，支持 js(支持 system 格式) json css 类型的模块
* systemjs 加载 json 和 css 需要用到 fetch，支持自动加载 fetch polyfill
* css 模块加载后返回 CSSStyleSheet 对象列表，用户可自定义如何使用
* 支持多 sdk 并发加载，需要考虑最大并发数可能会影响性能
* 支持直接传入 sdkConfigs 配置对象 或 传入 sdkConfigs 配置对象的远程 json 地址，可自动加载
* 支持自定义加载超时时间，默认 10s，超时后会抛出错误
* 支持 webpack / rollup 打包的 systemjs 模块，可配置优先加载 chunk（webpack 的 SplitChunks 对 systemjs 兼容不好）

**兼容性：不兼容 IE，Edge 以上没问题**

**副作用：systemjs 会在全局注入 System 全局变量，用于模块管理**

**注意：js 模块需要打包成 system 格式，[webpack配置](https://webpack.js.org/configuration/output/#type-system) [rollup配置](https://rollupjs.org/configuration-options/#output-format)，推荐使用 rollup**

## 代码示例
```
  import { loadSdk } from './sdk-loader'
  import ReactDOM from 'react-dom'

  loadSdk({
    sdkConfigs: {
      testSdk: {
        manifest: {
          entry: 'http://localhost:3000/dist/index.js',
          chunks: ['http://localhost:3000/dist/react-7138bc01.js'],
          css: ['http://localhost:3000/dist/style.css'],
        },
        version: 'v1',
      },
    },
    options: {
      timeout: 15000,
      chunksPreload: true, // 默认为 false，是否预加载 chunks，webpack 构建的 chunks 请传 true
      cssEffect: true, // 默认为 false，加载完 css 是否在页面生效，优先使用 adoptedStyleSheets，若不支持，降级为 link
      documentRoot: document, // 默认为 document, css 生效的文档对象，可传 shadowDom Root
    }
  }).then(({ testSdk: { entry, chunks, css } }) => {
    console.log(entry, chunks, css)
  })
```

