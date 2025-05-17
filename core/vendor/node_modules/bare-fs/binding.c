#include <assert.h>
#include <bare.h>
#include <js.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <utf.h>
#include <uv.h>

#ifndef _MSC_VER
#include <unistd.h>
#endif

typedef struct {
  uv_fs_t handle;

  js_env_t *env;
  js_ref_t *ctx;
  js_ref_t *on_response;

  js_ref_t *data;

  bool active;
  bool exiting;

  js_deferred_teardown_t *teardown;
} bare_fs_t;

typedef utf8_t bare_fs_path_t[4096 + 1 /* NULL */];

typedef struct {
  uv_dir_t *dir;
} bare_fs_dir_t;

typedef struct {
  uv_fs_event_t handle;

  js_env_t *env;
  js_ref_t *ctx;
  js_ref_t *on_event;
  js_ref_t *on_close;

  js_deferred_teardown_t *teardown;
  bool closing;
  bool exiting;
} bare_fs_watcher_t;

typedef uv_dirent_t bare_fs_dirent_t;

static inline void
bare_fs__on_finalize(bare_fs_t *req) {
  int err;

  js_env_t *env = req->env;

  js_deferred_teardown_t *teardown = req->teardown;

  uv_fs_req_cleanup(&req->handle);

  if (req->data) {
    err = js_delete_reference(env, req->data);
    assert(err == 0);

    req->data = NULL;
  }

  err = js_delete_reference(env, req->on_response);
  assert(err == 0);

  err = js_delete_reference(env, req->ctx);
  assert(err == 0);

  err = js_finish_deferred_teardown_callback(teardown);
  assert(err == 0);
}

static void
bare_fs__on_teardown(js_deferred_teardown_t *handle, void *data) {
  int err;

  bare_fs_t *req = (bare_fs_t *) data;

  req->exiting = true;

  err = uv_cancel((uv_req_t *) &req->handle);

  if (err == 0 || req->active == false) bare_fs__on_finalize(req);
}

static inline void
bare_fs__on_response(uv_fs_t *handle) {
  int err;

  bare_fs_t *req = (bare_fs_t *) handle;

  req->active = false;

  if (req->exiting) return bare_fs__on_finalize(req);

  js_env_t *env = req->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, req->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_response;
  err = js_get_reference_value(env, req->on_response, &on_response);
  assert(err == 0);

  js_value_t *args[2];

  if (handle->result < 0) {
    js_value_t *code;
    err = js_create_string_utf8(env, (utf8_t *) uv_err_name(handle->result), -1, &code);
    assert(err == 0);

    js_value_t *message;
    err = js_create_string_utf8(env, (utf8_t *) uv_strerror(handle->result), -1, &message);
    assert(err == 0);

    err = js_create_error(env, code, message, &args[0]);
    assert(err == 0);
  } else {
    err = js_get_null(env, &args[0]);
    assert(err == 0);
  }

  err = js_create_int32(env, handle->result, &args[1]);
  assert(err == 0);

  uv_fs_req_cleanup(handle);

  if (req->data) {
    err = js_delete_reference(env, req->data);
    assert(err == 0);

    req->data = NULL;
  }

  js_call_function(env, ctx, on_response, 2, args, NULL);

  err = js_close_handle_scope(env, scope);
  assert(err == 0);
}

static void
bare_fs__on_stat_response(uv_fs_t *handle) {
  int err;

  bare_fs_t *req = (bare_fs_t *) handle;

  if (req->exiting) return bare_fs__on_response(handle);

  js_env_t *env = req->env;

  if (handle->result == 0) {
    js_handle_scope_t *scope;
    err = js_open_handle_scope(env, &scope);
    assert(err == 0);

    js_value_t *data;
    err = js_get_reference_value(env, req->data, &data);
    assert(err == 0);

    uint32_t i = 0;

#define V(property) \
  { \
    js_value_t *value; \
    err = js_create_int64(env, handle->statbuf.st_##property, &value); \
    assert(err == 0); \
    err = js_set_element(env, data, i++, value); \
    assert(err == 0); \
  }

    V(dev)
    V(mode)
    V(nlink)
    V(uid)
    V(gid)
    V(rdev)
    V(blksize)
    V(ino)
    V(size)
    V(blocks)
#undef V

#define V(property) \
  { \
    uv_timespec_t time = handle->statbuf.st_##property; \
    js_value_t *value; \
    err = js_create_int64(env, time.tv_sec * 1e3 + time.tv_nsec / 1e6, &value); \
    assert(err == 0); \
    err = js_set_element(env, data, i++, value); \
    assert(err == 0); \
  }

    V(atim)
    V(mtim)
    V(ctim)
    V(birthtim)
#undef V

    err = js_close_handle_scope(env, scope);
    assert(err == 0);
  }

  bare_fs__on_response(handle);
}

static void
bare_fs__on_realpath_response(uv_fs_t *handle) {
  int err;

  bare_fs_t *req = (bare_fs_t *) handle;

  if (req->exiting) return bare_fs__on_response(handle);

  js_env_t *env = req->env;

  if (handle->result == 0) {
    js_handle_scope_t *scope;
    err = js_open_handle_scope(env, &scope);
    assert(err == 0);

    js_value_t *data;
    err = js_get_reference_value(env, req->data, &data);
    assert(err == 0);

    char *path;
    err = js_get_typedarray_info(env, data, NULL, (void **) &path, NULL, NULL, NULL);
    assert(err == 0);

    strncpy(path, handle->ptr, sizeof(bare_fs_path_t));

    err = js_close_handle_scope(env, scope);
    assert(err == 0);
  }

  bare_fs__on_response(handle);
}

static void
bare_fs__on_readlink_response(uv_fs_t *handle) {
  int err;

  bare_fs_t *req = (bare_fs_t *) handle;

  if (req->exiting) return bare_fs__on_response(handle);

  js_env_t *env = req->env;

  if (handle->result == 0) {
    js_handle_scope_t *scope;
    err = js_open_handle_scope(env, &scope);
    assert(err == 0);

    js_value_t *data;
    err = js_get_reference_value(env, req->data, &data);
    assert(err == 0);

    char *path;
    err = js_get_typedarray_info(env, data, NULL, (void **) &path, NULL, NULL, NULL);
    assert(err == 0);

    strncpy(path, handle->ptr, sizeof(bare_fs_path_t));

    err = js_close_handle_scope(env, scope);
    assert(err == 0);
  }

  bare_fs__on_response(handle);
}

static void
bare_fs__on_opendir_response(uv_fs_t *handle) {
  int err;

  bare_fs_t *req = (bare_fs_t *) handle;

  if (req->exiting) return bare_fs__on_response(handle);

  js_env_t *env = req->env;

  if (handle->result == 0) {
    js_handle_scope_t *scope;
    err = js_open_handle_scope(env, &scope);
    assert(err == 0);

    js_value_t *data;
    err = js_get_reference_value(env, req->data, &data);
    assert(err == 0);

    bare_fs_dir_t *dir;
    err = js_get_typedarray_info(env, data, NULL, (void **) &dir, NULL, NULL, NULL);
    assert(err == 0);

    dir->dir = handle->ptr;

    err = js_close_handle_scope(env, scope);
    assert(err == 0);
  }

  bare_fs__on_response(handle);
}

static void
bare_fs__on_readdir_response(uv_fs_t *handle) {
  int err;

  bare_fs_t *req = (bare_fs_t *) handle;

  if (req->exiting) return bare_fs__on_response(handle);

  js_env_t *env = req->env;

  if (handle->result > 0) {
    js_handle_scope_t *scope;
    err = js_open_handle_scope(env, &scope);
    assert(err == 0);

    js_value_t *data;
    err = js_get_reference_value(env, req->data, &data);
    assert(err == 0);

    uv_dir_t *dir = handle->ptr;

    for (size_t i = 0, n = handle->result; i < n; i++) {
      uv_dirent_t *dirent = &dir->dirents[i];

      js_value_t *entry;
      err = js_create_object(env, &entry);
      assert(err == 0);

      err = js_set_element(env, data, i, entry);
      assert(err == 0);

      size_t name_len = strlen(dirent->name);

      js_value_t *name;
      void *data;
      err = js_create_arraybuffer(env, name_len, &data, &name);
      assert(err == 0);

      memcpy(data, dirent->name, name_len);

      err = js_set_named_property(env, entry, "name", name);
      assert(err == 0);

      js_value_t *type;
      err = js_create_uint32(env, dirent->type, &type);
      assert(err == 0);

      err = js_set_named_property(env, entry, "type", type);
      assert(err == 0);
    }

    err = js_close_handle_scope(env, scope);
    assert(err == 0);
  }

  bare_fs__on_response(handle);
}

static js_value_t *
bare_fs_init(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  js_value_t *handle;

  bare_fs_t *req;
  err = js_create_arraybuffer(env, sizeof(bare_fs_t), (void **) &req, &handle);
  assert(err == 0);

  req->env = env;
  req->data = NULL;
  req->active = false;
  req->exiting = false;

  err = js_create_reference(env, argv[0], 1, &req->ctx);
  assert(err == 0);

  err = js_create_reference(env, argv[1], 1, &req->on_response);
  assert(err == 0);

  err = js_add_deferred_teardown_callback(env, bare_fs__on_teardown, (void *) req, &req->teardown);
  assert(err == 0);

  return handle;
}

static js_value_t *
bare_fs_open(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  int32_t flags;
  err = js_get_value_int32(env, argv[2], &flags);
  assert(err == 0);

  int32_t mode;
  err = js_get_value_int32(env, argv[3], &mode);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_open(loop, &req->handle, (char *) path, flags, mode, bare_fs__on_response);

  return NULL;
}

static js_value_t *
bare_fs_open_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[0], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  int32_t flags;
  err = js_get_value_int32(env, argv[1], &flags);
  assert(err == 0);

  int32_t mode;
  err = js_get_value_int32(env, argv[2], &mode);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_open(loop, &req, (char *) path, flags, mode, NULL);

  js_value_t *res = NULL;

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  } else {
    err = js_create_int32(env, req.result, &res);
    assert(err == 0);
  }

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_close(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  uint32_t fd;
  err = js_get_value_uint32(env, argv[1], &fd);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_close(loop, &req->handle, fd, bare_fs__on_response);

  return NULL;
}

static js_value_t *
bare_fs_close_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[0], &fd);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_close(loop, &req, fd, NULL);

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  }

  uv_fs_req_cleanup(&req);

  return NULL;
}

static js_value_t *
bare_fs_access(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  int32_t mode;
  err = js_get_value_int32(env, argv[2], &mode);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_access(loop, &req->handle, (char *) path, mode, bare_fs__on_response);

  return NULL;
}

static js_value_t *
bare_fs_access_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[0], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  int32_t mode;
  err = js_get_value_int32(env, argv[1], &mode);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_access(loop, &req, (char *) path, mode, NULL);

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  }

  uv_fs_req_cleanup(&req);

  return NULL;
}

static js_value_t *
bare_fs_read(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 6;
  js_value_t *argv[6];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 6);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  uint32_t fd;
  err = js_get_value_uint32(env, argv[1], &fd);
  assert(err == 0);

  uint8_t *data;
  size_t data_len;
  err = js_get_typedarray_info(env, argv[2], NULL, (void **) &data, &data_len, NULL, NULL);
  assert(err == 0);

  uint32_t offset;
  err = js_get_value_uint32(env, argv[3], &offset);
  assert(err == 0);

  uint32_t len;
  err = js_get_value_uint32(env, argv[4], &len);
  assert(err == 0);

  if (offset >= data_len) len = 0;
  else if (offset + len >= data_len) len = data_len - offset;

  int64_t pos;
  err = js_get_value_int64(env, argv[5], &pos);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_buf_t buf = uv_buf_init((void *) (data + offset), len);

  uv_fs_read(loop, &req->handle, fd, &buf, 1, pos, bare_fs__on_response);

  return NULL;
}

static js_value_t *
bare_fs_read_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 5;
  js_value_t *argv[5];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 5);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[0], &fd);
  assert(err == 0);

  uint8_t *data;
  size_t data_len;
  err = js_get_typedarray_info(env, argv[1], NULL, (void **) &data, &data_len, NULL, NULL);
  assert(err == 0);

  uint32_t offset;
  err = js_get_value_uint32(env, argv[2], &offset);
  assert(err == 0);

  uint32_t len;
  err = js_get_value_uint32(env, argv[3], &len);
  assert(err == 0);

  if (offset >= data_len) len = 0;
  else if (offset + len >= data_len) len = data_len - offset;

  int64_t pos;
  err = js_get_value_int64(env, argv[4], &pos);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_buf_t buf = uv_buf_init((void *) (data + offset), len);

  uv_fs_t req;
  uv_fs_read(loop, (uv_fs_t *) &req, fd, &buf, 1, pos, NULL);

  js_value_t *res;
  err = js_create_int32(env, req.result, &res);
  assert(err == 0);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_readv(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  uint32_t fd;
  err = js_get_value_uint32(env, argv[1], &fd);
  assert(err == 0);

  js_value_t *arr = argv[2];

  int64_t pos;
  err = js_get_value_int64(env, argv[3], &pos);
  assert(err == 0);

  err = js_create_reference(env, arr, 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uint32_t bufs_len;
  err = js_get_array_length(env, arr, &bufs_len);
  assert(err == 0);

  uv_buf_t *bufs = malloc(sizeof(uv_buf_t) * bufs_len);

  js_value_t **elements = malloc(bufs_len * sizeof(js_value_t *));

  err = js_get_array_elements(env, arr, elements, bufs_len, 0, NULL);
  assert(err == 0);

  for (uint32_t i = 0; i < bufs_len; i++) {
    js_value_t *item = elements[i];

    uv_buf_t *buf = &bufs[i];
    err = js_get_typedarray_info(env, item, NULL, (void **) &buf->base, (size_t *) &buf->len, NULL, NULL);
    assert(err == 0);
  }

  uv_fs_read(loop, &req->handle, fd, bufs, bufs_len, pos, bare_fs__on_response);

  free(elements);
  free(bufs);

  return NULL;
}

static js_value_t *
bare_fs_write(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 6;
  js_value_t *argv[6];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 6);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  uint32_t fd;
  err = js_get_value_uint32(env, argv[1], &fd);
  assert(err == 0);

  uint8_t *data;
  size_t data_len;
  err = js_get_typedarray_info(env, argv[2], NULL, (void **) &data, &data_len, NULL, NULL);
  assert(err == 0);

  uint32_t offset;
  err = js_get_value_uint32(env, argv[3], &offset);
  assert(err == 0);

  uint32_t len;
  err = js_get_value_uint32(env, argv[4], &len);
  assert(err == 0);

  if (offset >= data_len) len = 0;
  else if (offset + len >= data_len) len = data_len - offset;

  int64_t pos;
  err = js_get_value_int64(env, argv[5], &pos);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_buf_t buf = uv_buf_init((void *) (data + offset), len);

  uv_fs_write(loop, &req->handle, fd, &buf, 1, pos, bare_fs__on_response);

  return NULL;
}

static js_value_t *
bare_fs_write_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 5;
  js_value_t *argv[5];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 5);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[0], &fd);
  assert(err == 0);

  uint8_t *data;
  size_t data_len;
  err = js_get_typedarray_info(env, argv[1], NULL, (void **) &data, &data_len, NULL, NULL);
  assert(err == 0);

  uint32_t offset;
  err = js_get_value_uint32(env, argv[2], &offset);
  assert(err == 0);

  uint32_t len;
  err = js_get_value_uint32(env, argv[3], &len);
  assert(err == 0);

  if (offset >= data_len) len = 0;
  else if (offset + len >= data_len) len = data_len - offset;

  int64_t pos;
  err = js_get_value_int64(env, argv[4], &pos);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_buf_t buf = uv_buf_init((void *) (data + offset), len);

  uv_fs_t req;
  uv_fs_write(loop, &req, fd, &buf, 1, pos, NULL);

  js_value_t *res;
  err = js_create_int32(env, req.result, &res);
  assert(err == 0);

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_writev(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  uint32_t fd;
  err = js_get_value_uint32(env, argv[1], &fd);
  assert(err == 0);

  js_value_t *arr = argv[2];

  int64_t pos;
  err = js_get_value_int64(env, argv[3], &pos);
  assert(err == 0);

  err = js_create_reference(env, arr, 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uint32_t bufs_len;
  err = js_get_array_length(env, arr, &bufs_len);
  assert(err == 0);

  uv_buf_t *bufs = malloc(sizeof(uv_buf_t) * bufs_len);

  js_value_t **elements = malloc(bufs_len * sizeof(js_value_t *));

  err = js_get_array_elements(env, arr, elements, bufs_len, 0, NULL);
  assert(err == 0);

  for (uint32_t i = 0; i < bufs_len; i++) {
    js_value_t *item = elements[i];

    uv_buf_t *buf = &bufs[i];
    err = js_get_typedarray_info(env, item, NULL, (void **) &buf->base, (size_t *) &buf->len, NULL, NULL);
    assert(err == 0);
  }

  uv_fs_write(loop, &req->handle, fd, bufs, bufs_len, pos, bare_fs__on_response);

  free(elements);
  free(bufs);

  return NULL;
}

static js_value_t *
bare_fs_ftruncate(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  uint32_t fd;
  err = js_get_value_uint32(env, argv[1], &fd);
  assert(err == 0);

  int64_t len;
  err = js_get_value_int64(env, argv[2], &len);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_ftruncate(loop, &req->handle, fd, len, bare_fs__on_response);

  return NULL;
}

static js_value_t *
bare_fs_ftruncate_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[0], &fd);
  assert(err == 0);

  int64_t len;
  err = js_get_value_int64(env, argv[1], &len);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_ftruncate(loop, &req, fd, len, NULL);

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  }

  uv_fs_req_cleanup(&req);

  return NULL;
}

static js_value_t *
bare_fs_chmod(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  int32_t mode;
  err = js_get_value_int32(env, argv[2], &mode);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_chmod(loop, &req->handle, (char *) path, mode, bare_fs__on_response);

  return NULL;
}

static js_value_t *
bare_fs_chmod_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[0], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  int32_t mode;
  err = js_get_value_int32(env, argv[1], &mode);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_chmod(loop, &req, (char *) path, mode, NULL);

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  }

  uv_fs_req_cleanup(&req);

  return NULL;
}

static js_value_t *
bare_fs_fchmod(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  uint32_t fd;
  err = js_get_value_uint32(env, argv[1], &fd);
  assert(err == 0);

  int32_t mode;
  err = js_get_value_int32(env, argv[2], &mode);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_fchmod(loop, &req->handle, fd, mode, bare_fs__on_response);

  return NULL;
}

static js_value_t *
bare_fs_fchmod_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[0], &fd);
  assert(err == 0);

  int32_t mode;
  err = js_get_value_int32(env, argv[1], &mode);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_fchmod(loop, &req, fd, mode, NULL);

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  }

  uv_fs_req_cleanup(&req);

  return NULL;
}

static js_value_t *
bare_fs_rename(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  bare_fs_path_t src;
  err = js_get_value_string_utf8(env, argv[1], src, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  bare_fs_path_t dest;
  err = js_get_value_string_utf8(env, argv[2], dest, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_rename(loop, &req->handle, (char *) src, (char *) dest, bare_fs__on_response);

  return NULL;
}

static js_value_t *
bare_fs_rename_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_path_t src;
  err = js_get_value_string_utf8(env, argv[0], src, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  bare_fs_path_t dest;
  err = js_get_value_string_utf8(env, argv[1], dest, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_rename(loop, &req, (char *) src, (char *) dest, NULL);

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  }

  uv_fs_req_cleanup(&req);

  return NULL;
}

static js_value_t *
bare_fs_copyfile(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  bare_fs_path_t src;
  err = js_get_value_string_utf8(env, argv[1], src, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  bare_fs_path_t dest;
  err = js_get_value_string_utf8(env, argv[2], dest, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  int32_t mode;
  err = js_get_value_int32(env, argv[3], &mode);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_copyfile(loop, &req->handle, (char *) src, (char *) dest, mode, bare_fs__on_response);

  return NULL;
}

static js_value_t *
bare_fs_copyfile_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_path_t src;
  err = js_get_value_string_utf8(env, argv[0], src, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  bare_fs_path_t dest;
  err = js_get_value_string_utf8(env, argv[1], dest, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  int32_t mode;
  err = js_get_value_int32(env, argv[2], &mode);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_copyfile(loop, &req, (char *) src, (char *) dest, mode, NULL);

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  }

  uv_fs_req_cleanup(&req);

  return NULL;
}

static js_value_t *
bare_fs_mkdir(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  int32_t mode;
  err = js_get_value_int32(env, argv[2], &mode);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_mkdir(loop, &req->handle, (char *) path, mode, bare_fs__on_response);

  return NULL;
}

static js_value_t *
bare_fs_mkdir_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[0], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  int32_t mode;
  err = js_get_value_int32(env, argv[1], &mode);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_mkdir(loop, &req, (char *) path, mode, NULL);

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  }

  uv_fs_req_cleanup(&req);

  return NULL;
}

static js_value_t *
bare_fs_rmdir(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_rmdir(loop, &req->handle, (char *) path, bare_fs__on_response);

  return NULL;
}

static js_value_t *
bare_fs_rmdir_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[0], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_rmdir(loop, &req, (char *) path, NULL);

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  }

  uv_fs_req_cleanup(&req);

  return NULL;
}

static js_value_t *
bare_fs_stat(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_stat(loop, &req->handle, (char *) path, bare_fs__on_stat_response);

  return NULL;
}

static js_value_t *
bare_fs_stat_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[0], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_stat(loop, &req, (char *) path, NULL);

  js_value_t *res = NULL;

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  } else {
    err = js_create_array_with_length(env, 14, &res);
    assert(err == 0);

    uint32_t i = 0;

#define V(property) \
  { \
    js_value_t *value; \
    err = js_create_int64(env, req.statbuf.st_##property, &value); \
    assert(err == 0); \
\
    err = js_set_element(env, res, i++, value); \
    assert(err == 0); \
  }
    V(dev)
    V(mode)
    V(nlink)
    V(uid)
    V(gid)
    V(rdev)
    V(blksize)
    V(ino)
    V(size)
    V(blocks)
#undef V

#define V(property) \
  { \
    uv_timespec_t time = req.statbuf.st_##property; \
\
    js_value_t *value; \
    err = js_create_int64(env, time.tv_sec * 1e3 + time.tv_nsec / 1e6, &value); \
    assert(err == 0); \
\
    err = js_set_element(env, res, i++, value); \
    assert(err == 0); \
  }
    V(atim)
    V(mtim)
    V(ctim)
    V(birthtim)
#undef V
  }

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_lstat(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_lstat(loop, &req->handle, (char *) path, bare_fs__on_stat_response);

  return NULL;
}

static js_value_t *
bare_fs_lstat_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[0], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_lstat(loop, &req, (char *) path, NULL);

  js_value_t *res = NULL;

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  } else {
    err = js_create_array_with_length(env, 14, &res);
    assert(err == 0);

    uint32_t i = 0;

#define V(property) \
  { \
    js_value_t *value; \
    err = js_create_int64(env, req.statbuf.st_##property, &value); \
    assert(err == 0); \
\
    err = js_set_element(env, res, i++, value); \
    assert(err == 0); \
  }
    V(dev)
    V(mode)
    V(nlink)
    V(uid)
    V(gid)
    V(rdev)
    V(blksize)
    V(ino)
    V(size)
    V(blocks)
#undef V

#define V(property) \
  { \
    uv_timespec_t time = req.statbuf.st_##property; \
\
    js_value_t *value; \
    err = js_create_int64(env, time.tv_sec * 1e3 + time.tv_nsec / 1e6, &value); \
    assert(err == 0); \
\
    err = js_set_element(env, res, i++, value); \
    assert(err == 0); \
  }
    V(atim)
    V(mtim)
    V(ctim)
    V(birthtim)
#undef V
  }

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_fstat(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  uint32_t fd;
  err = js_get_value_uint32(env, argv[1], &fd);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_fstat(loop, &req->handle, fd, bare_fs__on_stat_response);

  return NULL;
}

static js_value_t *
bare_fs_fstat_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  uint32_t fd;
  err = js_get_value_uint32(env, argv[0], &fd);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_fstat(loop, &req, fd, NULL);

  js_value_t *res = NULL;

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  } else {
    err = js_create_array_with_length(env, 14, &res);
    assert(err == 0);

    uint32_t i = 0;

#define V(property) \
  { \
    js_value_t *value; \
    err = js_create_int64(env, req.statbuf.st_##property, &value); \
    assert(err == 0); \
\
    err = js_set_element(env, res, i++, value); \
    assert(err == 0); \
  }
    V(dev)
    V(mode)
    V(nlink)
    V(uid)
    V(gid)
    V(rdev)
    V(blksize)
    V(ino)
    V(size)
    V(blocks)
#undef V

#define V(property) \
  { \
    uv_timespec_t time = req.statbuf.st_##property; \
\
    js_value_t *value; \
    err = js_create_int64(env, time.tv_sec * 1e3 + time.tv_nsec / 1e6, &value); \
    assert(err == 0); \
\
    err = js_set_element(env, res, i++, value); \
    assert(err == 0); \
  }
    V(atim)
    V(mtim)
    V(ctim)
    V(birthtim)
#undef V
  }

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_unlink(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_unlink(loop, &req->handle, (char *) path, bare_fs__on_response);

  return NULL;
}

static js_value_t *
bare_fs_unlink_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[0], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_unlink(loop, &req, (char *) path, NULL);

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  }

  uv_fs_req_cleanup(&req);

  return NULL;
}

static js_value_t *
bare_fs_realpath(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_realpath(loop, &req->handle, (char *) path, bare_fs__on_realpath_response);

  return NULL;
}

static js_value_t *
bare_fs_realpath_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[0], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_realpath(loop, &req, (char *) path, NULL);

  js_value_t *res = NULL;

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  } else {
    char *path;
    err = js_get_typedarray_info(env, argv[1], NULL, (void **) &path, NULL, NULL, NULL);
    assert(err == 0);

    strncpy(path, req.ptr, sizeof(bare_fs_path_t));
  }

  uv_fs_req_cleanup(&req);

  return res;
}

static js_value_t *
bare_fs_readlink(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_readlink(loop, &req->handle, (char *) path, bare_fs__on_readlink_response);

  return NULL;
}

static js_value_t *
bare_fs_readlink_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[0], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_readlink(loop, &req, (char *) path, NULL);

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  } else {
    char *path;
    err = js_get_typedarray_info(env, argv[1], NULL, (void **) &path, NULL, NULL, NULL);
    assert(err == 0);

    strncpy(path, req.ptr, sizeof(bare_fs_path_t));
  }

  uv_fs_req_cleanup(&req);

  return NULL;
}

static js_value_t *
bare_fs_symlink(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  bare_fs_path_t target;
  err = js_get_value_string_utf8(env, argv[1], target, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[2], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  int32_t flags;
  err = js_get_value_int32(env, argv[3], &flags);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_symlink(loop, &req->handle, (char *) target, (char *) path, flags, bare_fs__on_response);

  return NULL;
}

static js_value_t *
bare_fs_symlink_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_path_t target;
  err = js_get_value_string_utf8(env, argv[0], target, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  int32_t flags;
  err = js_get_value_int32(env, argv[2], &flags);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_symlink(loop, &req, (char *) target, (char *) path, flags, NULL);

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  }

  uv_fs_req_cleanup(&req);

  return NULL;
}

static js_value_t *
bare_fs_opendir(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[1], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  err = js_create_reference(env, argv[2], 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_opendir(loop, &req->handle, (char *) path, bare_fs__on_opendir_response);

  return NULL;
}

static js_value_t *
bare_fs_opendir_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[0], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  js_value_t *data = argv[1];

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_opendir(loop, &req, (char *) path, NULL);

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  } else {
    bare_fs_dir_t *dir;
    err = js_get_typedarray_info(env, argv[1], NULL, (void **) &dir, NULL, NULL, NULL);
    assert(err == 0);

    dir->dir = req.ptr;
  }

  uv_fs_req_cleanup(&req);

  return NULL;
}

static js_value_t *
bare_fs_readdir(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 4;
  js_value_t *argv[4];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 4);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  bare_fs_dir_t *dir;
  err = js_get_typedarray_info(env, argv[1], NULL, (void **) &dir, NULL, NULL, NULL);
  assert(err == 0);

  bare_fs_dirent_t *dirents;
  size_t dirents_len;
  err = js_get_typedarray_info(env, argv[2], NULL, (void **) &dirents, &dirents_len, NULL, NULL);
  assert(err == 0);

  err = js_create_reference(env, argv[3], 1, &req->data);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  dir->dir->dirents = dirents;
  dir->dir->nentries = dirents_len / sizeof(bare_fs_dirent_t);

  uv_fs_readdir(loop, &req->handle, dir->dir, bare_fs__on_readdir_response);

  return NULL;
}

static js_value_t *
bare_fs_readdir_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 3;
  js_value_t *argv[3];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 3);

  bare_fs_dir_t *dir;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &dir, NULL, NULL, NULL);
  assert(err == 0);

  bare_fs_dirent_t *dirents;
  size_t dirents_len;
  err = js_get_typedarray_info(env, argv[1], NULL, (void **) &dirents, &dirents_len, NULL, NULL);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  dir->dir->dirents = dirents;
  dir->dir->nentries = dirents_len / sizeof(bare_fs_dirent_t);

  uv_fs_t req;
  uv_fs_readdir(loop, &req, dir->dir, NULL);

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  } else {
    uv_dir_t *dir = req.ptr;

    for (size_t i = 0, n = req.result; i < n; i++) {
      uv_dirent_t *dirent = &dir->dirents[i];

      js_value_t *entry;
      err = js_create_object(env, &entry);
      assert(err == 0);

      err = js_set_element(env, argv[2], i, entry);
      assert(err == 0);

      size_t name_len = strlen(dirent->name);

      js_value_t *name;
      void *data;
      err = js_create_arraybuffer(env, name_len, &data, &name);
      assert(err == 0);

      memcpy(data, dirent->name, name_len);

      err = js_set_named_property(env, entry, "name", name);
      assert(err == 0);

      js_value_t *type;
      err = js_create_uint32(env, dirent->type, &type);
      assert(err == 0);

      err = js_set_named_property(env, entry, "type", type);
      assert(err == 0);
    }
  }

  uv_fs_req_cleanup(&req);

  return NULL;
}

static js_value_t *
bare_fs_closedir(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 2;
  js_value_t *argv[2];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 2);

  bare_fs_t *req;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &req, NULL);
  assert(err == 0);

  req->active = true;

  bare_fs_dir_t *dir;
  err = js_get_typedarray_info(env, argv[1], NULL, (void **) &dir, NULL, NULL, NULL);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_closedir(loop, &req->handle, dir->dir, bare_fs__on_response);

  return NULL;
}

static js_value_t *
bare_fs_closedir_sync(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_fs_dir_t *dir;
  err = js_get_typedarray_info(env, argv[0], NULL, (void **) &dir, NULL, NULL, NULL);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  uv_fs_t req;
  uv_fs_closedir(loop, &req, dir->dir, NULL);

  if (req.result < 0) {
    err = js_throw_error(env, uv_err_name(req.result), uv_strerror(req.result));
    assert(err == 0);
  }

  uv_fs_req_cleanup(&req);

  return NULL;
}

static void
bare_fs__on_watcher_event(uv_fs_event_t *handle, const char *filename, int events, int status) {
  int err;

  bare_fs_watcher_t *watcher = (bare_fs_watcher_t *) handle;

  if (watcher->exiting) return;

  js_env_t *env = watcher->env;

  js_handle_scope_t *scope;
  err = js_open_handle_scope(env, &scope);
  assert(err == 0);

  js_value_t *ctx;
  err = js_get_reference_value(env, watcher->ctx, &ctx);
  assert(err == 0);

  js_value_t *on_event;
  err = js_get_reference_value(env, watcher->on_event, &on_event);
  assert(err == 0);

  js_value_t *args[3];

  if (status < 0) {
    js_value_t *code;
    err = js_create_string_utf8(env, (utf8_t *) uv_err_name(status), -1, &code);
    assert(err == 0);

    js_value_t *message;
    err = js_create_string_utf8(env, (utf8_t *) uv_strerror(status), -1, &message);
    assert(err == 0);

    err = js_create_error(env, code, message, &args[0]);
    assert(err == 0);

    err = js_create_int32(env, 0, &args[1]);
    assert(err == 0);

    err = js_get_null(env, &args[2]);
    assert(err == 0);
  } else {
    err = js_get_null(env, &args[0]);
    assert(err == 0);

    err = js_create_int32(env, events, &args[1]);
    assert(err == 0);

    size_t len = strlen(filename);

    void *data;
    err = js_create_arraybuffer(env, len, &data, &args[2]);
    assert(err == 0);

    memcpy(data, (void *) filename, len);
  }

  js_call_function(env, ctx, on_event, 3, args, NULL);

  err = js_close_handle_scope(env, scope);
  assert(err == 0);
}

static void
bare_fs__on_watcher_close(uv_handle_t *handle) {
  int err;

  bare_fs_watcher_t *watcher = (bare_fs_watcher_t *) handle;

  js_env_t *env = watcher->env;

  js_deferred_teardown_t *teardown = watcher->teardown;

  if (watcher->exiting) {
    err = js_delete_reference(env, watcher->on_event);
    assert(err == 0);

    err = js_delete_reference(env, watcher->on_close);
    assert(err == 0);

    err = js_delete_reference(env, watcher->ctx);
    assert(err == 0);
  } else {
    js_handle_scope_t *scope;
    err = js_open_handle_scope(env, &scope);
    assert(err == 0);

    js_value_t *ctx;
    err = js_get_reference_value(env, watcher->ctx, &ctx);
    assert(err == 0);

    js_value_t *on_close;
    err = js_get_reference_value(env, watcher->on_close, &on_close);
    assert(err == 0);

    err = js_delete_reference(env, watcher->on_event);
    assert(err == 0);

    err = js_delete_reference(env, watcher->on_close);
    assert(err == 0);

    err = js_delete_reference(env, watcher->ctx);
    assert(err == 0);

    js_call_function(env, ctx, on_close, 0, NULL, NULL);

    err = js_close_handle_scope(env, scope);
    assert(err == 0);
  }

  err = js_finish_deferred_teardown_callback(teardown);
  assert(err == 0);
}

static void
bare_fs__on_watcher_teardown(js_deferred_teardown_t *handle, void *data) {
  bare_fs_watcher_t *watcher = (bare_fs_watcher_t *) data;

  watcher->exiting = true;

  if (watcher->closing) return;

  uv_close((uv_handle_t *) &watcher->handle, bare_fs__on_watcher_close);
}

static js_value_t *
bare_fs_watcher_init(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 5;
  js_value_t *argv[5];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 5);

  bare_fs_path_t path;
  err = js_get_value_string_utf8(env, argv[0], path, sizeof(bare_fs_path_t), NULL);
  assert(err == 0);

  bool recursive;
  err = js_get_value_bool(env, argv[1], &recursive);
  assert(err == 0);

  js_value_t *result;

  bare_fs_watcher_t *watcher;
  err = js_create_arraybuffer(env, sizeof(bare_fs_watcher_t), (void **) &watcher, &result);
  assert(err == 0);

  uv_loop_t *loop;
  err = js_get_env_loop(env, &loop);
  assert(err == 0);

  err = uv_fs_event_init(loop, &watcher->handle);

  if (err < 0) {
    err = js_throw_error(env, uv_err_name(err), uv_strerror(err));
    assert(err == 0);

    return NULL;
  }

  err = uv_fs_event_start(&watcher->handle, bare_fs__on_watcher_event, (char *) path, recursive ? UV_FS_EVENT_RECURSIVE : 0);

  if (err < 0) {
    err = js_throw_error(env, uv_err_name(err), uv_strerror(err));
    assert(err == 0);

    return NULL;
  }

  watcher->env = env;
  watcher->closing = false;
  watcher->exiting = false;

  err = js_create_reference(env, argv[2], 1, &watcher->ctx);
  assert(err == 0);

  err = js_create_reference(env, argv[3], 1, &watcher->on_event);
  assert(err == 0);

  err = js_create_reference(env, argv[4], 1, &watcher->on_close);
  assert(err == 0);

  err = js_add_deferred_teardown_callback(env, bare_fs__on_watcher_teardown, (void *) watcher, &watcher->teardown);
  assert(err == 0);

  return result;
}

static js_value_t *
bare_fs_watcher_close(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_fs_watcher_t *watcher;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &watcher, NULL);
  assert(err == 0);

  err = uv_fs_event_stop(&watcher->handle);
  assert(err == 0);

  watcher->closing = true;

  uv_close((uv_handle_t *) &watcher->handle, bare_fs__on_watcher_close);

  return NULL;
}

static js_value_t *
bare_fs_watcher_ref(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_fs_watcher_t *watcher;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &watcher, NULL);
  assert(err == 0);

  uv_ref((uv_handle_t *) &watcher->handle);

  return NULL;
}

static js_value_t *
bare_fs_watcher_unref(js_env_t *env, js_callback_info_t *info) {
  int err;

  size_t argc = 1;
  js_value_t *argv[1];

  err = js_get_callback_info(env, info, &argc, argv, NULL, NULL);
  assert(err == 0);

  assert(argc == 1);

  bare_fs_watcher_t *watcher;
  err = js_get_arraybuffer_info(env, argv[0], (void **) &watcher, NULL);
  assert(err == 0);

  uv_unref((uv_handle_t *) &watcher->handle);

  return NULL;
}

static js_value_t *
bare_fs_exports(js_env_t *env, js_value_t *exports) {
  int err;

#define V(name, struct) \
  { \
    js_value_t *val; \
    err = js_create_uint32(env, sizeof(struct), &val); \
    assert(err == 0); \
    js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("sizeofFSDir", bare_fs_dir_t)
  V("sizeofFSDirent", bare_fs_dirent_t)
  V("sizeofFSPath", bare_fs_path_t)
#undef V

#define V(name, fn) \
  { \
    js_value_t *val; \
    err = js_create_function(env, name, -1, fn, NULL, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, name, val); \
    assert(err == 0); \
  }

  V("init", bare_fs_init)
  V("open", bare_fs_open)
  V("openSync", bare_fs_open_sync)
  V("close", bare_fs_close)
  V("closeSync", bare_fs_close_sync)
  V("access", bare_fs_access)
  V("accessSync", bare_fs_access_sync)
  V("read", bare_fs_read)
  V("readSync", bare_fs_read_sync)
  V("readv", bare_fs_readv)
  V("write", bare_fs_write)
  V("writeSync", bare_fs_write_sync)
  V("writev", bare_fs_writev)
  V("ftruncate", bare_fs_ftruncate)
  V("ftruncateSync", bare_fs_ftruncate_sync)
  V("chmod", bare_fs_chmod)
  V("chmodSync", bare_fs_chmod_sync)
  V("fchmod", bare_fs_fchmod)
  V("fchmodSync", bare_fs_fchmod_sync)
  V("rename", bare_fs_rename)
  V("renameSync", bare_fs_rename_sync)
  V("copyfile", bare_fs_copyfile)
  V("copyfileSync", bare_fs_copyfile_sync)
  V("mkdir", bare_fs_mkdir)
  V("mkdirSync", bare_fs_mkdir_sync)
  V("rmdir", bare_fs_rmdir)
  V("rmdirSync", bare_fs_rmdir_sync)
  V("stat", bare_fs_stat)
  V("statSync", bare_fs_stat_sync)
  V("lstat", bare_fs_lstat)
  V("lstatSync", bare_fs_lstat_sync)
  V("fstat", bare_fs_fstat)
  V("fstatSync", bare_fs_fstat_sync)
  V("unlink", bare_fs_unlink)
  V("unlinkSync", bare_fs_unlink_sync)
  V("realpath", bare_fs_realpath)
  V("realpathSync", bare_fs_realpath_sync)
  V("readlink", bare_fs_readlink)
  V("readlinkSync", bare_fs_readlink_sync)
  V("symlink", bare_fs_symlink)
  V("symlinkSync", bare_fs_symlink_sync)
  V("opendir", bare_fs_opendir)
  V("opendirSync", bare_fs_opendir_sync)
  V("readdir", bare_fs_readdir)
  V("readdirSync", bare_fs_readdir_sync)
  V("closedir", bare_fs_closedir)
  V("closedirSync", bare_fs_closedir_sync)
  V("watcherInit", bare_fs_watcher_init)
  V("watcherClose", bare_fs_watcher_close)
  V("watcherRef", bare_fs_watcher_ref)
  V("watcherUnref", bare_fs_watcher_unref)
#undef V

#define V(name) \
  { \
    js_value_t *val; \
    err = js_create_uint32(env, name, &val); \
    assert(err == 0); \
    err = js_set_named_property(env, exports, #name, val); \
    assert(err == 0); \
  }

  V(O_RDWR)
  V(O_RDONLY)
  V(O_WRONLY)
  V(O_CREAT)
  V(O_TRUNC)
  V(O_APPEND)

#ifdef F_OK
  V(F_OK)
#endif
#ifdef R_OK
  V(R_OK)
#endif
#ifdef W_OK
  V(W_OK)
#endif
#ifdef X_OK
  V(X_OK)
#endif

  V(S_IFMT)
  V(S_IFREG)
  V(S_IFDIR)
  V(S_IFCHR)
  V(S_IFLNK)
#ifdef S_IFBLK
  V(S_IFBLK)
#endif
#ifdef S_IFIFO
  V(S_IFIFO)
#endif
#ifdef S_IFSOCK
  V(S_IFSOCK)
#endif

#ifdef S_IRUSR
  V(S_IRUSR)
#endif
#ifdef S_IWUSR
  V(S_IWUSR)
#endif
#ifdef S_IXUSR
  V(S_IXUSR)
#endif
#ifdef S_IRGRP
  V(S_IRGRP)
#endif
#ifdef S_IWGRP
  V(S_IWGRP)
#endif
#ifdef S_IXGRP
  V(S_IXGRP)
#endif
#ifdef S_IROTH
  V(S_IROTH)
#endif
#ifdef S_IWOTH
  V(S_IWOTH)
#endif
#ifdef S_IXOTH
  V(S_IXOTH)
#endif

  V(UV_DIRENT_UNKNOWN)
  V(UV_DIRENT_FILE)
  V(UV_DIRENT_DIR)
  V(UV_DIRENT_LINK)
  V(UV_DIRENT_FIFO)
  V(UV_DIRENT_SOCKET)
  V(UV_DIRENT_CHAR)
  V(UV_DIRENT_BLOCK)

  V(UV_FS_COPYFILE_EXCL)
  V(UV_FS_COPYFILE_FICLONE)
  V(UV_FS_COPYFILE_FICLONE_FORCE)
  V(UV_FS_SYMLINK_DIR)
  V(UV_FS_SYMLINK_JUNCTION)

  V(UV_RENAME)
  V(UV_CHANGE)
#undef V

  return exports;
}

BARE_MODULE(bare_fs, bare_fs_exports)
