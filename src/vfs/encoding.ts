export function getVfsUtf8ByteSize(content: string): number {
  return new TextEncoder().encode(content).byteLength;
}
