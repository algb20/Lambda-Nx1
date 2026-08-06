/**
 * Storage port. App/engine store blobs (screenshots, archived pages, exports)
 * through this interface, never a specific vendor SDK (charter rule #4).
 */
export interface StoredObject {
  key: string
  url: string
}

export interface StorageProvider {
  readonly name: string
  put(key: string, data: Uint8Array, contentType?: string): Promise<StoredObject>
  get(key: string): Promise<Uint8Array | null>
  delete(key: string): Promise<void>
}
