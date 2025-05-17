/* GIO - GLib Input, Output and Streaming Library
 *
 * Copyright © 2021 Endless OS Foundation, LLC
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
 * You should have received a copy of the GNU Lesser General
 * Public License along with this library; if not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: LGPL-2.1-or-later
 */

#ifndef __G_DEBUG_CONTROLLER_H__
#define __G_DEBUG_CONTROLLER_H__

#if !defined (__GIO_GIO_H_INSIDE__) && !defined (GIO_COMPILATION)
#error "Only <gio/gio.h> can be included directly."
#endif

#include <gio/giotypes.h>

G_BEGIN_DECLS

/**
 * G_DEBUG_CONTROLLER_EXTENSION_POINT_NAME:
 *
 * Extension point for debug control functionality.
 * See [Extending GIO][extending-gio].
 *
 * Since: 2.72
 */
#define G_DEBUG_CONTROLLER_EXTENSION_POINT_NAME "gio-debug-controller"

/**
 * GDebugController:
 *
 * #GDebugController is an interface to expose control of debugging features and
 * debug output.
 *
 * Since: 2.72
 */
#define G_TYPE_DEBUG_CONTROLLER             (g_debug_controller_get_type ())
GIO_AVAILABLE_IN_2_72
G_DECLARE_INTERFACE(GDebugController, g_debug_controller, g, debug_controller, GObject)

#define G_DEBUG_CONTROLLER(o)               (G_TYPE_CHECK_INSTANCE_CAST ((o), G_TYPE_DEBUG_CONTROLLER, GDebugController))
#define G_IS_DEBUG_CONTROLLER(o)            (G_TYPE_CHECK_INSTANCE_TYPE ((o), G_TYPE_DEBUG_CONTROLLER))
#define G_DEBUG_CONTROLLER_GET_INTERFACE(o) (G_TYPE_INSTANCE_GET_INTERFACE ((o), G_TYPE_DEBUG_CONTROLLER, GDebugControllerInterface))

/**
 * GDebugControllerInterface:
 * @g_iface: The parent interface.
 *
 * The virtual function table for #GDebugController.
 *
 * Since: 2.72
 */
struct _GDebugControllerInterface {
  /*< private >*/
  GTypeInterface g_iface;
};

GIO_AVAILABLE_IN_2_72
gboolean               g_debug_controller_get_debug_enabled     (GDebugController *self);
GIO_AVAILABLE_IN_2_72
void                   g_debug_controller_set_debug_enabled     (GDebugController *self,
                                                                 gboolean          debug_enabled);

G_END_DECLS

#endif /* __G_DEBUG_CONTROLLER_H__ */
