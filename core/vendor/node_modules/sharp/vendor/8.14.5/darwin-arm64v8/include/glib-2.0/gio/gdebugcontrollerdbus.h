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

#ifndef __G_DEBUG_CONTROLLER_DBUS_H__
#define __G_DEBUG_CONTROLLER_DBUS_H__

#include <glib.h>
#include <glib-object.h>

G_BEGIN_DECLS

/**
 * GDebugControllerDBus:
 *
 * #GDebugControllerDBus is an implementation of #GDebugController over D-Bus.
 *
 * Since: 2.72
 */
#define G_TYPE_DEBUG_CONTROLLER_DBUS (g_debug_controller_dbus_get_type ())
GIO_AVAILABLE_IN_2_72
G_DECLARE_DERIVABLE_TYPE (GDebugControllerDBus, g_debug_controller_dbus, G, DEBUG_CONTROLLER_DBUS, GObject)

/**
 * GDebugControllerDBusClass:
 * @parent_class: The parent class.
 * @authorize: Default handler for the #GDebugControllerDBus::authorize signal.
 *
 * The virtual function table for #GDebugControllerDBus.
 *
 * Since: 2.72
 */
struct _GDebugControllerDBusClass
{
  GObjectClass parent_class;

  gboolean (*authorize)  (GDebugControllerDBus  *controller,
                          GDBusMethodInvocation *invocation);

  gpointer padding[12];
};

GIO_AVAILABLE_IN_2_72
GDebugControllerDBus *g_debug_controller_dbus_new (GDBusConnection  *connection,
                                                   GCancellable     *cancellable,
                                                   GError          **error);

GIO_AVAILABLE_IN_2_72
void g_debug_controller_dbus_stop (GDebugControllerDBus *self);

G_END_DECLS

#endif /* __G_DEBUG_CONTROLLER_DBUS_H__ */
