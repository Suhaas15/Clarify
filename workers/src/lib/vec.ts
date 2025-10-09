export function float32ArrayToBytes(values: number[]): ArrayBuffer {
  const floatArray = Float32Array.from(values);
  return floatArray.buffer.slice(floatArray.byteOffset, floatArray.byteOffset + floatArray.byteLength);
}

export function bytesToFloat32Array(bytes: ArrayBuffer | ArrayBufferView): number[] {
  if (bytes instanceof ArrayBuffer) {
    return Array.from(new Float32Array(bytes));
  }
  const view = bytes as ArrayBufferView;
  return Array.from(new Float32Array(view.buffer, view.byteOffset, Math.floor(view.byteLength / 4)));
}
