import EventEmitter, { EventMap } from 'bare-events'
import Buffer, { BufferEncoding } from 'bare-buffer'
import { Readable, Writable } from 'bare-stream'
import promises from './promises'
import constants from './lib/constants'

export { promises, constants }

type Flag =
  | 'a'
  | 'a+'
  | 'as'
  | 'as+'
  | 'ax'
  | 'ax+'
  | 'r'
  | 'r+'
  | 'rs'
  | 'rs+'
  | 'sa'
  | 'sa+'
  | 'sr'
  | 'sr+'
  | 'w'
  | 'w+'
  | 'wx'
  | 'wx+'
  | 'xa'
  | 'xa+'
  | 'xw'
  | 'xw+'

interface Callback<A extends unknown[] = []> {
  (err: Error | null, ...args: A): void
}

export interface Dir<T extends string | Buffer = string | Buffer>
  extends Iterable<Dirent>,
    AsyncIterable<Dirent> {
  readonly path: string

  read(cb: Callback<[dirent: Dirent<T> | null]>): void
  readSync(): Dirent<T> | null

  close(cb: Callback): void
  closeSync(): void
}

export class Dir {
  constructor(path: string, handle: Buffer, opts?: OpendirOptions)
}

export interface Dirent<T extends string | Buffer = string | Buffer> {
  readonly path: string
  readonly name: T
  readonly type: number

  isFile(): boolean
  isDirectory(): boolean
  isSymbolicLink(): boolean
  isFIFO(): boolean
  isSocket(): boolean
  isCharacterDevice(): boolean
  isBlockDevice(): boolean
}

export class Dirent<T extends string | Buffer = string | Buffer> {
  constructor(path: string, name: T, type: number)
}

export interface Stats {
  readonly dev: number
  readonly mode: number
  readonly nlink: number
  readonly uid: number
  readonly gid: number
  readonly rdev: number
  readonly blksize: number
  readonly ino: number
  readonly size: number
  readonly blocks: number
  readonly atimeMs: Date
  readonly mtimeMs: Date
  readonly ctimeMs: Date
  readonly birthtimeMs: Date

  isDirectory(): boolean
  isFile(): boolean
  isBlockDevice(): boolean
  isCharacterDevice(): boolean
  isFIFO(): boolean
  isSymbolicLink(): boolean
  isSocket(): boolean
}

export class Stats {
  constructor(
    dev: number,
    mode: number,
    nlink: number,
    uid: number,
    gid: number,
    rdev: number,
    blksize: number,
    ino: number,
    size: number,
    blocks: number,
    atimeMs: number,
    mtimeMs: number,
    ctimeMs: number,
    birthtimeMs: number
  )
}

export interface FileReadStreamOptions {
  flags?: Flag
  mode?: number
}

export interface FileStreamStream extends Readable {
  readonly path: string
  readonly fd: number
}

export class FileReadStream {
  constructor(path: string, opts?: FileWriteStreamOptions)
}

export function createReadStream(
  path: string,
  opts?: FileReadStreamOptions
): FileReadStream

export interface FileWriteStreamOptions {
  flags?: Flag
  mode?: number
}

export interface FileWriteStream extends Writable {
  readonly path: string
  readonly fd: number
  readonly flags: Flag
  readonly mode: number
}

export class FileWriteStream {
  constructor(path: string, opts?: FileWriteStreamOptions)
}

export function createWriteStream(
  path: string,
  opts?: FileWriteStreamOptions
): FileWriteStream

export interface WatcherOptions {
  persistent?: boolean
  recursive?: boolean
  encoding?: BufferEncoding | 'buffer'
}

export type WatcherEventType = 'rename' | 'change'

export interface WatcherEvents<T extends string | Buffer = string | Buffer>
  extends EventMap {
  error: [err: Error]
  change: [eventType: WatcherEventType, filename: T]
  close: []
}

export interface Watcher<T extends string | Buffer = string | Buffer>
  extends EventEmitter<WatcherEvents<T>>,
    AsyncIterable<{ eventType: WatcherEventType; filename: T }> {
  close(): void
  ref(): void
  unref(): void
}

export class Watcher {
  constructor(path: string | Buffer, opts: WatcherOptions)
}

export function access(filepath: string, mode: number, cb: Callback): void

export function access(filepath: string, cb: Callback): void

export function accessSync(filepath: string, mode?: number): void

export interface AppendFileOptions {
  encoding?: BufferEncoding
  flag?: string
  mode?: number
}

export function appendFile(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  opts: AppendFileOptions,
  cb: Callback
): void

export function appendFile(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  encoding: BufferEncoding,
  cb: Callback
): void

export function appendFile(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  cb: Callback
): void

export function appendFileSync(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  opts?: AppendFileOptions
): void

export function appendFileSync(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  encoding: BufferEncoding
): void

export function chmod(
  filepath: string,
  mode: string | number,
  cb: Callback
): void

export function chmodSync(filepath: string, mode: string | number): void

export function close(fd: number, cb?: Callback): void

export function closeSync(fd: number): void

export function copyFile(
  src: string,
  dst: string,
  mode: number,
  cb: Callback
): void

export function copyFile(src: string, dst: string, cb: Callback): void

export function copyFileSync(src: string, dst: string, mode?: number): void

export function exists(filepath: string, cb: (exists: boolean) => void): void

export function existsSync(filepath: string): boolean

export function fchmod(fd: number, mode: string | number, cb: Callback): void

export function fchmodSync(fd: number, mode: string | number): void

export function fstat(fd: number, cb: Callback<[stats: Stats | null]>): void

export function fstatSync(fd: number): Stats

export function ftruncate(fd: number, len: number, cb: Callback): void

export function ftruncate(fd: number, cb: Callback): void

export function ftruncateSync(fd: number, len: number): void

export function lstat(
  filepath: string,
  cb: Callback<[stats: Stats | null]>
): void

export function lstatSync(filepath: string): Stats

export interface MkdirOptions {
  mode?: number
  recursive?: boolean
}

export function mkdir(filepath: string, opts: MkdirOptions, cb: Callback): void

export function mkdir(filepath: string, mode: number, cb: Callback): void

export function mkdir(filepath: string, cb: Callback): void

export function mkdirSync(filepath: string, opts?: MkdirOptions): void

export function mkdirSync(filepath: string, mode: number): void

export function open(
  filepath: string,
  flags: Flag | number,
  mode: string | number,
  cb: Callback<[fd: number]>
): void

export function open(
  filepath: string,
  flags: Flag | number,
  cb: Callback<[fd: number]>
): void

export function open(filepath: string, cb: Callback<[fd: number]>): void

export function openSync(
  filepath: string,
  flags?: Flag | number,
  mode?: string | number
): number

export interface OpendirOptions {
  encoding?: BufferEncoding | 'buffer'
  bufferSize?: number
}

export function opendir(
  filepath: string,
  opts: OpendirOptions & { encoding?: BufferEncoding },
  cb: Callback<[dir: Dir<string> | null]>
): void

export function opendir(
  filepath: string,
  opts: OpendirOptions & { encoding: 'buffer' },
  cb: Callback<[dir: Dir<Buffer> | null]>
): void

export function opendir(
  filepath: string,
  opts: OpendirOptions,
  cb: Callback<[dir: Dir | null]>
): void

export function opendir(
  filepath: string,
  encoding: BufferEncoding,
  cb: Callback<[dir: Dir<string> | null]>
): void

export function opendir(
  filepath: string,
  encoding: 'buffer',
  cb: Callback<[dir: Dir<Buffer> | null]>
): void

export function opendir(
  filepath: string,
  encoding: BufferEncoding | 'buffer',
  cb: Callback<[dir: Dir | null]>
): void

export function opendir(
  filepath: string,
  cb: Callback<[dir: Dir<string> | null]>
): void

export function opendirSync(
  filepath: string,
  opts: OpendirOptions & { encoding?: BufferEncoding }
): Dir<string>

export function opendirSync(
  filepath: string,
  opts: OpendirOptions & { encoding: 'buffer' }
): Dir<Buffer>

export function opendirSync(filepath: string, opts: OpendirOptions): Dir

export function opendirSync(
  filepath: string,
  encoding: BufferEncoding
): Dir<string>

export function opendirSync(filepath: string, encoding: 'buffer'): Dir<Buffer>

export function opendirSync(
  filepath: string,
  encoding: BufferEncoding | 'buffer'
): Dir

export function opendirSync(filepath: string): Dir<string>

export function read(
  fd: number,
  buffer: Buffer | ArrayBufferView,
  offset: number,
  len: number,
  pos: number,
  cb: Callback<[len: number]>
): void

export function read(
  fd: number,
  buffer: Buffer | ArrayBufferView,
  offset: number,
  len: number,
  cb: Callback<[len: number]>
): void

export function read(
  fd: number,
  buffer: Buffer | ArrayBufferView,
  offset: number,
  cb: Callback<[len: number]>
): void

export function read(
  fd: number,
  buffer: Buffer | ArrayBufferView,
  cb: Callback<[len: number]>
): void

export function readSync(
  fd: number,
  buffer: Buffer | ArrayBufferView,
  offset?: number,
  len?: number,
  pos?: number
): number

export interface ReadFileOptions {
  encoding?: BufferEncoding | 'buffer'
  flag?: Flag
}

export function readFile(
  filepath: string,
  opts: ReadFileOptions & { encoding: BufferEncoding },
  cb: Callback<[buffer?: string]>
): void

export function readFile(
  filepath: string,
  opts: ReadFileOptions & { encoding?: 'buffer' },
  cb: Callback<[buffer?: Buffer]>
): void

export function readFile(
  filepath: string,
  opts: ReadFileOptions,
  cb: Callback<[buffer?: string | Buffer]>
): void

export function readFile(
  filepath: string,
  encoding: BufferEncoding,
  cb: Callback<[buffer?: string]>
): void

export function readFile(
  filepath: string,
  encoding: 'buffer',
  cb: Callback<[buffer?: Buffer]>
): void

export function readFile(
  filepath: string,
  encoding: BufferEncoding | 'buffer',
  cb: Callback<[buffer?: string | Buffer]>
): void

export function readFile(
  filepath: string,
  cb: Callback<[buffer?: Buffer]>
): void

export function readFileSync(
  filepath: string,
  opts: ReadFileOptions & { encoding: BufferEncoding }
): string

export function readFileSync(
  filepath: string,
  opts: ReadFileOptions & { encoding?: 'buffer' }
): Buffer

export function readFileSync(
  filepath: string,
  opts: ReadFileOptions
): string | Buffer

export function readFileSync(filepath: string, encoding: BufferEncoding): string

export function readFileSync(filepath: string, encoding: 'buffer'): Buffer

export function readFileSync(
  filepath: string,
  encoding?: BufferEncoding | 'buffer'
): string | Buffer

export function readFileSync(filepath: string): Buffer

export interface ReaddirOptions extends OpendirOptions {
  withFileTypes?: boolean
}

export function readdir(
  filepath: string,
  opts: ReaddirOptions & { encoding?: BufferEncoding },
  cb: Callback<[entries: Dir<string>[] | string[] | null]>
): void

export function readdir(
  filepath: string,
  opts: ReaddirOptions & { encoding?: BufferEncoding; withFileTypes: true },
  cb: Callback<[entries: Dir<string>[] | null]>
): void

export function readdir(
  filepath: string,
  opts: ReaddirOptions & { encoding?: BufferEncoding; withFileTypes?: false },
  cb: Callback<[entries: string[] | null]>
): void

export function readdir(
  filepath: string,
  opts: ReaddirOptions & { encoding: 'buffer' },
  cb: Callback<[entries: Dir<Buffer>[] | Buffer[] | null]>
): void

export function readdir(
  filepath: string,
  opts: ReaddirOptions & { encoding: 'buffer'; withFileTypes: true },
  cb: Callback<[entries: Dir<Buffer>[] | null]>
): void

export function readdir(
  filepath: string,
  opts: ReaddirOptions & { encoding: 'buffer'; withFileTypes?: false },
  cb: Callback<[entries: Buffer[] | null]>
): void

export function readdir(
  filepath: string,
  opts: ReaddirOptions & { withFileTypes: true },
  cb: Callback<[entries: Dir<string | Buffer>[] | null]>
): void

export function readdir(
  filepath: string,
  opts: ReaddirOptions & { withFileTypes?: false },
  cb: Callback<[entries: string[] | Buffer[] | null]>
): void

export function readdir(
  filepath: string,
  opts: ReaddirOptions,
  cb: Callback<[entries: Dir[] | string[] | Buffer[] | null]>
): void

export function readdir(
  filepath: string,
  encoding: BufferEncoding,
  cb: Callback<[entries: string[] | null]>
): void

export function readdir(
  filepath: string,
  encoding: 'buffer',
  cb: Callback<[entries: Buffer[] | null]>
): void

export function readdir(
  filepath: string,
  encoding: BufferEncoding | 'buffer',
  cb: Callback<[entries: string[] | Buffer[] | null]>
): void

export function readdir(
  filepath: string,
  cb: Callback<[entries: string[] | null]>
): void

export function readdirSync(
  filepath: string,
  opts: ReaddirOptions & { encoding?: BufferEncoding }
): Dir<string>[] | string[]

export function readdirSync(
  filepath: string,
  opts: ReaddirOptions & { encoding?: BufferEncoding; withFileTypes: true }
): Dir<string>[]

export function readdirSync(
  filepath: string,
  opts: ReaddirOptions & { encoding?: BufferEncoding; withFileTypes?: false }
): string[]

export function readdirSync(
  filepath: string,
  opts: ReaddirOptions & { encoding: 'buffer' }
): Dir<Buffer>[] | Buffer[]

export function readdirSync(
  filepath: string,
  opts: ReaddirOptions & { encoding: 'buffer'; withFileTypes: true }
): Dir<Buffer>[]

export function readdirSync(
  filepath: string,
  opts: ReaddirOptions & { encoding: 'buffer'; withFileTypes?: false }
): Buffer[]

export function readdirSync(
  filepath: string,
  opts: ReaddirOptions & { withFileTypes: true }
): Dir<string | Buffer>[]

export function readdirSync(
  filepath: string,
  opts: ReaddirOptions & { withFileTypes?: false }
): string[] | Buffer[]

export function readdirSync(
  filepath: string,
  opts: ReaddirOptions
): Dir[] | string[] | Buffer[]

export function readdirSync(
  filepath: string,
  encoding: BufferEncoding
): string[]

export function readdirSync(filepath: string, encoding: 'buffer'): Buffer[]

export function readdirSync(
  filepath: string,
  encoding: BufferEncoding | 'buffer'
): string[] | Buffer[]

export function readdirSync(filepath: string): string[]

export interface ReadlinkOptions {
  encoding?: BufferEncoding | 'buffer'
}

export function readlink(
  filepath: string,
  opts: ReadlinkOptions & { encoding?: BufferEncoding },
  cb: Callback<[link: string | null]>
): void

export function readlink(
  filepath: string,
  opts: ReadlinkOptions & { encoding: 'buffer' },
  cb: Callback<[link: Buffer | null]>
): void

export function readlink(
  filepath: string,
  opts: ReadlinkOptions,
  cb: Callback<[link: string | Buffer | null]>
): void

export function readlink(
  filepath: string,
  encoding: BufferEncoding,
  cb: Callback<[link: string | null]>
): void

export function readlink(
  filepath: string,
  encoding: 'buffer',
  cb: Callback<[link: Buffer | null]>
): void

export function readlink(
  filepath: string,
  encoding: BufferEncoding | 'buffer',
  cb: Callback<[link: string | Buffer | null]>
): void

export function readlink(
  filepath: string,
  cb: Callback<[link: string | null]>
): void

export function readlinkSync(
  filepath: string,
  opts: ReadlinkOptions & { encoding?: BufferEncoding }
): string

export function readlinkSync(
  filepath: string,
  opts: ReadlinkOptions & { encoding: 'buffer' }
): Buffer

export function readlinkSync(
  filepath: string,
  opts: ReadlinkOptions
): string | Buffer

export function readlinkSync(filepath: string, encoding: BufferEncoding): string

export function readlinkSync(filepath: string, encoding: 'buffer'): Buffer

export function readlinkSync(
  filepath: string,
  encoding: BufferEncoding | 'buffer'
): string | Buffer

export function readlinkSync(filepath: string): string

export function readv(
  fd: number,
  buffers: ArrayBufferView[],
  position: number,
  cb: Callback<[len: number]>
): void

export function readv(
  fd: number,
  buffers: ArrayBufferView[],
  cb: Callback<[len: number]>
): void

export interface RealpathOptions {
  encoding?: BufferEncoding | 'buffer'
}

export function realpath(
  filepath: string,
  opts: RealpathOptions & { encoding?: BufferEncoding },
  cb: Callback<[path: string | null]>
): void

export function realpath(
  filepath: string,
  opts: RealpathOptions & { encoding: 'buffer' },
  cb: Callback<[path: Buffer | null]>
): void

export function realpath(
  filepath: string,
  opts: RealpathOptions,
  cb: Callback<[path: string | Buffer | null]>
): void

export function realpath(
  filepath: string,
  encoding: BufferEncoding,
  cb: Callback<[path: string | null]>
): void

export function realpath(
  filepath: string,
  encoding: 'buffer',
  cb: Callback<[path: Buffer | null]>
): void

export function realpath(
  filepath: string,
  encoding: BufferEncoding | 'buffer',
  cb: Callback<[path: string | Buffer | null]>
): void

export function realpath(
  filepath: string,
  cb: Callback<[path: string | null]>
): void

export function realpathSync(
  filepath: string,
  opts: RealpathOptions & { encoding?: BufferEncoding }
): string

export function realpathSync(
  filepath: string,
  opts: RealpathOptions & { encoding: 'buffer' }
): Buffer

export function realpathSync(
  filepath: string,
  opts: RealpathOptions
): string | Buffer

export function realpathSync(filepath: string, encoding: BufferEncoding): string

export function realpathSync(filepath: string, encoding: 'buffer'): Buffer

export function realpathSync(
  filepath: string,
  encoding: BufferEncoding | 'buffer'
): string | Buffer

export function realpathSync(filepath: string): string

export function rename(src: string, dst: string, cb: Callback): void

export function renameSync(src: string, dst: string): void

export interface RmOptions {
  force?: boolean
  recursive?: boolean
}

export function rm(filepath: string, opts: RmOptions, cb: Callback): void

export function rm(filepath: string, cb: Callback): void

export function rmSync(filepath: string, opts?: RmOptions): void

export function rmdir(filepath: string, cb: Callback): void

export function rmdirSync(filepath: string): void

export function stat(
  filepath: string,
  cb: Callback<[stats: Stats | null]>
): void

export function statSync(filepath: string): Stats

export function symlink(
  target: string,
  filepath: string,
  type: string | number,
  cb: Callback
): void

export function symlink(target: string, filepath: string, cb: Callback): void

export function symlinkSync(
  target: string,
  filepath: string,
  type?: string | number
): void

export function unlink(filepath: string, cb: Callback): void

export function unlinkSync(filepath: string): void

export function watch(
  filepath: string,
  opts: WatcherOptions & { encoding?: BufferEncoding },
  cb: (eventType: WatcherEventType, filename: string) => void
): Watcher<string>

export function watch(
  filepath: string,
  opts: WatcherOptions & { encoding: 'buffer' },
  cb: (eventType: WatcherEventType, filename: Buffer) => void
): Watcher<Buffer>

export function watch(
  filepath: string,
  opts: WatcherOptions,
  cb: (eventType: WatcherEventType, filename: string | Buffer) => void
): Watcher

export function watch(
  filepath: string,
  encoding: BufferEncoding,
  cb: (evenType: WatcherEventType, filename: string) => void
): Watcher<string>

export function watch(
  filepath: string,
  encoding: 'buffer',
  cb: (evenType: WatcherEventType, filename: Buffer) => void
): Watcher<Buffer>

export function watch(
  filepath: string,
  encoding: BufferEncoding | 'buffer',
  cb: (evenType: WatcherEventType, filename: string | Buffer) => void
): Watcher

export function watch(
  filepath: string,
  cb: (eventType: WatcherEventType, filename: string) => void
): Watcher<string>

export function write(
  fd: number,
  data: Buffer | ArrayBufferView,
  offset: number,
  len: number,
  pos: number,
  cb: Callback<[len: number]>
): void

export function write(
  fd: number,
  data: Buffer | ArrayBufferView,
  offset: number,
  len: number,
  cb: Callback<[len: number]>
): void

export function write(
  fd: number,
  data: string,
  pos: string | number,
  encoding: BufferEncoding,
  cb: Callback<[len: number]>
): void

export function write(
  fd: number,
  data: Buffer | ArrayBufferView,
  offset: number,
  cb: Callback<[len: number]>
): void

export function write(
  fd: number,
  data: string,
  pos: string | number,
  cb: Callback<[len: number]>
): void

export function write(
  fd: number,
  data: Buffer | ArrayBufferView,
  cb: Callback<[len: number]>
): void

export function write(
  fd: number,
  data: string,
  cb: Callback<[len: number]>
): void

export function writeSync(
  fd: number,
  data: string | Buffer | ArrayBufferView,
  offset?: number,
  len?: number,
  pos?: number
): void

export interface WriteFileOptions {
  encoding?: BufferEncoding
  flag?: Flag
  mode?: number
}

export function writeFile(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  opts: WriteFileOptions,
  cb: Callback
): void

export function writeFile(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  encoding: BufferEncoding,
  cb: Callback
): void

export function writeFile(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  cb: Callback
): void

export function writeFileSync(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  opts?: WriteFileOptions
): void

export function writeFileSync(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  encoding: BufferEncoding
): void

export function writev(
  fd: number,
  buffers: ArrayBufferView[],
  pos: number,
  cb: Callback<[len: number]>
): void

export function writev(
  fd: number,
  buffers: ArrayBufferView[],
  cb: Callback<[len: number]>
): void
