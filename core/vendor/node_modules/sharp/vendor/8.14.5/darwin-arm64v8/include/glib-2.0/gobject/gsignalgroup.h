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

#ifndef __G_SIGNAL_GROUP_H__
#define __G_SIGNAL_GROUP_H__

#if !defined (__GLIB_GOBJECT_H_INSIDE__) && !defined (GOBJECT_COMPILATION)
#error "Only <glib-object.h> can be included directly."
#endif

#include <glib.h>
#include <gobject/gobject.h>
#include <gobject/gsignal.h>

G_BEGIN_DECLS

#define G_SIGNAL_GROUP(obj)    (G_TYPE_CHECK_INSTANCE_CAST ((obj), G_TYPE_SIGNAL_GROUP, GSignalGroup))
#define G_IS_SIGNAL_GROUP(obj) (G_TYPE_CHECK_INSTANCE_TYPE ((obj), G_TYPE_SIGNAL_GROUP))
#define G_TYPE_SIGNAL_GROUP    (g_signal_group_get_type())

/**
 * GSignalGroup:
 *
 * #GSignalGroup is an opaque structure whose members
 * cannot be accessed directly.
 *
 * Since: 2.72
 */
typedef struct _GSignalGroup GSignalGroup;

GOBJECT_AVAILABLE_IN_2_72
GType         g_signal_group_get_type        (void) G_GNUC_CONST;
GOBJECT_AVAILABLE_IN_2_72
GSignalGroup *g_signal_group_new             (GType           target_type);
GOBJECT_AVAILABLE_IN_2_72
void          g_signal_group_set_target      (GSignalGroup   *self,
                                              gpointer        target);
GOBJECT_AVAILABLE_IN_2_72
gpointer      g_signal_group_dup_target      (GSignalGroup   *self);
GOBJECT_AVAILABLE_IN_2_72
void          g_signal_group_block           (GSignalGroup   *self);
GOBJECT_AVAILABLE_IN_2_72
void          g_signal_group_unblock         (GSignalGroup   *self);
GOBJECT_AVAILABLE_IN_2_74
void          g_signal_group_connect_closure (GSignalGroup   *self,
                                              const gchar    *detailed_signal,
                                              GClosure       *closure,
                                              gboolean        after);
GOBJECT_AVAILABLE_IN_2_72
void          g_signal_group_connect_object  (GSignalGroup   *self,
                                              const gchar    *detailed_signal,
                                              GCallback       c_handler,
                                              gpointer        object,
                                              GConnectFlags   flags);
GOBJECT_AVAILABLE_IN_2_72
void          g_signal_group_connect_data    (GSignalGroup   *self,
                                              const gchar    *detailed_signal,
                                              GCallback       c_handler,
                                              gpointer        data,
                                              GClosureNotify  notify,
                                              GConnectFlags   flags);
GOBJECT_AVAILABLE_IN_2_72
void          g_signal_group_connect         (GSignalGroup   *self,
                                              const gchar    *detailed_signal,
                                              GCallback       c_handler,
                                              gpointer        data);
GOBJECT_AVAILABLE_IN_2_72
void          g_signal_group_connect_after   (GSignalGroup   *self,
                                              const gchar    *detailed_signal,
                                              GCallback       c_handler,
                                              gpointer        data);
GOBJECT_AVAILABLE_IN_2_72
void          g_signal_group_connect_swapped (GSignalGroup   *self,
                                              const gchar    *detailed_signal,
                                              GCallback       c_handler,
                                              gpointer        data);

G_END_DECLS

#endif /* __G_SIGNAL_GROUP_H__ */
