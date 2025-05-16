const EventEmitter = require('bare-events')
const path = require('bare-path')
const { Readable, Writable } = require('bare-stream')
const binding = require('./binding')
const constants = require('./lib/constants')

const isWindows = Bare.platform === 'win32'

exports.constants = constants

// Lightly-modified from the Node FS internal utils.
function flagsToNumber(flags) {
  switch (flags) {
    case 'r':
      return constants.O_RDONLY
    case 'rs': // Fall through.
    case 'sr':
      return constants.O_RDONLY | constants.O_SYNC
    case 'r+':
      return constants.O_RDWR
    case 'rs+': // Fall through.
    case 'sr+':
      return constants.O_RDWR | constants.O_SYNC

    case 'w':
      return constants.O_TRUNC | constants.O_CREAT | constants.O_WRONLY
    case 'wx': // Fall through.
    case 'xw':
      return (
        constants.O_TRUNC |
        constants.O_CREAT |
        constants.O_WRONLY |
        constants.O_EXCL
      )

    case 'w+':
      return constants.O_TRUNC | constants.O_CREAT | constants.O_RDWR
    case 'wx+': // Fall through.
    case 'xw+':
      return (
        constants.O_TRUNC |
        constants.O_CREAT |
        constants.O_RDWR |
        constants.O_EXCL
      )

    case 'a':
      return constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY
    case 'ax': // Fall through.
    case 'xa':
      return (
        constants.O_APPEND |
        constants.O_CREAT |
        constants.O_WRONLY |
        constants.O_EXCL
      )
    case 'as': // Fall through.
    case 'sa':
      return (
        constants.O_APPEND |
        constants.O_CREAT |
        constants.O_WRONLY |
        constants.O_SYNC
      )

    case 'a+':
      return constants.O_APPEND | constants.O_CREAT | constants.O_RDWR
    case 'ax+': // Fall through.
    case 'xa+':
      return (
        constants.O_APPEND |
        constants.O_CREAT |
        constants.O_RDWR |
        constants.O_EXCL
      )
    case 'as+': // Fall through.
    case 'sa+':
      return (
        constants.O_APPEND |
        constants.O_CREAT |
        constants.O_RDWR |
        constants.O_SYNC
      )
  }

  throw typeError('ERR_INVALID_ARG_VALUE', `Invalid value in flags: ${flags}`)
}

function modeToNumber(mode) {
  mode = parseInt(mode, 8)
  if (isNaN(mode))
    throw typeError(
      'ERR_INVALID_ARG_VALUE',
      'Mode must be a number or octal string'
    )
  return mode
}

const free = []

function alloc() {
  const req = { handle: null, callback: null }
  req.handle = binding.init(req, onresponse)
  return req
}

function getReq() {
  return free.length ? free.pop() : alloc()
}

function onresponse(err, result) {
  const req = this
  const cb = req.callback
  req.callback = null
  free.push(req)
  cb(err, result)
}

function open(filepath, flags, mode, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof cb !== 'function') {
    if (typeof flags === 'function') {
      cb = flags
      flags = 'r'
      mode = 0o666
    } else if (typeof mode === 'function') {
      cb = mode
      mode = 0o666
    } else {
      throw typeError(
        'ERR_INVALID_ARG_TYPE',
        'Callback must be a function. Received type ' +
          typeof cb +
          ' (' +
          cb +
          ')'
      )
    }
  }

  if (typeof flags === 'string') flags = flagsToNumber(flags)
  if (typeof mode === 'string') mode = modeToNumber(mode)

  const req = getReq()
  req.callback = cb
  binding.open(req.handle, toNamespacedPath(filepath), flags, mode)
}

function openSync(filepath, flags = 'r', mode = 0o666) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof flags === 'string') flags = flagsToNumber(flags)
  if (typeof mode === 'string') mode = modeToNumber(mode)

  return binding.openSync(toNamespacedPath(filepath), flags, mode)
}

function close(fd, cb = noop) {
  if (typeof fd !== 'number') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'File descriptor must be a number. Received type ' +
        typeof fd +
        ' (' +
        fd +
        ')'
    )
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError(
      'ERR_OUT_OF_RANGE',
      'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' +
        fd
    )
  }

  if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  const req = getReq()
  req.callback = cb
  binding.close(req.handle, fd)
}

function closeSync(fd) {
  if (typeof fd !== 'number') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'File descriptor must be a number. Received type ' +
        typeof fd +
        ' (' +
        fd +
        ')'
    )
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError(
      'ERR_OUT_OF_RANGE',
      'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' +
        fd
    )
  }

  return binding.closeSync(fd)
}

function access(filepath, mode, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof cb !== 'function') {
    if (typeof mode === 'function') {
      cb = mode
      mode = constants.F_OK
    } else {
      throw typeError(
        'ERR_INVALID_ARG_TYPE',
        'Callback must be a function. Received type ' +
          typeof cb +
          ' (' +
          cb +
          ')'
      )
    }
  }

  const req = getReq()
  req.callback = cb
  binding.access(req.handle, toNamespacedPath(filepath), mode)
}

function accessSync(filepath, mode = constants.F_OK) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  binding.accessSync(toNamespacedPath(filepath), mode)
}

function exists(filepath, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  return access(toNamespacedPath(filepath), (err) => cb(!!err))
}

function existsSync(filepath) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  try {
    accessSync(toNamespacedPath(filepath))
    return true
  } catch {
    return false
  }
}

function read(fd, buffer, offset, len, pos, cb) {
  if (typeof fd !== 'number') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'File descriptor must be a number. Received type ' +
        typeof fd +
        ' (' +
        fd +
        ')'
    )
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError(
      'ERR_OUT_OF_RANGE',
      'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' +
        fd
    )
  }

  if (!Buffer.isBuffer(buffer) && !ArrayBuffer.isView(buffer)) {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Buffer must be a buffer. Received type ' +
        typeof buffer +
        ' (' +
        buffer +
        ')'
    )
  }

  if (typeof cb !== 'function') {
    if (typeof offset === 'function') {
      cb = offset
      offset = 0
      len = buffer.byteLength
      pos = -1
    } else if (typeof len === 'function') {
      cb = len
      len = buffer.byteLength - offset
      pos = -1
    } else if (typeof pos === 'function') {
      cb = pos
      pos = -1
    } else {
      throw typeError(
        'ERR_INVALID_ARG_TYPE',
        'Callback must be a function. Received type ' +
          typeof cb +
          ' (' +
          cb +
          ')'
      )
    }
  }

  if (typeof pos !== 'number') pos = -1

  const req = getReq()
  req.callback = cb
  binding.read(req.handle, fd, buffer, offset, len, pos)
}

function readSync(
  fd,
  buffer,
  offset = 0,
  len = buffer.byteLength - offset,
  pos = -1
) {
  if (typeof fd !== 'number') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'File descriptor must be a number. Received type ' +
        typeof fd +
        ' (' +
        fd +
        ')'
    )
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError(
      'ERR_OUT_OF_RANGE',
      'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' +
        fd
    )
  }

  if (!Buffer.isBuffer(buffer) && !ArrayBuffer.isView(buffer)) {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Buffer must be a buffer. Received type ' +
        typeof buffer +
        ' (' +
        buffer +
        ')'
    )
  }

  return binding.readSync(fd, buffer, offset, len, pos)
}

function readv(fd, buffers, pos, cb) {
  if (typeof fd !== 'number') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'File descriptor must be a number. Received type ' +
        typeof fd +
        ' (' +
        fd +
        ')'
    )
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError(
      'ERR_OUT_OF_RANGE',
      'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' +
        fd
    )
  }

  if (typeof pos === 'function') {
    cb = pos
    pos = -1
  } else if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  if (typeof pos !== 'number') pos = -1

  const req = getReq()
  req.callback = cb
  binding.readv(req.handle, fd, buffers, pos)
}

function write(fd, data, offset, len, pos, cb) {
  if (typeof fd !== 'number') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'File descriptor must be a number. Received type ' +
        typeof fd +
        ' (' +
        fd +
        ')'
    )
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError(
      'ERR_OUT_OF_RANGE',
      'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' +
        fd
    )
  }

  if (
    typeof data !== 'string' &&
    !Buffer.isBuffer(data) &&
    !ArrayBuffer.isView(data)
  ) {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Data must be a string or buffer. Received type ' + typeof data
    )
  }

  if (typeof data === 'string') {
    let encoding = len
    cb = pos
    pos = offset

    if (typeof cb !== 'function') {
      if (typeof pos === 'function') {
        cb = pos
        pos = -1
        encoding = 'utf8'
      } else if (typeof encoding === 'function') {
        cb = encoding
        encoding = 'utf8'
      } else {
        throw typeError(
          'ERR_INVALID_ARG_TYPE',
          'Callback must be a function. Received type ' +
            typeof cb +
            ' (' +
            cb +
            ')'
        )
      }
    }

    if (typeof pos === 'string') {
      encoding = pos
      pos = -1
    }

    data = Buffer.from(data, encoding)
    offset = 0
    len = data.byteLength
  } else if (typeof cb !== 'function') {
    if (typeof offset === 'function') {
      cb = offset
      offset = 0
      len = data.byteLength
      pos = -1
    } else if (typeof len === 'function') {
      cb = len
      len = data.byteLength - offset
      pos = -1
    } else if (typeof pos === 'function') {
      cb = pos
      pos = -1
    } else {
      throw typeError(
        'ERR_INVALID_ARG_TYPE',
        'Callback must be a function. Received type ' +
          typeof cb +
          ' (' +
          cb +
          ')'
      )
    }
  }

  if (typeof pos !== 'number') pos = -1

  const req = getReq()
  req.callback = cb
  binding.write(req.handle, fd, data, offset, len, pos)
}

function writeSync(fd, data, offset = 0, len, pos) {
  if (typeof fd !== 'number') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'File descriptor must be a number. Received type ' +
        typeof fd +
        ' (' +
        fd +
        ')'
    )
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError(
      'ERR_OUT_OF_RANGE',
      'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' +
        fd
    )
  }

  if (
    typeof data !== 'string' &&
    !Buffer.isBuffer(data) &&
    !ArrayBuffer.isView(data)
  ) {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Data must be a string or buffer. Received type ' + typeof data
    )
  }

  if (typeof data === 'string') data = Buffer.from(data)

  if (typeof len !== 'number') len = data.byteLength - offset

  if (typeof pos !== 'number') pos = -1

  return binding.writeSync(fd, data, offset, len, pos)
}

function writev(fd, buffers, pos, cb) {
  if (typeof fd !== 'number') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'File descriptor must be a number. Received type ' +
        typeof fd +
        ' (' +
        fd +
        ')'
    )
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError(
      'ERR_OUT_OF_RANGE',
      'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' +
        fd
    )
  }

  if (typeof pos === 'function') {
    cb = pos
    pos = -1
  } else if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  if (typeof pos !== 'number') pos = -1

  const req = getReq()
  req.callback = cb
  binding.writev(req.handle, fd, buffers, pos)
}

function stat(filepath, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  const data = new Array(Stats.length)

  const req = getReq()

  req.callback = function (err, _) {
    if (err) cb(err, null)
    else cb(null, new Stats(...data))
  }

  binding.stat(req.handle, toNamespacedPath(filepath), data)
}

function statSync(filepath) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  return new Stats(...binding.statSync(toNamespacedPath(filepath)))
}

function lstat(filepath, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  const data = new Array(Stats.length)

  const req = getReq()

  req.callback = function (err, _) {
    if (err) cb(err, null)
    else cb(null, new Stats(...data))
  }

  binding.lstat(req.handle, toNamespacedPath(filepath), data)
}

function lstatSync(filepath) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  return new Stats(...binding.lstatSync(toNamespacedPath(filepath)))
}

function fstat(fd, cb) {
  if (typeof fd !== 'number') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'File descriptor must be a number. Received type ' +
        typeof fd +
        ' (' +
        fd +
        ')'
    )
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError(
      'ERR_OUT_OF_RANGE',
      'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' +
        fd
    )
  }

  if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  const data = new Array(Stats.length)

  const req = getReq()

  req.callback = function (err, _) {
    if (err) cb(err, null)
    else cb(null, new Stats(...data))
  }

  binding.fstat(req.handle, fd, data)
}

function fstatSync(fd) {
  if (typeof fd !== 'number') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'File descriptor must be a number. Received type ' +
        typeof fd +
        ' (' +
        fd +
        ')'
    )
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError(
      'ERR_OUT_OF_RANGE',
      'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' +
        fd
    )
  }

  return new Stats(...binding.fstatSync(fd))
}

function ftruncate(fd, len, cb) {
  if (typeof fd !== 'number') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'File descriptor must be a number. Received type ' +
        typeof fd +
        ' (' +
        fd +
        ')'
    )
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError(
      'ERR_OUT_OF_RANGE',
      'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' +
        fd
    )
  }

  if (typeof len === 'function') {
    cb = len
    len = 0
  } else if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  if (typeof len !== 'number') len = 0

  const req = getReq()
  req.callback = cb
  binding.ftruncate(req.handle, fd, len)
}

function ftruncateSync(fd, len) {
  if (typeof fd !== 'number') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'File descriptor must be a number. Received type ' +
        typeof fd +
        ' (' +
        fd +
        ')'
    )
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError(
      'ERR_OUT_OF_RANGE',
      'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' +
        fd
    )
  }

  if (typeof len !== 'number') len = 0

  binding.ftruncateSync(fd, len)
}

function chmod(filepath, mode, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof mode === 'string') mode = modeToNumber(mode)

  const req = getReq()
  req.callback = cb
  binding.chmod(req.handle, toNamespacedPath(filepath), mode)
}

function chmodSync(filepath, mode) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof mode === 'string') mode = modeToNumber(mode)

  binding.chmodSync(toNamespacedPath(filepath), mode)
}

function fchmod(fd, mode, cb) {
  if (typeof fd !== 'number') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'File descriptor must be a number. Received type ' +
        typeof fd +
        ' (' +
        fd +
        ')'
    )
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError(
      'ERR_OUT_OF_RANGE',
      'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' +
        fd
    )
  }

  if (typeof mode === 'string') mode = modeToNumber(mode)

  const req = getReq()
  req.callback = cb
  binding.fchmod(req.handle, fd, mode)
}

function fchmodSync(fd, mode) {
  if (typeof fd !== 'number') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'File descriptor must be a number. Received type ' +
        typeof fd +
        ' (' +
        fd +
        ')'
    )
  }

  if (fd < 0 || fd > 0x7fffffff) {
    throw typeError(
      'ERR_OUT_OF_RANGE',
      'File descriptor is out of range. It must be >= 0 && <= 2147483647. Received ' +
        fd
    )
  }

  if (typeof mode === 'string') mode = modeToNumber(mode)

  binding.fchmodSync(fd, mode)
}

function mkdirRecursive(filepath, mode, cb) {
  filepath = toNamespacedPath(filepath)

  mkdir(filepath, { mode }, function (err) {
    if (err === null) return cb(null, 0, null)

    if (err.code !== 'ENOENT') {
      stat(filepath, function (e, st) {
        if (e) return cb(e, e.errno, null)
        if (st.isDirectory()) return cb(null, 0, null)
        cb(err, err.errno, null)
      })
      return
    }

    while (filepath.endsWith(path.sep)) filepath = filepath.slice(0, -1)
    const i = filepath.lastIndexOf(path.sep)
    if (i <= 0) return cb(err, err.errno, null)

    mkdirRecursive(filepath.slice(0, i), mode, function (err) {
      if (err) return cb(err, err.errno, null)

      mkdir(filepath, { mode }, function (err) {
        if (err === null) return cb(null, 0, null)

        stat(filepath, function (e, st) {
          if (e) return cb(e, e.errno, null)
          if (st.isDirectory()) return cb(null, 0, null)
          cb(err, err.errno, null)
        })
      })
    })
  })
}

function mkdir(filepath, opts, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = { mode: 0o777 }
  } else if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  if (typeof opts === 'number') opts = { mode: opts }
  else if (!opts) opts = {}

  const mode = typeof opts.mode === 'number' ? opts.mode : 0o777

  filepath = toNamespacedPath(filepath)

  if (opts.recursive) return mkdirRecursive(filepath, mode, cb)

  const req = getReq()
  req.callback = cb
  binding.mkdir(req.handle, filepath, mode)
}

function mkdirRecursiveSync(filepath, mode) {
  filepath = toNamespacedPath(filepath)

  try {
    mkdirSync(filepath, { mode })
  } catch (err) {
    if (err.code !== 'ENOENT' && statSync(filepath).isDirectory()) {
      return
    }

    while (filepath.endsWith(path.sep)) filepath = filepath.slice(0, -1)
    const i = filepath.lastIndexOf(path.sep)
    if (i <= 0) throw err

    mkdirRecursiveSync(filepath.slice(0, i), { mode })

    try {
      mkdirSync(filepath, { mode })
    } catch (err) {
      if (statSync(filepath).isDirectory()) {
        return
      }

      throw err
    }
  }
}

function mkdirSync(filepath, opts) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof opts === 'number') opts = { mode: opts }
  else if (!opts) opts = {}

  const mode = typeof opts.mode === 'number' ? opts.mode : 0o777

  filepath = toNamespacedPath(filepath)

  if (opts.recursive) return mkdirRecursiveSync(filepath, mode)

  binding.mkdirSync(filepath, mode)
}

function rmdir(filepath, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  const req = getReq()
  req.callback = cb
  binding.rmdir(req.handle, toNamespacedPath(filepath))
}

function rmdirSync(filepath) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  binding.rmdirSync(toNamespacedPath(filepath))
}

function rmRecursive(filepath, opts, cb) {
  filepath = toNamespacedPath(filepath)

  rmdir(filepath, function (err) {
    if (err === null) return cb(null)

    if (err.code !== 'ENOTEMPTY') return cb(err)

    readdir(filepath, function (err, files) {
      if (err) return cb(err)

      if (files.length === 0) return rmdir(filepath, cb)

      let missing = files.length
      let done = false

      for (const file of files) {
        rm(filepath + path.sep + file, opts, function (err) {
          if (done) return

          if (err) {
            done = true
            return cb(err)
          }

          if (--missing === 0) rmdir(filepath, cb)
        })
      }
    })
  })
}

function rm(filepath, opts, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  } else if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  if (!opts) opts = {}

  filepath = toNamespacedPath(filepath)

  lstat(filepath, function (err, st) {
    if (err) {
      return cb(err.code === 'ENOENT' && opts.force ? null : err)
    }

    if (st.isDirectory()) {
      if (opts.recursive) return rmRecursive(filepath, opts, cb)

      const err = new Error('is a directory')
      err.code = 'EISDIR'
      return cb(err)
    }

    unlink(filepath, cb)
  })
}

function rmRecursiveSync(filepath, opts) {
  filepath = toNamespacedPath(filepath)

  try {
    rmdirSync(filepath)
  } catch (err) {
    if (err.code !== 'ENOTEMPTY') throw err

    const files = readdirSync(filepath)

    for (const file of files) {
      rmSync(filepath + path.sep + file, opts)
    }

    rmdirSync(filepath)
  }
}

function rmSync(filepath, opts) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (!opts) opts = {}

  filepath = toNamespacedPath(filepath)

  try {
    const st = lstatSync(filepath)

    if (st.isDirectory()) {
      if (opts.recursive) return rmRecursiveSync(filepath, opts)

      const err = new Error('is a directory')
      err.code = 'EISDIR'
      throw err
    }

    unlinkSync(filepath)
  } catch (err) {
    if (err.code !== 'ENOENT' || !opts.force) throw err
  }
}

function unlink(filepath, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  const req = getReq()
  req.callback = cb
  binding.unlink(req.handle, toNamespacedPath(filepath))
}

function unlinkSync(filepath) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  binding.unlinkSync(toNamespacedPath(filepath))
}

function rename(src, dst, cb) {
  if (typeof src !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' + typeof src + ' (' + src + ')'
    )
  }

  if (typeof dst !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' + typeof dst + ' (' + dst + ')'
    )
  }

  if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  const req = getReq()
  req.callback = cb
  binding.rename(req.handle, src, dst)
}

function renameSync(src, dst) {
  if (typeof src !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' + typeof src + ' (' + src + ')'
    )
  }

  if (typeof dst !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' + typeof dst + ' (' + dst + ')'
    )
  }

  binding.renameSync(src, dst)
}

function copyFile(src, dst, mode, cb) {
  if (typeof mode === 'function') {
    cb = mode
    mode = 0
  }

  if (typeof src !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' + typeof src + ' (' + src + ')'
    )
  }

  if (typeof dst !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' + typeof dst + ' (' + dst + ')'
    )
  }

  const req = getReq()
  req.callback = cb
  binding.copyfile(req.handle, src, dst, mode)
}

function copyFileSync(src, dst, mode = 0) {
  if (typeof src !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' + typeof src + ' (' + src + ')'
    )
  }

  if (typeof dst !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' + typeof dst + ' (' + dst + ')'
    )
  }

  binding.copyfileSync(src, dst, mode)
}

function realpath(filepath, opts, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  } else if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  const { encoding = 'utf8' } = opts

  const data = Buffer.allocUnsafe(binding.sizeofFSPath)

  const req = getReq()

  req.callback = function (err, _) {
    if (err) return cb(err, null)
    let path = data.subarray(0, data.indexOf(0))
    if (encoding !== 'buffer') path = path.toString(encoding)
    cb(null, path)
  }

  binding.realpath(req.handle, toNamespacedPath(filepath), data)
}

function realpathSync(filepath, opts) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  const { encoding = 'utf8' } = opts

  const data = Buffer.allocUnsafe(binding.sizeofFSPath)

  binding.realpathSync(toNamespacedPath(filepath), data)

  filepath = data.subarray(0, data.indexOf(0))
  if (encoding !== 'buffer') filepath = filepath.toString(encoding)
  return filepath
}

function readlink(filepath, opts, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  } else if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  const { encoding = 'utf8' } = opts

  const data = Buffer.allocUnsafe(binding.sizeofFSPath)

  const req = getReq()

  req.callback = function (err, _) {
    if (err) return cb(err, null)
    let path = data.subarray(0, data.indexOf(0))
    if (encoding !== 'buffer') path = path.toString(encoding)
    cb(null, path)
  }

  binding.readlink(req.handle, toNamespacedPath(filepath), data)
}

function readlinkSync(filepath, opts) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  const { encoding = 'utf8' } = opts

  const data = Buffer.allocUnsafe(binding.sizeofFSPath)

  binding.readlinkSync(toNamespacedPath(filepath), data)

  filepath = data.subarray(0, data.indexOf(0))
  if (encoding !== 'buffer') filepath = filepath.toString(encoding)
  return filepath
}

function normalizeSymlinkTarget(target, type, filepath) {
  if (isWindows) {
    if (type === 'junction') target = path.resolve(filepath, '..', target)

    if (path.isAbsolute(target)) return path.toNamespacedPath(target)

    return target.replace(/\//g, path.sep)
  }

  return target
}

function symlink(target, filepath, type, cb) {
  if (typeof target !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Target must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof type === 'function') {
    cb = type
    type = null
  } else if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  filepath = toNamespacedPath(filepath)

  if (typeof type === 'string') {
    switch (type) {
      case 'file':
        type = 0
        break
      case 'dir':
        type = constants.UV_FS_SYMLINK_DIR
        break
      case 'junction':
        type = constants.UV_FS_SYMLINK_JUNCTION
        break
      default:
        throw typeError(
          'ERR_FS_INVALID_SYMLINK_TYPE',
          'Symlink type must be one of "dir", "file", or "junction". Received "' +
            type +
            '"'
        )
    }
  } else if (typeof type !== 'number') {
    if (isWindows) {
      target = path.resolve(filepath, '..', target)

      stat(target, (err, st) => {
        type =
          err === null && st.isDirectory()
            ? constants.UV_FS_SYMLINK_DIR
            : constants.UV_FS_SYMLINK_JUNCTION

        symlink(target, filepath, type, cb)
      })

      return
    }

    type = 0
  }

  const req = getReq()
  req.callback = cb
  binding.symlink(req.handle, normalizeSymlinkTarget(target), filepath, type)
}

function symlinkSync(target, filepath, type) {
  if (typeof target !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Target must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  filepath = toNamespacedPath(filepath)

  if (typeof type === 'string') {
    switch (type) {
      case 'file':
        type = 0
        break
      case 'dir':
        type = constants.UV_FS_SYMLINK_DIR
        break
      case 'junction':
        type = constants.UV_FS_SYMLINK_JUNCTION
        break
      default:
        throw typeError(
          'ERR_FS_INVALID_SYMLINK_TYPE',
          'Symlink type must be one of "dir", "file", or "junction". Received "' +
            type +
            '"'
        )
    }
  } else if (typeof type !== 'number') {
    if (isWindows) {
      target = path.resolve(filepath, '..', target)

      type = statSync(target).isDirectory()
        ? constants.UV_FS_SYMLINK_DIR
        : constants.UV_FS_SYMLINK_JUNCTION
    } else {
      type = 0
    }
  }

  binding.symlinkSync(normalizeSymlinkTarget(target), filepath, type)
}

function opendir(filepath, opts, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  } else if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  filepath = toNamespacedPath(filepath)

  const data = Buffer.allocUnsafe(binding.sizeofFSDir)

  const req = getReq()

  req.callback = function (err, _) {
    if (err) return cb(err, null)
    cb(null, new Dir(filepath, data, opts))
  }

  binding.opendir(req.handle, filepath, data)
}

function opendirSync(filepath, opts) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  filepath = toNamespacedPath(filepath)

  const data = Buffer.allocUnsafe(binding.sizeofFSDir)
  binding.opendirSync(filepath, data)
  return new Dir(filepath, data, opts)
}

function readdir(filepath, opts, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  } else if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  const { withFileTypes = false } = opts

  opendir(toNamespacedPath(filepath), opts, async (err, dir) => {
    if (err) return cb(err, null)
    const result = []
    for await (const entry of dir) {
      result.push(withFileTypes ? entry : entry.name)
    }
    cb(null, result)
  })
}

function readdirSync(filepath, opts) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  const { withFileTypes = false } = opts

  const dir = opendirSync(toNamespacedPath(filepath), opts)
  const result = []

  while (true) {
    const entry = dir.readSync()
    if (entry === null) break
    result.push(withFileTypes ? entry : entry.name)
  }

  return result
}

function readFile(filepath, opts, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  } else if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  const { encoding = 'buffer' } = opts

  open(filepath, opts.flag || 'r', function (err, fd) {
    if (err) return cb(err)

    fstat(fd, function (err, st) {
      if (err) return closeAndError(err)

      let buffer = Buffer.allocUnsafe(st.size)
      let len = 0

      read(fd, buffer, loop)

      function loop(err, r) {
        if (err) return closeAndError(err)
        len += r
        if (r === 0 || len === buffer.byteLength) return done()
        read(fd, buffer.subarray(len), loop)
      }

      function done() {
        if (len !== buffer.byteLength) buffer = buffer.subarray(0, len)
        close(fd, function (err) {
          if (err) return cb(err)
          if (encoding !== 'buffer') buffer = buffer.toString(encoding)
          cb(null, buffer)
        })
      }
    })

    function closeAndError(err) {
      close(fd, function () {
        cb(err)
      })
    }
  })
}

function readFileSync(filepath, opts) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  const { encoding = 'buffer' } = opts

  const fd = openSync(filepath, opts.flag || 'r')

  try {
    const st = fstatSync(fd)

    let buffer = Buffer.allocUnsafe(st.size)
    let len = 0

    while (true) {
      const r = readSync(fd, len ? buffer.subarray(len) : buffer)
      len += r
      if (r === 0 || len === buffer.byteLength) break
    }

    if (len !== buffer.byteLength) buffer = buffer.subarray(0, len)
    if (encoding !== 'buffer') buffer = buffer.toString(encoding)
    return buffer
  } finally {
    try {
      closeSync(fd)
    } catch {}
  }
}

function writeFile(filepath, data, opts, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (
    typeof data !== 'string' &&
    !Buffer.isBuffer(data) &&
    !ArrayBuffer.isView(data)
  ) {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Data must be a string or buffer. Received type ' + typeof data
    )
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  } else if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  if (typeof data === 'string') data = Buffer.from(data, opts.encoding)

  open(filepath, opts.flag || 'w', opts.mode || 0o666, function (err, fd) {
    if (err) return cb(err)

    write(fd, data, loop)

    function loop(err, w) {
      if (err) return closeAndError(err)
      if (w === data.byteLength) return done()
      write(fd, data.subarray(w), loop)
    }

    function done() {
      close(fd, function (err) {
        if (err) return cb(err)
        return cb(null)
      })
    }

    function closeAndError(err) {
      close(fd, function () {
        cb(err)
      })
    }
  })
}

function writeFileSync(filepath, data, opts) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (
    typeof data !== 'string' &&
    !Buffer.isBuffer(data) &&
    !ArrayBuffer.isView(data)
  ) {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Data must be a string or buffer. Received type ' + typeof data
    )
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  if (typeof data === 'string') data = Buffer.from(data, opts.encoding)

  const fd = openSync(filepath, opts.flag || 'w', opts.mode)

  try {
    let len = 0

    while (true) {
      len += writeSync(fd, len ? data.subarray(len) : data)
      if (len === data.byteLength) break
    }
  } finally {
    try {
      closeSync(fd)
    } catch {}
  }
}

function appendFile(filepath, data, opts, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (
    typeof data !== 'string' &&
    !Buffer.isBuffer(data) &&
    !ArrayBuffer.isView(data)
  ) {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Data must be a string or buffer. Received type ' + typeof data
    )
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  } else if (typeof cb !== 'function') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Callback must be a function. Received type ' +
        typeof cb +
        ' (' +
        cb +
        ')'
    )
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  opts = { ...opts }

  if (!opts.flags) opts.flag = 'a'

  return writeFile(filepath, data, opts, cb)
}

function appendFileSync(filepath, data, opts) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (
    typeof data !== 'string' &&
    !Buffer.isBuffer(data) &&
    !ArrayBuffer.isView(data)
  ) {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Data must be a string or buffer. Received type ' + typeof data
    )
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  opts = { ...opts }

  if (!opts.flags) opts.flag = 'a'

  return writeFileSync(filepath, data, opts)
}

function watch(filepath, opts, cb) {
  if (typeof filepath !== 'string') {
    throw typeError(
      'ERR_INVALID_ARG_TYPE',
      'Path must be a string. Received type ' +
        typeof filepath +
        ' (' +
        filepath +
        ')'
    )
  }

  if (typeof opts === 'function') {
    cb = opts
    opts = {}
  }

  if (typeof opts === 'string') opts = { encoding: opts }
  else if (!opts) opts = {}

  const watcher = new Watcher(toNamespacedPath(filepath), opts)
  if (cb) watcher.on('change', cb)
  return watcher
}

class Stats {
  constructor(
    dev,
    mode,
    nlink,
    uid,
    gid,
    rdev,
    blksize,
    ino,
    size,
    blocks,
    atimeMs,
    mtimeMs,
    ctimeMs,
    birthtimeMs
  ) {
    this.dev = dev
    this.mode = mode
    this.nlink = nlink
    this.uid = uid
    this.gid = gid
    this.rdev = rdev
    this.blksize = blksize
    this.ino = ino
    this.size = size
    this.blocks = blocks
    this.atimeMs = atimeMs
    this.mtimeMs = mtimeMs
    this.ctimeMs = ctimeMs
    this.birthtimeMs = birthtimeMs
    this.atime = new Date(atimeMs)
    this.mtime = new Date(mtimeMs)
    this.ctime = new Date(ctimeMs)
    this.birthtime = new Date(birthtimeMs)
  }

  isDirectory() {
    return (this.mode & constants.S_IFMT) === constants.S_IFDIR
  }

  isFile() {
    return (this.mode & constants.S_IFMT) === constants.S_IFREG
  }

  isBlockDevice() {
    return (this.mode & constants.S_IFMT) === constants.S_IFBLK
  }

  isCharacterDevice() {
    return (this.mode & constants.S_IFCHR) === constants.S_IFCHR
  }

  isFIFO() {
    return (this.mode & constants.S_IFMT) === constants.S_IFIFO
  }

  isSymbolicLink() {
    return (this.mode & constants.S_IFMT) === constants.S_IFLNK
  }

  isSocket() {
    return (this.mode & constants.S_IFMT) === constants.S_IFSOCK
  }
}

class Dir {
  constructor(path, handle, opts = {}) {
    const { encoding = 'utf8', bufferSize = 32 } = opts

    this._handle = handle
    this._dirents = Buffer.allocUnsafe(binding.sizeofFSDirent * bufferSize)
    this._encoding = encoding
    this._buffer = []
    this._ended = false

    this.path = path
  }

  read(cb) {
    if (!cb) return promisify(this.read.bind(this))

    if (this._buffer.length)
      return queueMicrotask(() => cb(null, this._buffer.shift()))
    if (this._ended) return queueMicrotask(() => cb(null, null))

    const data = []
    const req = getReq()

    req.callback = (err, _) => {
      if (err) return cb(err, null)
      if (data.length === 0) this._ended = true
      else {
        for (const entry of data) {
          let name = Buffer.from(entry.name)
          if (this._encoding !== 'buffer') name = name.toString(this._encoding)
          this._buffer.push(new Dirent(this.path, name, entry.type))
        }
      }

      if (this._ended) return cb(null, null)
      cb(null, this._buffer.shift())
    }

    binding.readdir(req.handle, this._handle, this._dirents, data)
  }

  readSync() {
    if (this._buffer.length) return this._buffer.shift()
    if (this._ended) return null

    const data = []

    binding.readdirSync(this._handle, this._dirents, data)

    if (data.length === 0) this._ended = true
    else {
      for (const entry of data) {
        let name = Buffer.from(entry.name)
        if (this._encoding !== 'buffer') name = name.toString(this._encoding)
        this._buffer.push(new Dirent(this.path, name, entry.type))
      }
    }

    if (this._ended) return null
    return this._buffer.shift()
  }

  close(cb) {
    if (!cb) return promisify(this.close.bind(this))

    const req = getReq()

    req.callback = (err, _) => {
      this._handle = null
      cb(err)
    }

    binding.closedir(req.handle, this._handle)
  }

  closeSync() {
    binding.closedirSync(this._handle)
    this._handle = null
  }

  [Symbol.iterator]() {
    return {
      next: () => {
        if (this._buffer.length) {
          return { done: false, value: this._buffer.shift() }
        }

        if (this._ended) {
          return { done: true }
        }

        const entry = this.readSync()

        if (entry) {
          return { done: false, value: entry }
        }

        this.closeSync()

        return { done: true }
      }
    }
  }

  [Symbol.asyncIterator]() {
    return {
      next: () =>
        new Promise((resolve, reject) => {
          if (this._buffer.length) {
            return resolve({ done: false, value: this._buffer.shift() })
          }

          if (this._ended) {
            return resolve({ done: true })
          }

          this.read((err, entry) => {
            if (err) return reject(err)

            if (entry) {
              return resolve({ done: false, value: entry })
            }

            this.close((err) => (err ? reject(err) : resolve({ done: true })))
          })
        })
    }
  }
}

class Dirent {
  constructor(path, name, type) {
    this.path = path
    this.name = name
    this.type = type
  }

  isFile() {
    return this.type === constants.UV_DIRENT_FILE
  }

  isDirectory() {
    return this.type === constants.UV_DIRENT_DIR
  }

  isSymbolicLink() {
    return this.type === constants.UV_DIRENT_LINK
  }

  isFIFO() {
    return this.type === constants.UV_DIRENT_FIFO
  }

  isSocket() {
    return this.type === constants.UV_DIRENT_SOCKET
  }

  isCharacterDevice() {
    return this.type === constants.UV_DIRENT_CHAR
  }

  isBlockDevice() {
    return this.type === constants.UV_DIRENT_BLOCK
  }
}

class FileWriteStream extends Writable {
  constructor(path, opts = {}) {
    super({ map })

    this.path = path
    this.fd = 0
    this.flags = opts.flags || 'w'
    this.mode = opts.mode || 0o666
  }

  _open(cb) {
    open(this.path, this.flags, this.mode, (err, fd) => {
      if (err) return cb(err)
      this.fd = fd
      cb(null)
    })
  }

  _writev(batch, cb) {
    writev(
      this.fd,
      batch.map(({ chunk }) => chunk),
      cb
    )
  }

  _destroy(err, cb) {
    if (!this.fd) return cb(err)
    close(this.fd, () => cb(err))
  }
}

class FileReadStream extends Readable {
  constructor(path, opts = {}) {
    super()

    this.path = path
    this.fd = 0

    this._offset = opts.start || 0
    this._missing = 0

    if (opts.length) {
      this._missing = opts.length
    } else if (typeof opts.end === 'number') {
      this._missing = opts.end - this._offset + 1
    } else {
      this._missing = -1
    }
  }

  _open(cb) {
    open(this.path, constants.O_RDONLY, (err, fd) => {
      if (err) return cb(err)

      const onerror = (err) => close(fd, () => cb(err))

      fstat(fd, (err, st) => {
        if (err) return onerror(err)
        if (!st.isFile())
          return onerror(new Error(this.path + ' is not a file'))

        this.fd = fd
        if (this._missing === -1) this._missing = st.size

        if (st.size < this._offset) {
          this._offset = st.size
          this._missing = 0
          return cb(null)
        }
        if (st.size < this._offset + this._missing) {
          this._missing = st.size - this._offset
          return cb(null)
        }

        cb(null)
      })
    })
  }

  _read(size) {
    if (!this._missing) {
      this.push(null)
      return
    }

    const data = Buffer.allocUnsafe(Math.min(this._missing, size))

    read(this.fd, data, 0, data.byteLength, this._offset, (err, read) => {
      if (err) return this.destroy(err)

      if (!read) {
        this.push(null)
        return
      }

      if (this._missing < read) read = this._missing
      this.push(data.subarray(0, read))
      this._missing -= read
      this._offset += read
      if (!this._missing) this.push(null)
    })
  }

  _destroy(err, cb) {
    if (!this.fd) return cb(err)
    close(this.fd, () => cb(err))
  }
}

class Watcher extends EventEmitter {
  constructor(path, opts) {
    const { persistent = true, recursive = false, encoding = 'utf8' } = opts

    super()

    this._closed = false
    this._encoding = encoding
    this._handle = binding.watcherInit(
      path,
      recursive,
      this,
      this._onevent,
      this._onclose
    )

    if (!persistent) this.unref()
  }

  _onevent(err, events, filename) {
    if (err) {
      this.close()
      this.emit('error', err)
    } else {
      const path =
        this._encoding === 'buffer'
          ? Buffer.from(filename)
          : Buffer.from(filename).toString(this._encoding)

      if (events & binding.UV_RENAME) {
        this.emit('change', 'rename', path)
      }

      if (events & binding.UV_CHANGE) {
        this.emit('change', 'change', path)
      }
    }
  }

  _onclose() {
    this._handle = null

    this.emit('close')
  }

  close() {
    if (this._closed) return
    this._closed = true

    binding.watcherClose(this._handle)
  }

  ref() {
    if (this._handle) binding.watcherRef(this._handle)
    return this
  }

  unref() {
    if (this._handle) binding.watcherUnref(this._handle)
    return this
  }

  [Symbol.asyncIterator]() {
    const buffer = []
    let done = false
    let error = null
    let next = null

    this.on('change', (eventType, filename) => {
      if (next) {
        next.resolve({ done: false, value: { eventType, filename } })
        next = null
      } else {
        buffer.push({ eventType, filename })
      }
    })
      .on('error', (err) => {
        done = true
        error = err

        if (next) {
          next.reject(error)
          next = null
        }
      })
      .on('close', () => {
        done = true

        if (next) {
          next.resolve({ done })
          next = null
        }
      })

    return {
      next: () =>
        new Promise((resolve, reject) => {
          if (error) return reject(error)

          if (buffer.length)
            return resolve({ done: false, value: buffer.shift() })

          if (done) return resolve({ done })

          next = { resolve, reject }
        })
    }
  }
}

exports.promises = {}

function typeError(code, message) {
  const error = new TypeError(message)
  error.code = code
  return error
}

function noop() {}

exports.access = access
exports.appendFile = appendFile
exports.chmod = chmod
exports.close = close
exports.copyFile = copyFile
exports.exists = exists
exports.fchmod = fchmod
exports.fstat = fstat
exports.ftruncate = ftruncate
exports.lstat = lstat
exports.mkdir = mkdir
exports.open = open
exports.opendir = opendir
exports.read = read
exports.readFile = readFile
exports.readdir = readdir
exports.readlink = readlink
exports.readv = readv
exports.realpath = realpath
exports.rename = rename
exports.rm = rm
exports.rmdir = rmdir
exports.stat = stat
exports.symlink = symlink
exports.unlink = unlink
exports.watch = watch
exports.write = write
exports.writeFile = writeFile
exports.writev = writev

exports.accessSync = accessSync
exports.appendFileSync = appendFileSync
exports.chmodSync = chmodSync
exports.closeSync = closeSync
exports.copyFileSync = copyFileSync
exports.existsSync = existsSync
exports.fchmodSync = fchmodSync
exports.fstatSync = fstatSync
exports.ftruncateSync = ftruncateSync
exports.lstatSync = lstatSync
exports.mkdirSync = mkdirSync
exports.openSync = openSync
exports.opendirSync = opendirSync
exports.readFileSync = readFileSync
exports.readSync = readSync
exports.readdirSync = readdirSync
exports.readlinkSync = readlinkSync
exports.realpathSync = realpathSync
exports.renameSync = renameSync
exports.rmSync = rmSync
exports.rmdirSync = rmdirSync
exports.statSync = statSync
exports.symlinkSync = symlinkSync
exports.unlinkSync = unlinkSync
exports.writeFileSync = writeFileSync
exports.writeSync = writeSync

exports.promises.access = promisify(access)
exports.promises.appendFile = promisify(appendFile)
exports.promises.chmod = promisify(chmod)
exports.promises.copyFile = promisify(copyFile)
exports.promises.lstat = promisify(lstat)
exports.promises.mkdir = promisify(mkdir)
exports.promises.opendir = promisify(opendir)
exports.promises.readFile = promisify(readFile)
exports.promises.readdir = promisify(readdir)
exports.promises.readlink = promisify(readlink)
exports.promises.realpath = promisify(realpath)
exports.promises.rename = promisify(rename)
exports.promises.rm = promisify(rm)
exports.promises.rmdir = promisify(rmdir)
exports.promises.stat = promisify(stat)
exports.promises.symlink = promisify(symlink)
exports.promises.unlink = promisify(unlink)
exports.promises.writeFile = promisify(writeFile)

exports.promises.watch = watch // Already async iterable

exports.Stats = Stats
exports.Dir = Dir
exports.Dirent = Dirent
exports.Watcher = Watcher

exports.ReadStream = FileReadStream
exports.createReadStream = function createReadStream(path, opts) {
  return new FileReadStream(path, opts)
}

exports.WriteStream = FileWriteStream
exports.createWriteStream = function createWriteStream(path, opts) {
  return new FileWriteStream(path, opts)
}

function promisify(fn) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      fn(...args, function (err, res) {
        if (err) return reject(err)
        resolve(res)
      })
    })
  }
}

function map(data) {
  return typeof data === 'string' ? Buffer.from(data) : data
}

function toNamespacedPath(filepath) {
  return path.toNamespacedPath(filepath)
}
