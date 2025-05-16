/*
 * Copyright © 2020 Canonical Ltd.
 * Copyright © 2021 Alexandros Theodotou
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
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, see <http://www.gnu.org/licenses/>.
 */

#ifndef __G_STRVBUILDER_H__
#define __G_STRVBUILDER_H__

#if !defined(__GLIB_H_INSIDE__) && !defined(GLIB_COMPILATION)
#error "Only <glib.h> can be included directly."
#endif

#include <glib/gstrfuncs.h>
#include <glib/gtypes.h>

G_BEGIN_DECLS

/**
 * GStrvBuilder:
 *
 * A helper object to build a %NULL-terminated string array
 * by appending. See g_strv_builder_new().
 *
 * Since: 2.68
 */
typedef struct _GStrvBuilder GStrvBuilder;

GLIB_AVAILABLE_IN_2_68
GStrvBuilder *g_strv_builder_new (void);

GLIB_AVAILABLE_IN_2_68
void g_strv_builder_unref (GStrvBuilder *builder);

GLIB_AVAILABLE_IN_2_68
GStrvBuilder *g_strv_builder_ref (GStrvBuilder *builder);

GLIB_AVAILABLE_IN_2_68
void g_strv_builder_add (GStrvBuilder *builder,
                         const char *value);

GLIB_AVAILABLE_IN_2_70
void g_strv_builder_addv (GStrvBuilder *builder,
                          const char **value);

GLIB_AVAILABLE_IN_2_70
void g_strv_builder_add_many (GStrvBuilder *builder,
                              ...) G_GNUC_NULL_TERMINATED;

GLIB_AVAILABLE_IN_2_68
GStrv g_strv_builder_end (GStrvBuilder *builder);

G_END_DECLS

#endif /* __G_STRVBUILDER_H__ */
