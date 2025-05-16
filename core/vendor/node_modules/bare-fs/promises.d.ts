import Buffer, { BufferEncoding } from 'bare-buffer'
import fs, {
  AppendFileOptions,
  Dir,
  MkdirOptions,
  OpendirOptions,
  ReadFileOptions,
  ReaddirOptions,
  ReadlinkOptions,
  RealpathOptions,
  RmOptions,
  Stats,
  Watcher,
  WatcherOptions,
  WriteFileOptions
} from '.'

export function access(filepath: string, mode?: number): Promise<void>

export function appendFile(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  opts?: AppendFileOptions
): Promise<void>

export function appendFile(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  encoding: BufferEncoding
): Promise<void>

export function chmod(filepath: string, mode: string | number): Promise<void>

export function copyFile(src: string, dst: string, mode?: number): Promise<void>

export function lstat(filepath: string): Promise<Stats>

export function mkdir(filepath: string, opts?: MkdirOptions): Promise<void>

export function mkdir(filepath: string, mode: number): Promise<void>

export function opendir(
  filepath: string,
  opts: OpendirOptions & { encoding?: BufferEncoding }
): Promise<Dir<string>>

export function opendir(
  filepath: string,
  opts: OpendirOptions & { encoding: 'buffer' }
): Promise<Dir<Buffer>>

export function opendir(filepath: string, opts: OpendirOptions): Promise<Dir>

export function opendir(
  filepath: string,
  encoding: BufferEncoding
): Promise<Dir<string>>

export function opendir(
  filepath: string,
  encoding: 'buffer'
): Promise<Dir<Buffer>>

export function opendir(
  filepath: string,
  encoding: BufferEncoding | 'buffer'
): Promise<Dir>

export function opendir(filepath: string): Promise<Dir<string>>

export function readFile(
  filepath: string,
  opts: ReadFileOptions & { encoding: BufferEncoding }
): Promise<string>

export function readFile(
  filepath: string,
  opts: ReadFileOptions & { encoding?: 'buffer' }
): Promise<Buffer>

export function readFile(
  filepath: string,
  opts: ReadFileOptions
): Promise<string | Buffer>

export function readFile(
  filepath: string,
  encoding: BufferEncoding
): Promise<string>

export function readFile(filepath: string, encoding: 'buffer'): Promise<Buffer>

export function readFile(
  filepath: string,
  encoding?: BufferEncoding | 'buffer'
): Promise<string | Buffer>

export function readFile(filepath: string): Promise<Buffer>

export function readdir(
  filepath: string,
  opts: ReaddirOptions & { encoding?: BufferEncoding }
): Promise<Dir<string>[] | string[]>

export function readdir(
  filepath: string,
  opts: ReaddirOptions & { encoding?: BufferEncoding; withFileTypes: true }
): Promise<Dir<string>[]>

export function readdir(
  filepath: string,
  opts: ReaddirOptions & { encoding?: BufferEncoding; withFileTypes?: false }
): Promise<string[]>

export function readdir(
  filepath: string,
  opts: ReaddirOptions & { encoding: 'buffer' }
): Promise<Dir<Buffer>[] | Buffer[]>

export function readdir(
  filepath: string,
  opts: ReaddirOptions & { encoding: 'buffer'; withFileTypes: true }
): Promise<Dir<Buffer>[]>

export function readdir(
  filepath: string,
  opts: ReaddirOptions & { encoding: 'buffer'; withFileTypes?: false }
): Promise<Buffer[]>

export function readdir(
  filepath: string,
  opts: ReaddirOptions & { withFileTypes: true }
): Promise<Dir<string | Buffer>[]>

export function readdir(
  filepath: string,
  opts: ReaddirOptions & { withFileTypes?: false }
): Promise<string[] | Buffer[]>

export function readdir(
  filepath: string,
  opts: ReaddirOptions
): Promise<Dir[] | string[] | Buffer[]>

export function readdir(
  filepath: string,
  encoding: BufferEncoding
): Promise<string[]>

export function readdir(filepath: string, encoding: 'buffer'): Promise<Buffer[]>

export function readdir(
  filepath: string,
  encoding: BufferEncoding | 'buffer'
): Promise<string[] | Buffer[]>

export function readdir(filepath: string): Promise<string[]>

export function readlink(
  filepath: string,
  opts: ReadlinkOptions & { encoding?: BufferEncoding }
): Promise<string>

export function readlink(
  filepath: string,
  opts: ReadlinkOptions & { encoding: 'buffer' }
): Promise<Buffer>

export function readlink(
  filepath: string,
  opts: ReadlinkOptions
): Promise<string | Buffer>

export function readlink(
  filepath: string,
  encoding: BufferEncoding
): Promise<string>

export function readlink(filepath: string, encoding: 'buffer'): Promise<Buffer>

export function readlink(
  filepath: string,
  encoding: BufferEncoding | 'buffer'
): Promise<string | Buffer>

export function readlink(filepath: string): Promise<string>

export function realpath(
  filepath: string,
  opts: RealpathOptions & { encoding?: BufferEncoding }
): Promise<string>

export function realpath(
  filepath: string,
  opts: RealpathOptions & { encoding: 'buffer' }
): Promise<Buffer>

export function realpath(
  filepath: string,
  opts: RealpathOptions
): Promise<string | Buffer>

export function realpath(
  filepath: string,
  encoding: BufferEncoding
): Promise<string>

export function realpath(filepath: string, encoding: 'buffer'): Promise<Buffer>

export function realpath(
  filepath: string,
  encoding: BufferEncoding | 'buffer'
): Promise<string | Buffer>

export function realpath(filepath: string): Promise<string>

export function rename(src: string, dst: string): Promise<void>

export function rm(filepath: string, opts?: RmOptions): Promise<void>

export function rmdir(filepath: string): Promise<void>

export function stat(filepath: string): Promise<Stats>

export function symlink(
  target: string,
  filepath: string,
  type?: string | number
): Promise<void>

export function unlink(filepath: string): Promise<void>

export function watch(
  filepath: string,
  opts: WatcherOptions & { encoding?: BufferEncoding }
): Watcher<string>

export function watch(
  filepath: string,
  opts: WatcherOptions & { encoding: 'buffer' }
): Watcher<Buffer>

export function watch(filepath: string, opts: WatcherOptions): Watcher

export function watch(
  filepath: string,
  encoding: BufferEncoding
): Watcher<string>

export function watch(filepath: string, encoding: 'buffer'): Watcher<Buffer>

export function watch(
  filepath: string,
  encoding: BufferEncoding | 'buffer'
): Watcher

export function watch(filepath: string): Watcher<string>

export function writeFile(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  opts?: WriteFileOptions
): Promise<void>

export function writeFile(
  filepath: string,
  data: string | Buffer | ArrayBufferView,
  encoding: BufferEncoding
): Promise<void>
