/*
 * Copyright © 2011 Canonical Ltd.
 *
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 *  This library is free software; you can redistribute it and/or
 *  modify it under the terms of the GNU Lesser General Public
 *  License as published by the Free Software Foundation; either
 *  version 2.1 of the License, or (at your option) any later version.
 *
 *  This library is distributed in the hope that it will be useful, but
 *  WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *  Lesser General Public License for more details.
 *
 *  You should have received a copy of the GNU Lesser General Public
 *  License along with this library; if not, see <http://www.gnu.org/licenses/>.
 *
 * Author: Ryan Lortie <desrt@desrt.ca>
 */

#ifndef __G_MENU_EXPORTER_H__
#define __G_MENU_EXPORTER_H__

#include <gio/gdbusconnection.h>
#include <gio/gmenumodel.h>

G_BEGIN_DECLS

/**
 * G_MENU_EXPORTER_MAX_SECTION_SIZE:
 *
 * The maximum number of entries in a menu section supported by
 * g_dbus_connection_export_menu_model().
 *
 * The exact value of the limit may change in future GLib versions.
 *
 * Since: 2.76
 */
#define G_MENU_EXPORTER_MAX_SECTION_SIZE 1000 \
  GIO_AVAILABLE_MACRO_IN_2_76

GIO_AVAILABLE_IN_2_32
guint                   g_dbus_connection_export_menu_model             (GDBusConnection  *connection,
                                                                         const gchar      *object_path,
                                                                         GMenuModel       *menu,
                                                                         GError          **error);

GIO_AVAILABLE_IN_2_32
void                    g_dbus_connection_unexport_menu_model           (GDBusConnection  *connection,
                                                                         guint             export_id);

G_END_DECLS

#endif /* __G_MENU_EXPORTER_H__ */
