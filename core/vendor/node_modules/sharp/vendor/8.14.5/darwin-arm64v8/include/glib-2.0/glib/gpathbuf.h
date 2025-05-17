/* gpathbuf.h: A mutable path builder
 *
 * SPDX-FileCopyrightText: 2023  Emmanuele Bassi
 * SPDX-License-Identifier: LGPL-2.1-or-later
 */

#pragma once

#if !defined (__GLIB_H_INSIDE__) && !defined (GLIB_COMPILATION)
#error "Only <glib.h> can be included directly."
#endif

#include <glib/gtypes.h>

G_BEGIN_DECLS

typedef struct _GPathBuf  GPathBuf;

/**
 * GPathBuf: (copy-func g_path_buf_copy) (free-func g_path_buf_free)
 *
 * A mutable path builder.
 *
 * Since: 2.76
 */
struct _GPathBuf
{
  /*< private >*/
  gpointer dummy[8];
};

/**
 * G_PATH_BUF_INIT:
 *
 * Initializes a #GPathBuf on the stack.
 *
 * A stack-allocated `GPathBuf` must be initialized if it is used
 * together with g_auto() to avoid warnings and crashes if the
 * function returns before calling g_path_buf_init().
 *
 * |[<!-- language="C" -->
 *   g_auto (GPathBuf) buf = G_PATH_BUF_INIT;
 * ]|
 *
 * Since: 2.76
 */
#define G_PATH_BUF_INIT { { NULL, } } \
  GLIB_AVAILABLE_MACRO_IN_2_76

GLIB_AVAILABLE_IN_2_76
GPathBuf *    g_path_buf_new            (void);
GLIB_AVAILABLE_IN_2_76
GPathBuf *    g_path_buf_new_from_path  (const char *path);
GLIB_AVAILABLE_IN_2_76
GPathBuf *    g_path_buf_init           (GPathBuf   *buf);
GLIB_AVAILABLE_IN_2_76
GPathBuf *    g_path_buf_init_from_path (GPathBuf   *buf,
                                         const char *path);
GLIB_AVAILABLE_IN_2_76
void          g_path_buf_clear          (GPathBuf   *buf);
GLIB_AVAILABLE_IN_2_76
char *        g_path_buf_clear_to_path  (GPathBuf   *buf) G_GNUC_WARN_UNUSED_RESULT;
GLIB_AVAILABLE_IN_2_76
void          g_path_buf_free           (GPathBuf   *buf);
GLIB_AVAILABLE_IN_2_76
char *        g_path_buf_free_to_path   (GPathBuf   *buf) G_GNUC_WARN_UNUSED_RESULT;
GLIB_AVAILABLE_IN_2_76
GPathBuf *    g_path_buf_copy           (GPathBuf   *buf);

GLIB_AVAILABLE_IN_2_76
GPathBuf *    g_path_buf_push           (GPathBuf   *buf,
                                         const char *path);
GLIB_AVAILABLE_IN_2_76
gboolean      g_path_buf_pop            (GPathBuf   *buf);

GLIB_AVAILABLE_IN_2_76
gboolean      g_path_buf_set_filename   (GPathBuf   *buf,
                                         const char *file_name);
GLIB_AVAILABLE_IN_2_76
gboolean      g_path_buf_set_extension  (GPathBuf   *buf,
                                         const char *extension);

GLIB_AVAILABLE_IN_2_76
char *        g_path_buf_to_path        (GPathBuf   *buf) G_GNUC_WARN_UNUSED_RESULT;

GLIB_AVAILABLE_IN_2_76
gboolean      g_path_buf_equal          (gconstpointer v1,
                                         gconstpointer v2);

G_END_DECLS
