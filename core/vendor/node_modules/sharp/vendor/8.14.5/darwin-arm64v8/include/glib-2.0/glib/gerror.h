/* gerror.h - Error reporting system
 *
 *  Copyright 2000 Red Hat, Inc.
 *
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this library; if not, see <http://www.gnu.org/licenses/>.
 */

#ifndef __G_ERROR_H__
#define __G_ERROR_H__

#if !defined (__GLIB_H_INSIDE__) && !defined (GLIB_COMPILATION)
#error "Only <glib.h> can be included directly."
#endif

#include <stdarg.h>

#include <glib/gquark.h>

G_BEGIN_DECLS

/**
 * GError:
 * @domain: error domain, e.g. %G_FILE_ERROR
 * @code: error code, e.g. %G_FILE_ERROR_NOENT
 * @message: human-readable informative error message
 *
 * The `GError` structure contains information about
 * an error that has occurred.
 */
typedef struct _GError GError;

struct _GError
{
  GQuark       domain;
  gint         code;
  gchar       *message;
};

/**
 * G_DEFINE_EXTENDED_ERROR:
 * @ErrorType: name to return a #GQuark for
 * @error_type: prefix for the function name
 *
 * A convenience macro which defines two functions. First, returning
 * the #GQuark for the extended error type @ErrorType; it is called
 * `error_type_quark()`. Second, returning the private data from a
 * passed #GError; it is called `error_type_get_private()`.
 *
 * For this macro to work, a type named `ErrorTypePrivate` should be
 * defined, `error_type_private_init()`, `error_type_private_copy()`
 * and `error_type_private_clear()` functions need to be either
 * declared or defined. The functions should be similar to
 * #GErrorInitFunc, #GErrorCopyFunc and #GErrorClearFunc,
 * respectively, but they should receive the private data type instead
 * of #GError.
 *
 * See [Extended #GError Domains][gerror-extended-domains] for an example.
 *
 * Since: 2.68
 */
#define G_DEFINE_EXTENDED_ERROR(ErrorType, error_type)                  \
static inline ErrorType ## Private *                                    \
error_type ## _get_private (const GError *error)                        \
{                                                                       \
  /* Copied from gtype.c (STRUCT_ALIGNMENT and ALIGN_STRUCT macros). */ \
  const gsize sa = 2 * sizeof (gsize);                                  \
  const gsize as = (sizeof (ErrorType ## Private) + (sa - 1)) & -sa;    \
  g_return_val_if_fail (error != NULL, NULL);                           \
  g_return_val_if_fail (error->domain == error_type ## _quark (), NULL); \
  return (ErrorType ## Private *) (((guint8 *)error) - as); \
}                                                                       \
                                                                        \
static void                                                             \
g_error_with_ ## error_type ## _private_init (GError *error)            \
{                                                                       \
  ErrorType ## Private *priv = error_type ## _get_private (error);      \
  error_type ## _private_init (priv);                                   \
}                                                                       \
                                                                        \
static void                                                             \
g_error_with_ ## error_type ## _private_copy (const GError *src_error,  \
                                              GError       *dest_error) \
{                                                                       \
  const ErrorType ## Private *src_priv = error_type ## _get_private (src_error);  \
  ErrorType ## Private *dest_priv = error_type ## _get_private (dest_error); \
  error_type ## _private_copy (src_priv, dest_priv);                    \
}                                                                       \
                                                                        \
static void                                                             \
g_error_with_ ## error_type ## _private_clear (GError *error)           \
{                                                                       \
  ErrorType ## Private *priv = error_type ## _get_private (error);      \
  error_type ## _private_clear (priv);                                  \
}                                                                       \
                                                                        \
GQuark                                                                  \
error_type ## _quark (void)                                             \
{                                                                       \
  static GQuark q;                                                      \
  static gsize initialized = 0;                                         \
                                                                        \
  if (g_once_init_enter (&initialized))                                 \
    {                                                                   \
      q = g_error_domain_register_static (#ErrorType,                   \
                                          sizeof (ErrorType ## Private), \
                                          g_error_with_ ## error_type ## _private_init, \
                                          g_error_with_ ## error_type ## _private_copy, \
                                          g_error_with_ ## error_type ## _private_clear); \
      g_once_init_leave (&initialized, 1);                              \
    }                                                                   \
                                                                        \
  return q;                                                             \
}

/**
 * GErrorInitFunc:
 * @error: extended error
 *
 * Specifies the type of function which is called just after an
 * extended error instance is created and its fields filled. It should
 * only initialize the fields in the private data, which can be
 * received with the generated `*_get_private()` function.
 *
 * Normally, it is better to use G_DEFINE_EXTENDED_ERROR(), as it
 * already takes care of getting the private data from @error.
 *
 * Since: 2.68
 */
typedef void (*GErrorInitFunc) (GError *error);

/**
 * GErrorCopyFunc:
 * @src_error: source extended error
 * @dest_error: destination extended error
 *
 * Specifies the type of function which is called when an extended
 * error instance is copied. It is passed the pointer to the
 * destination error and source error, and should copy only the fields
 * of the private data from @src_error to @dest_error.
 *
 * Normally, it is better to use G_DEFINE_EXTENDED_ERROR(), as it
 * already takes care of getting the private data from @src_error and
 * @dest_error.
 *
 * Since: 2.68
 */
typedef void (*GErrorCopyFunc) (const GError *src_error, GError *dest_error);

/**
 * GErrorClearFunc:
 * @error: extended error to clear
 *
 * Specifies the type of function which is called when an extended
 * error instance is freed. It is passed the error pointer about to be
 * freed, and should free the error's private data fields.
 *
 * Normally, it is better to use G_DEFINE_EXTENDED_ERROR(), as it
 * already takes care of getting the private data from @error.
 *
 * Since: 2.68
 */
typedef void (*GErrorClearFunc) (GError *error);

GLIB_AVAILABLE_IN_2_68
GQuark   g_error_domain_register_static (const char        *error_type_name,
                                         gsize              error_type_private_size,
                                         GErrorInitFunc     error_type_init,
                                         GErrorCopyFunc     error_type_copy,
                                         GErrorClearFunc    error_type_clear);

GLIB_AVAILABLE_IN_2_68
GQuark   g_error_domain_register (const char        *error_type_name,
                                  gsize              error_type_private_size,
                                  GErrorInitFunc     error_type_init,
                                  GErrorCopyFunc     error_type_copy,
                                  GErrorClearFunc    error_type_clear);

GLIB_AVAILABLE_IN_ALL
GError*  g_error_new           (GQuark         domain,
                                gint           code,
                                const gchar   *format,
                                ...) G_GNUC_PRINTF (3, 4);

GLIB_AVAILABLE_IN_ALL
GError*  g_error_new_literal   (GQuark         domain,
                                gint           code,
                                const gchar   *message);
GLIB_AVAILABLE_IN_ALL
GError*  g_error_new_valist    (GQuark         domain,
                                gint           code,
                                const gchar   *format,
                                va_list        args) G_GNUC_PRINTF(3, 0);

GLIB_AVAILABLE_IN_ALL
void     g_error_free          (GError        *error);
GLIB_AVAILABLE_IN_ALL
GError*  g_error_copy          (const GError  *error);

GLIB_AVAILABLE_IN_ALL
gboolean g_error_matches       (const GError  *error,
                                GQuark         domain,
                                gint           code);

/* if (err) *err = g_error_new(domain, code, format, ...), also has
 * some sanity checks.
 */
GLIB_AVAILABLE_IN_ALL
void     g_set_error           (GError       **err,
                                GQuark         domain,
                                gint           code,
                                const gchar   *format,
                                ...) G_GNUC_PRINTF (4, 5);

GLIB_AVAILABLE_IN_ALL
void     g_set_error_literal   (GError       **err,
                                GQuark         domain,
                                gint           code,
                                const gchar   *message);

/* if (dest) *dest = src; also has some sanity checks.
 */
GLIB_AVAILABLE_IN_ALL
void     g_propagate_error     (GError       **dest,
				GError        *src);

/* if (err && *err) { g_error_free(*err); *err = NULL; } */
GLIB_AVAILABLE_IN_ALL
void     g_clear_error         (GError       **err);

/* if (err) prefix the formatted string to the ->message */
GLIB_AVAILABLE_IN_ALL
void     g_prefix_error               (GError       **err,
                                       const gchar   *format,
                                       ...) G_GNUC_PRINTF (2, 3);

/* if (err) prefix the string to the ->message */
GLIB_AVAILABLE_IN_2_70
void     g_prefix_error_literal       (GError       **err,
                                       const gchar   *prefix);

/* g_propagate_error then g_error_prefix on dest */
GLIB_AVAILABLE_IN_ALL
void     g_propagate_prefixed_error   (GError       **dest,
                                       GError        *src,
                                       const gchar   *format,
                                       ...) G_GNUC_PRINTF (3, 4);

G_END_DECLS

#endif /* __G_ERROR_H__ */
