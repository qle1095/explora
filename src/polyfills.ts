// Hermes's TextDecoder only supports utf-8, but h3-js constructs a utf-16le
// decoder at module load (emscripten string glue). This shim delegates to the
// native decoder for everything it supports and hand-decodes utf-16le.
// It must be imported before h3-js — keep this the first import in index.ts.

const NativeTextDecoder = (globalThis as any).TextDecoder;

class CompatTextDecoder {
  readonly encoding: string;
  private native: InstanceType<typeof NativeTextDecoder> | null = null;

  constructor(label = "utf-8", options?: unknown) {
    const norm = String(label).trim().toLowerCase();
    if (norm === "utf-16le" || norm === "utf-16") {
      this.encoding = "utf-16le";
    } else {
      this.native = new NativeTextDecoder(label, options);
      this.encoding = this.native.encoding;
    }
  }

  decode(input?: ArrayBuffer | ArrayBufferView): string {
    if (this.native) return this.native.decode(input);
    if (!input) return "";
    const bytes =
      input instanceof Uint8Array
        ? input
        : ArrayBuffer.isView(input)
          ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength)
          : new Uint8Array(input);

    const units: number[] = [];
    let out = "";
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      units.push(bytes[i] | (bytes[i + 1] << 8));
      if (units.length === 0x2000) {
        out += String.fromCharCode(...units);
        units.length = 0;
      }
    }
    if (units.length) out += String.fromCharCode(...units);
    return out;
  }
}

(globalThis as any).TextDecoder = CompatTextDecoder;
