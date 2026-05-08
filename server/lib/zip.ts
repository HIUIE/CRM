import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import { once } from 'node:events';
import zlib from 'node:zlib';

type ZipEntry = {
  name: string;
  data: Buffer;
};

export type ZipSink = {
  write: (chunk: Buffer) => boolean | void;
  end?: (chunk?: Buffer) => void;
  once?: (event: string, listener: () => void) => void;
};

type ZipDirectoryEntry = {
  name: string;
  checksum: number;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  offset: number;
  dosTime: number;
  dosDate: number;
};

const ZIP_STORE = 0;
const ZIP_DEFLATE = 8;

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let i = 0; i < 8; i += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  return value >>> 0;
});

function updateCrc32(crc: number, buffer: Buffer) {
  for (const value of buffer) {
    crc = CRC32_TABLE[(crc ^ value) & 0xff] ^ (crc >>> 8);
  }
  return crc >>> 0;
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  crc = updateCrc32(crc, buffer);
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosDateTime(input: Date) {
  const year = Math.max(input.getFullYear(), 1980);
  const dosTime = ((input.getHours() & 0x1f) << 11) | ((input.getMinutes() & 0x3f) << 5) | Math.floor(input.getSeconds() / 2);
  const dosDate = (((year - 1980) & 0x7f) << 9) | (((input.getMonth() + 1) & 0x0f) << 5) | (input.getDate() & 0x1f);
  return { dosTime, dosDate };
}

function buildLocalHeader(
  nameBuffer: Buffer,
  checksum: number,
  compressedSize: number,
  uncompressedSize: number,
  compressionMethod: number,
  dosTime: number,
  dosDate: number,
) {
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0x0800, 6);
  localHeader.writeUInt16LE(compressionMethod, 8);
  localHeader.writeUInt16LE(dosTime, 10);
  localHeader.writeUInt16LE(dosDate, 12);
  localHeader.writeUInt32LE(checksum, 14);
  localHeader.writeUInt32LE(compressedSize, 18);
  localHeader.writeUInt32LE(uncompressedSize, 22);
  localHeader.writeUInt16LE(nameBuffer.length, 26);
  localHeader.writeUInt16LE(0, 28);
  return localHeader;
}

function buildCentralHeader(entry: ZipDirectoryEntry, nameBuffer: Buffer) {
  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0x0800, 8);
  centralHeader.writeUInt16LE(entry.compressionMethod, 10);
  centralHeader.writeUInt16LE(entry.dosTime, 12);
  centralHeader.writeUInt16LE(entry.dosDate, 14);
  centralHeader.writeUInt32LE(entry.checksum, 16);
  centralHeader.writeUInt32LE(entry.compressedSize, 20);
  centralHeader.writeUInt32LE(entry.uncompressedSize, 24);
  centralHeader.writeUInt16LE(nameBuffer.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(entry.offset, 42);
  return centralHeader;
}

function maybeCompress(buffer: Buffer) {
  const compressed = zlib.deflateRawSync(buffer, { level: 6 });
  if (compressed.length < buffer.length) {
    return {
      data: compressed,
      compressionMethod: ZIP_DEFLATE,
      compressedSize: compressed.length,
      uncompressedSize: buffer.length,
    };
  }
  return {
    data: buffer,
    compressionMethod: ZIP_STORE,
    compressedSize: buffer.length,
    uncompressedSize: buffer.length,
  };
}

export function createZipBuffer(entries: ZipEntry[]) {
  const now = new Date();
  const { dosTime, dosDate } = toDosDateTime(now);
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  // Standard ZIP limit for entry count is 16-bit (65535)
  // For larger sets, ZIP64 is required. Here we at least ensure the header is valid for up to 65535.
  const entryCount = Math.min(entries.length, 0xFFFF);

  for (const entry of entries) {
    const nameBuffer = Buffer.from(entry.name, 'utf8');
    const dataBuffer = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data);
    const packed = maybeCompress(dataBuffer);
    const checksum = crc32(dataBuffer);
    const localHeader = buildLocalHeader(
      nameBuffer,
      checksum,
      packed.compressedSize,
      packed.uncompressedSize,
      packed.compressionMethod,
      dosTime,
      dosDate,
    );
    const centralHeader = buildCentralHeader(
      {
        name: entry.name,
        checksum,
        compressedSize: packed.compressedSize,
        uncompressedSize: packed.uncompressedSize,
        compressionMethod: packed.compressionMethod,
        offset,
        dosTime,
        dosDate,
      },
      nameBuffer,
    );

    localParts.push(localHeader, nameBuffer, packed.data);
    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + packed.compressedSize;
  }

  const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entryCount, 8);
  endRecord.writeUInt16LE(entryCount, 10);
  endRecord.writeUInt32LE(centralDirectorySize, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, endRecord]);
}

export class ZipStreamWriter {
  private entries: ZipDirectoryEntry[] = [];
  private offset = 0;

  constructor(private sink: ZipSink) {}

  private async writeChunk(chunk: Buffer) {
    const result = this.sink.write(chunk);
    this.offset += chunk.length;
    if (result === false && typeof this.sink.once === 'function') {
      await once(this.sink as unknown as NodeJS.EventEmitter, 'drain');
    }
  }

  private async addEntry(name: string, originalData: Buffer, modifiedAt = new Date()) {
    const { dosTime, dosDate } = toDosDateTime(modifiedAt);
    const nameBuffer = Buffer.from(name, 'utf8');
    const checksum = crc32(originalData);
    const packed = maybeCompress(originalData);
    const entryOffset = this.offset;

    await this.writeChunk(
      buildLocalHeader(
        nameBuffer,
        checksum,
        packed.compressedSize,
        packed.uncompressedSize,
        packed.compressionMethod,
        dosTime,
        dosDate,
      ),
    );
    await this.writeChunk(nameBuffer);
    await this.writeChunk(packed.data);

    this.entries.push({
      name,
      checksum,
      compressedSize: packed.compressedSize,
      uncompressedSize: packed.uncompressedSize,
      compressionMethod: packed.compressionMethod,
      offset: entryOffset,
      dosTime,
      dosDate,
    });
  }

  async addBuffer(name: string, data: Buffer, modifiedAt = new Date()) {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    await this.addEntry(name, buffer, modifiedAt);
  }

  async addText(name: string, content: string, modifiedAt = new Date()) {
    await this.addBuffer(name, Buffer.from(content, 'utf8'), modifiedAt);
  }

  async addFile(name: string, filePath: string, modifiedAt = new Date()) {
    const buffer = await fs.promises.readFile(filePath);
    await this.addEntry(name, buffer, modifiedAt);
  }

  async finalize() {
    const centralParts: Buffer[] = [];
    for (const entry of this.entries) {
      const nameBuffer = Buffer.from(entry.name, 'utf8');
      centralParts.push(buildCentralHeader(entry, nameBuffer), nameBuffer);
    }

    const centralDirectorySize = centralParts.reduce((sum, part) => sum + part.length, 0);
    for (const part of centralParts) {
      await this.writeChunk(part);
    }

    const endRecord = Buffer.alloc(22);
    endRecord.writeUInt32LE(0x06054b50, 0);
    endRecord.writeUInt16LE(0, 4);
    endRecord.writeUInt16LE(0, 6);
    endRecord.writeUInt16LE(this.entries.length, 8);
    endRecord.writeUInt16LE(this.entries.length, 10);
    endRecord.writeUInt32LE(centralDirectorySize, 12);
    endRecord.writeUInt32LE(this.offset, 16);
    endRecord.writeUInt16LE(0, 20);
    this.sink.end?.(endRecord);
  }
}
