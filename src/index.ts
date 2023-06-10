import './polyfill.js'
import 'systemjs'

export interface SdkConfig {
  entry: string
  chunks?: string[]
  css?: string[]
}

type SdkConfigMap = Record<string, SdkConfig>
type SdkModuleArr = [System.Module, System.Module[]?, System.Module[]?]
type SdkModule = {
  entry: System.Module
  chunks?: System.Module[]
  css?: System.Module[]
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
    const sdkConfig = sdkConfigs[sdkName]
    if (!sdkConfig.entry) {
      throw new Error('sdkConfig must have as "entry".')
    }
    if (sdkConfig.chunks && !Array.isArray(sdkConfig.chunks)) {
      throw new Error('sdkConfig "chunks" must string array.')
    }
    if (sdkConfig.css && !Array.isArray(sdkConfig.css)) {
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
    const sdkConfig = sdkConfigs[sdkName]
    const css = sdkConfig.css ?? []
    const chunks = sdkConfig.chunks ?? []

    let entryPromise
    const chunksPromise = chunks?.length > 0 ? Promise.all(chunks.map((name) => System.import(name))) : Promise.resolve(undefined)
    const cssPromise = css?.length > 0 ? Promise.all(css.map((name) => System.import(name))) : Promise.resolve(undefined)
    if (chunksDep) {
      entryPromise = chunksPromise.then(() => System.import(sdkConfig.entry))
    } else {
      entryPromise = System.import(sdkConfig.entry)
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
      [sdkNames[index]]: { entry, chunks, css },
    }), {})
  return results
}