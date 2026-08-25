/**
 * Generic Bounded In-Memory LRU Cache.
 * - 0 bytes on disk (zero IndexedDB, zero LocalStorage).
 * - Finite maximum capacity with automatic eviction of least recently used entries.
 * - Optional onEvict callback for resource cleanup (e.g. URL.revokeObjectURL).
 */
export class MemoryLRUCache<K, V> {
  private max: number
  private cache: Map<K, V>
  private onEvict?: (value: V, key: K) => void

  constructor(max = 100, onEvict?: (value: V, key: K) => void) {
    this.max = max
    this.cache = new Map()
    this.onEvict = onEvict
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined
    const val = this.cache.get(key)!
    this.cache.delete(key)
    this.cache.set(key, val)
    return val
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.max) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        const oldestVal = this.cache.get(oldestKey)
        this.cache.delete(oldestKey)
        if (oldestVal !== undefined && this.onEvict) {
          this.onEvict(oldestVal, oldestKey)
        }
      }
    }
    this.cache.set(key, value)
  }

  has(key: K): boolean {
    return this.cache.has(key)
  }

  delete(key: K): boolean {
    if (this.cache.has(key)) {
      const val = this.cache.get(key)!
      this.cache.delete(key)
      if (this.onEvict) this.onEvict(val, key)
      return true
    }
    return false
  }

  clear(): void {
    if (this.onEvict) {
      for (const [key, val] of this.cache.entries()) {
        this.onEvict(val, key)
      }
    }
    this.cache.clear()
  }

  get size(): number {
    return this.cache.size
  }
}
