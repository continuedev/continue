const { Readable, getStreamError, isStreamx, isDisturbed } = require('streamx')

// https://streams.spec.whatwg.org/#readablestreamdefaultreader
exports.ReadableStreamDefaultReader = class ReadableStreamDefaultReader {
  constructor(stream) {
    this._stream = stream._stream
  }

  read() {
    const stream = this._stream

    return new Promise((resolve, reject) => {
      const err = getStreamError(stream)

      if (err) return reject(err)

      if (stream.destroyed) {
        return resolve({ value: undefined, done: true })
      }

      const value = stream.read()

      if (value !== null) {
        return resolve({ value, done: false })
      }

      stream
        .once('readable', onreadable)
        .once('close', onclose)
        .once('error', onerror)

      function onreadable() {
        const value = stream.read()

        ondone(
          null,
          value === null
            ? { value: undefined, done: true }
            : { value, done: false }
        )
      }

      function onclose() {
        ondone(null, { value: undefined, done: true })
      }

      function onerror(err) {
        ondone(err, null)
      }

      function ondone(err, value) {
        stream
          .off('readable', onreadable)
          .off('close', onclose)
          .off('error', onerror)

        if (err) reject(err)
        else resolve(value)
      }
    })
  }

  cancel(reason) {
    if (this._stream.destroyed) return Promise.resolve()

    return new Promise((resolve) =>
      this._stream.once('close', resolve).destroy(reason)
    )
  }
}

// https://streams.spec.whatwg.org/#readablestreamdefaultcontroller
exports.ReadableStreamDefaultController = class ReadableStreamDefaultController {
  constructor(stream) {
    this._stream = stream._stream
  }

  get desiredSize() {
    return (
      this._stream._readableState.highWaterMark -
      this._stream._readableState.buffered
    )
  }

  enqueue(data) {
    this._stream.push(data)
  }

  close() {
    this._stream.push(null)
  }

  error(err) {
    this._stream.destroy(err)
  }
}

// https://streams.spec.whatwg.org/#readablestream
exports.ReadableStream = class ReadableStream {
  constructor(underlyingSource = {}, queuingStrategy) {
    if (isStreamx(underlyingSource)) {
      this._stream = underlyingSource
    } else {
      if (queuingStrategy === undefined) {
        queuingStrategy = new exports.CountQueuingStrategy()
      }

      const { start, pull } = underlyingSource
      const { highWaterMark = 1, size = defaultSize } = queuingStrategy

      this._stream = new Readable({ highWaterMark, byteLength: size })

      const controller = new exports.ReadableStreamDefaultController(this)

      if (start) {
        this._stream._open = open.bind(this, start.call(this, controller))
      }

      if (pull) {
        this._stream._read = read.bind(this, pull.bind(this, controller))
      }
    }
  }

  getReader() {
    return new exports.ReadableStreamDefaultReader(this)
  }

  cancel(reason) {
    if (this._stream.destroyed) return Promise.resolve()

    return new Promise((resolve) =>
      this._stream.once('close', resolve).destroy(reason)
    )
  }

  pipeTo(destination) {
    return new Promise((resolve, reject) =>
      this._stream.pipe(destination, (err) => {
        err ? reject(err) : resolve()
      })
    )
  }

  [Symbol.asyncIterator]() {
    return this._stream[Symbol.asyncIterator]()
  }

  static from(iterable) {
    return new ReadableStream(Readable.from(iterable))
  }
}

async function open(starting, cb) {
  try {
    await starting

    cb(null)
  } catch (err) {
    cb(err)
  }
}

async function read(pull, cb) {
  try {
    await pull()

    cb(null)
  } catch (err) {
    cb(err)
  }
}

function defaultSize() {
  return 1
}

// https://streams.spec.whatwg.org/#countqueuingstrategy
exports.CountQueuingStrategy = class CountQueuingStrategy {
  constructor(opts = {}) {
    const { highWaterMark = 1 } = opts

    this.highWaterMark = highWaterMark
  }

  size(chunk) {
    return 1
  }
}

// https://streams.spec.whatwg.org/#bytelengthqueuingstrategy
exports.ByteLengthQueuingStrategy = class ByteLengthQueuingStrategy {
  constructor(opts = {}) {
    const { highWaterMark = 16384 } = opts

    this.highWaterMark = highWaterMark
  }

  size(chunk) {
    return chunk.byteLength
  }
}

// https://streams.spec.whatwg.org/#is-readable-stream-disturbed
exports.isReadableStreamDisturbed = function isReadableStreamDisturbed(stream) {
  return isDisturbed(stream._stream)
}
