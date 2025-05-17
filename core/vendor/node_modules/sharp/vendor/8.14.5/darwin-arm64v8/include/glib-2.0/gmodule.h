/* GMODULE - GLIB wrapper code for dynamic module loading
 * Copyright (C) 1998 Tim Janik
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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.	 See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, see <http://www.gnu.org/licenses/>.
 */

/*
 * Modified by the GLib Team and others 1997-2000.  See the AUTHORS
 * file for a list of people on the GLib Team.  See the ChangeLog
 * files for a list of changes.  These files are distributed with
 * GLib at ftp://ftp.gtk.org/pub/gtk/. 
 */

#ifndef __GMODULE_H__
#define __GMODULE_H__

#include <glib.h>
#include <gmodule/gmodule-visibility.h>

G_BEGIN_DECLS

/* exporting and importing functions, this is special cased
 * to feature Windows dll stubs.
 */
#if defined(_WIN32) || defined(__CYGWIN__)
#  define G_MODULE_EXPORT __declspec(dllexport)
#  define G_MODULE_IMPORT __declspec(dllimport) extern
#elif __GNUC__ >= 4
#  define G_MODULE_EXPORT __attribute__((visibility("default")))
#  define G_MODULE_IMPORT extern
#else /* !defined(_WIN32) && !defined(__CYGWIN__) && __GNUC__ < 4 */
#  define G_MODULE_EXPORT
#  define G_MODULE_IMPORT extern
#endif

/**
 * GModuleFlags:
 * @G_MODULE_BIND_LAZY: specifies that symbols are only resolved when
 *     needed. The default action is to bind all symbols when the module
 *     is loaded.
 * @G_MODULE_BIND_LOCAL: specifies that symbols in the module should
 *     not be added to the global name space. The default action on most
 *     platforms is to place symbols in the module in the global name space,
 *     which may cause conflicts with existing symbols.
 * @G_MODULE_BIND_MASK: mask for all flags.
 *
 * Flags passed to g_module_open().
 * Note that these flags are not supported on all platforms.
 */
typedef enum
{
  G_MODULE_BIND_LAZY	= 1 << 0,
  G_MODULE_BIND_LOCAL	= 1 << 1,
  G_MODULE_BIND_MASK	= 0x03
} GModuleFlags;

typedef	struct _GModule			 GModule;
typedef const gchar* (*GModuleCheckInit) (GModule	*module);
typedef void	     (*GModuleUnload)	 (GModule	*module);

#define G_MODULE_ERROR g_module_error_quark () GMODULE_AVAILABLE_MACRO_IN_2_70
GMODULE_AVAILABLE_IN_2_70
GQuark g_module_error_quark (void);

/**
 * GModuleError:
 * @G_MODULE_ERROR_FAILED: there was an error loading or opening a module file
 * @G_MODULE_ERROR_CHECK_FAILED: a module returned an error from its `g_module_check_init()` function
 *
 * Errors returned by g_module_open_full().
 *
 * Since: 2.70
 */
typedef enum
{
  G_MODULE_ERROR_FAILED,
  G_MODULE_ERROR_CHECK_FAILED,
} GModuleError
GMODULE_AVAILABLE_ENUMERATOR_IN_2_70;

/* return TRUE if dynamic module loading is supported */
GMODULE_AVAILABLE_IN_ALL
gboolean	g_module_supported	   (void) G_GNUC_CONST;

/* open a module 'file_name' and return handle, which is NULL on error */
GMODULE_AVAILABLE_IN_ALL
GModule*              g_module_open          (const gchar  *file_name,
					      GModuleFlags  flags);

GMODULE_AVAILABLE_IN_2_70
GModule              *g_module_open_full     (const gchar   *file_name,
                                              GModuleFlags   flags,
                                              GError       **error);

/* close a previously opened module, returns TRUE on success */
GMODULE_AVAILABLE_IN_ALL
gboolean              g_module_close         (GModule      *module);

/* make a module resident so g_module_close on it will be ignored */
GMODULE_AVAILABLE_IN_ALL
void                  g_module_make_resident (GModule      *module);

/* query the last module error as a string */
GMODULE_AVAILABLE_IN_ALL
const gchar *         g_module_error         (void);

/* retrieve a symbol pointer from 'module', returns TRUE on success */
GMODULE_AVAILABLE_IN_ALL
gboolean              g_module_symbol        (GModule      *module,
					      const gchar  *symbol_name,
					      gpointer     *symbol);

/* retrieve the file name from an existing module */
GMODULE_AVAILABLE_IN_ALL
const gchar *         g_module_name          (GModule      *module);

/* Build the actual file name containing a module. 'directory' is the
 * directory where the module file is supposed to be, or NULL or empty
 * in which case it should either be in the current directory or, on
 * some operating systems, in some standard place, for instance on the
 * PATH. Hence, to be absolutely sure to get the correct module,
 * always pass in a directory. The file name consists of the directory,
 * if supplied, and 'module_name' suitably decorated according to
 * the operating system's conventions (for instance lib*.so or *.dll).
 *
 * No checks are made that the file exists, or is of correct type.
 */
GMODULE_DEPRECATED_IN_2_76
gchar*                g_module_build_path    (const gchar  *directory,
					      const gchar  *module_name);

G_END_DECLS

#endif /* __GMODULE_H__ */
