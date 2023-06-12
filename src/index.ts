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

type SdkConfigMap = Record<string, SdkConfig>
type SdkModuleArr = [System.Module, System.Module[]?, System.Module[]?]
type SdkModule = {
  entry: System.Module
  chunks?: System.Module[]
  css?: System.Module[]
  version?: string
}

export interface LoadParams {
  sdkConfigs: SdkConfigMap | string
  options?: {
    timeout?: number
    chunksDep?: boolean
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

export async function load(params: LoadParams) {
  const { sdkConfigs: sdkConfigsOrigin, options = {} } = params
  const timeout = options?.timeout ?? 10000
  const chunksDep = options?.chunksDep ?? false
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
    const cssPromise =
      css?.length > 0
        ? Promise.all(css.map((name) => System.import(name)))
        : Promise.resolve(undefined)
    if (chunksDep) {
      entryPromise = chunksPromise.then(() => System.import(manifest.entry))
    } else {
      entryPromise = System.import(manifest.entry)
    }
    sdkPromises.push(Promise.all([entryPromise, chunksPromise, cssPromise]))
  })

  const timer = setTimeout(() => {
    throw new Error(`sdk load timeout ${timeout}ms`)
  }, timeout)
  const sdkResults = await Promise.all(sdkPromises)
  clearTimeout(timer)

  const results: Record<string, SdkModule> = sdkResults.reduce(
    (result, [entry, chunks, css], index) => ({
      ...result,
      [sdkNames[index]]: {
        entry,
        chunks,
        css,
        version: sdkConfigs[index].version,
      },
    }),
    {},
  )
  return results
}
