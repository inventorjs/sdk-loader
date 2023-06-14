import './polyfill.js'
import 'systemjs'

export interface SdkConfig {
  manifest: {
    entry: string
    chunks?: string[]
    css?: string[]
  }
  version?: string
}

type CssAttachMode = 'legacy' | 'modern' | false
type Doc = (Document & { adoptedStyleSheets: CSSStyleSheet[] })
type DocumentRoot = DocumentOrShadowRoot | Doc

type SdkConfigMap = Record<string, SdkConfig>
type SdkModuleArr = [System.Module, System.Module[]?, unknown[]?]
type SdkModule = {
  entry: System.Module
  chunks?: System.Module[]
  css?: System.Module[]
  version?: string
}

export type Module = System.Module

export interface LoadParams {
  sdkConfigs: SdkConfigMap | string
  options?: {
    timeout?: number
    chunksDep?: boolean
    cssAttachMode?: CssAttachMode
    documentRoot?: DocumentRoot
  }
}

function checkSdkConfigs(sdkConfigs: SdkConfigMap) {
  const sdkNames = sdkConfigs ? Object.keys(sdkConfigs) : []
  if (!sdkNames.length) {
    throw new Error('sdkConfig not valid')
  }

  sdkNames.forEach((sdkName) => {
    const { manifest } = sdkConfigs?.[sdkName] ?? {}
    if (!manifest || !manifest.entry) {
      throw new Error('sdkConfig must have as "entry".')
    }
    if (manifest.chunks && !Array.isArray(manifest.chunks)) {
      throw new Error('sdkConfig "chunks" must string array.')
    }
    if (manifest.css && !Array.isArray(manifest.css)) {
      throw new Error('sdkConfig "css" must string array.')
    }
  })
  return sdkNames
}

async function loadSdkConfigs(sdkUrl: string) {
  const { default: sdkConfigs } = await System.import(sdkUrl)
  return sdkConfigs as SdkConfigMap
}

async function loadCss(
  css: string[],
  cssAttachMode: CssAttachMode,
  documentRoot: DocumentRoot,
) {
  if (!css.length) return Promise.resolve(undefined)

  const cssPromise = Promise.all(
    css.map((cssLink) => {
      if (cssAttachMode === 'legacy') {
        return new Promise((resolve, reject) => {
          const doc = documentRoot as Doc
          const shadowDoc = documentRoot as ShadowRoot
          const currentLink = doc.querySelector(`link[href="${cssLink}"]`)
          if (currentLink) {
            return resolve(currentLink)
          }

          const link = document.createElement('link')
          link.rel = 'stylesheet'
          link.href = cssLink
          if (doc.head) {
            doc.head.appendChild(link)
          } else {
            shadowDoc.appendChild(link)
          }
          link.onload = () => resolve(link)
          link.onerror = (error) => reject(error)
        })
      } else {
        return System.import(cssLink)
      }
    }),
  )
  return cssPromise
}

export async function loadSdk(params: LoadParams) {
  const { sdkConfigs: sdkConfigsOrigin, options = {} } = params
  const timeout = options?.timeout ?? 10000
  const chunksDep = options?.chunksDep ?? false
  const cssAttachMode = options?.cssAttachMode ?? false
  const documentRoot = options.documentRoot ?? document

  let sdkConfigs = sdkConfigsOrigin as Record<string, SdkConfig>
  if (typeof sdkConfigsOrigin === 'string') {
    sdkConfigs = await loadSdkConfigs(sdkConfigsOrigin)
  }

  const sdkNames = checkSdkConfigs(sdkConfigs)

  const sdkPromises: Promise<SdkModuleArr>[] = []
  sdkNames.forEach((sdkName) => {
    const { manifest } = sdkConfigs[sdkName]
    const css = manifest.css ?? []
    const chunks = manifest.chunks ?? []

    let entryPromise
    const chunksPromise =
      chunks?.length > 0
        ? Promise.all(chunks.map((name) => System.import(name)))
        : Promise.resolve(undefined)
    const cssPromise = loadCss(css, cssAttachMode, documentRoot)
    if (chunksDep) {
      entryPromise = chunksPromise.then(() => System.import(manifest.entry))
    } else {
      entryPromise = System.import(manifest.entry)
    }
    sdkPromises.push(Promise.all([entryPromise, chunksPromise, cssPromise]))
  })

  const sdkResults = await Promise.race([
    Promise.all(sdkPromises),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`timeout ${timeout}ms`))
      }, timeout)
    })
  ]) as SdkModuleArr[]

  const results: Record<string, SdkModule> = sdkResults.reduce(
    (result, [entry, chunks, css], index) => ({
      ...result,
      [sdkNames[index]]: {
        entry,
        chunks,
        css,
        version: sdkConfigs[sdkNames[index]].version,
      },
    }),
    {},
  )
  return results
}
