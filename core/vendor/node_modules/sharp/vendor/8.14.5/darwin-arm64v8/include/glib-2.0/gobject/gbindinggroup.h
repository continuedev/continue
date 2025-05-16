/* GObject - GLib Type, Object, Parameter and Signal Library
 *
 * Copyright (C) 2015-2022 Christian Hergert <christian@hergert.me>
 * Copyright (C) 2015 Garrett Regier <garrettregier@gmail.com>
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
 * You should have received a copy of the GNU Lesser General
 * Public License along with this library; if not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: LGPL-2.1-or-later
 */

#ifndef __G_BINDING_GROUP_H__
#define __G_BINDING_GROUP_H__

#if !defined (__GLIB_GOBJECT_H_INSIDE__) && !defined (GOBJECT_COMPILATION)
#error "Only <glib-object.h> can be included directly."
#endif

#include <glib.h>
#include <gobject/gobject.h>
#include <gobject/gbinding.h>

G_BEGIN_DECLS

#define G_BINDING_GROUP(obj)    (G_TYPE_CHECK_INSTANCE_CAST ((obj), G_TYPE_BINDING_GROUP, GBindingGroup))
#define G_IS_BINDING_GROUP(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), G_TYPE_BINDING_GROUP))
#define G_TYPE_BINDING_GROUP    (g_binding_group_get_type())

/**
 * GBindingGroup:
 *
 * GBindingGroup is an opaque structure whose members
 * cannot be accessed directly.
 *
 * Since: 2.72
 */
typedef struct _GBindingGroup GBindingGroup;

GOBJECT_AVAILABLE_IN_2_72
GType          g_binding_group_get_type           (void) G_GNUC_CONST;
GOBJECT_AVAILABLE_IN_2_72
GBindingGroup *g_binding_group_new                (void);
GOBJECT_AVAILABLE_IN_2_72
gpointer       g_binding_group_dup_source         (GBindingGroup         *self);
GOBJECT_AVAILABLE_IN_2_72
void           g_binding_group_set_source         (GBindingGroup         *self,
                                                   gpointer               source);
GOBJECT_AVAILABLE_IN_2_72
void           g_binding_group_bind               (GBindingGroup         *self,
                                                   const gchar           *source_property,
                                                   gpointer               target,
                                                   const gchar           *target_property,
                                                   GBindingFlags          flags);
GOBJECT_AVAILABLE_IN_2_72
void           g_binding_group_bind_full          (GBindingGroup         *self,
                                                   const gchar           *source_property,
                                                   gpointer               target,
                                                   const gchar           *target_property,
                                                   GBindingFlags          flags,
                                                   GBindingTransformFunc  transform_to,
                                                   GBindingTransformFunc  transform_from,
                                                   gpointer               user_data,
                                                   GDestroyNotify         user_data_destroy);
GOBJECT_AVAILABLE_IN_2_72
void           g_binding_group_bind_with_closures (GBindingGroup         *self,
                                                   const gchar           *source_property,
                                                   gpointer               target,
                                                   const gchar           *target_property,
                                                   GBindingFlags          flags,
                                                   GClosure              *transform_to,
                                                   GClosure              *transform_from);

G_END_DECLS

#endif /* __G_BINDING_GROUP_H__ */
