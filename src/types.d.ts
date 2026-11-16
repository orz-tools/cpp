declare module 'browser-stream-tar' {
  export function files(tar: ReadableStream<Uint8Array>): AsyncGenerator<TarEntry>

  export interface TarEntry {
    name: string
    stream: () => ReadableStream
  }

  export function streamToUint8Array(stream: ReadableStream): Promise<Uint8Array>
}
