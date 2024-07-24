import { fetch as fetchPolyfill } from 'whatwg-fetch'

if (typeof window !== 'undefined' && typeof window.fetch === 'undefined') {
  window.fetch = fetchPolyfill
}
