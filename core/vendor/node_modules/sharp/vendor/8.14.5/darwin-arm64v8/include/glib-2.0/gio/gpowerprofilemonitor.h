/* GIO - GLib Input, Output and Streaming Library
 *
 * Copyright 2019 Red Hat, Inc.
 * Copyright 2021 Igalia S.L.
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
 */

#ifndef __G_POWER_PROFILE_MONITOR_H__
#define __G_POWER_PROFILE_MONITOR_H__

#if !defined (__GIO_GIO_H_INSIDE__) && !defined (GIO_COMPILATION)
#error "Only <gio/gio.h> can be included directly."
#endif

#include <gio/giotypes.h>

G_BEGIN_DECLS

/**
 * G_POWER_PROFILE_MONITOR_EXTENSION_POINT_NAME:
 *
 * Extension point for power profile usage monitoring functionality.
 * See [Extending GIO][extending-gio].
 *
 * Since: 2.70
 */
#define G_POWER_PROFILE_MONITOR_EXTENSION_POINT_NAME "gio-power-profile-monitor"

#define G_TYPE_POWER_PROFILE_MONITOR             (g_power_profile_monitor_get_type ())
GIO_AVAILABLE_IN_2_70
G_DECLARE_INTERFACE (GPowerProfileMonitor, g_power_profile_monitor, g, power_profile_monitor, GObject)

#define G_POWER_PROFILE_MONITOR(o)               (G_TYPE_CHECK_INSTANCE_CAST ((o), G_TYPE_POWER_PROFILE_MONITOR, GPowerProfileMonitor))
#define G_IS_POWER_PROFILE_MONITOR(o)            (G_TYPE_CHECK_INSTANCE_TYPE ((o), G_TYPE_POWER_PROFILE_MONITOR))
#define G_POWER_PROFILE_MONITOR_GET_INTERFACE(o) (G_TYPE_INSTANCE_GET_INTERFACE ((o), G_TYPE_POWER_PROFILE_MONITOR, GPowerProfileMonitorInterface))

struct _GPowerProfileMonitorInterface
{
  /*< private >*/
  GTypeInterface g_iface;
};

GIO_AVAILABLE_IN_2_70
GPowerProfileMonitor      *g_power_profile_monitor_dup_default              (void);

GIO_AVAILABLE_IN_2_70
gboolean                   g_power_profile_monitor_get_power_saver_enabled  (GPowerProfileMonitor *monitor);

G_END_DECLS

#endif /* __G_POWER_PROFILE_MONITOR_H__ */
