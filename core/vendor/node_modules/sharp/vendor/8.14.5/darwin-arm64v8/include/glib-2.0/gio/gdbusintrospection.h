/* GDBus - GLib D-Bus Library
 *
 * Copyright (C) 2008-2010 Red Hat, Inc.
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
 * Author: David Zeuthen <davidz@redhat.com>
 */

#ifndef __G_DBUS_INTROSPECTION_H__
#define __G_DBUS_INTROSPECTION_H__

#if !defined (__GIO_GIO_H_INSIDE__) && !defined (GIO_COMPILATION)
#error "Only <gio/gio.h> can be included directly."
#endif

#include <gio/giotypes.h>

G_BEGIN_DECLS

/**
 * GDBusAnnotationInfo:
 * @ref_count: The reference count or -1 if statically allocated.
 * @key: The name of the annotation, e.g. "org.freedesktop.DBus.Deprecated".
 * @value: The value of the annotation.
 * @annotations: (array zero-terminated=1): A pointer to a %NULL-terminated array of pointers to #GDBusAnnotationInfo structures or %NULL if there are no annotations.
 *
 * Information about an annotation.
 *
 * Since: 2.26
 */
struct _GDBusAnnotationInfo
{
  /*< public >*/
  gint                  ref_count;  /* (atomic) */
  gchar                *key;
  gchar                *value;
  GDBusAnnotationInfo **annotations;
};

/**
 * GDBusArgInfo:
 * @ref_count: The reference count or -1 if statically allocated.
 * @name: Name of the argument, e.g. @unix_user_id.
 * @signature: D-Bus signature of the argument (a single complete type).
 * @annotations: (array zero-terminated=1): A pointer to a %NULL-terminated array of pointers to #GDBusAnnotationInfo structures or %NULL if there are no annotations.
 *
 * Information about an argument for a method or a signal.
 *
 * Since: 2.26
 */
struct _GDBusArgInfo
{
  /*< public >*/
  gint                  ref_count;  /* (atomic) */
  gchar                *name;
  gchar                *signature;
  GDBusAnnotationInfo **annotations;
};

/**
 * GDBusMethodInfo:
 * @ref_count: The reference count or -1 if statically allocated.
 * @name: The name of the D-Bus method, e.g. @RequestName.
 * @in_args: (array zero-terminated=1): A pointer to a %NULL-terminated array of pointers to #GDBusArgInfo structures or %NULL if there are no in arguments.
 * @out_args: (array zero-terminated=1): A pointer to a %NULL-terminated array of pointers to #GDBusArgInfo structures or %NULL if there are no out arguments.
 * @annotations: (array zero-terminated=1): A pointer to a %NULL-terminated array of pointers to #GDBusAnnotationInfo structures or %NULL if there are no annotations.
 *
 * Information about a method on an D-Bus interface.
 *
 * Since: 2.26
 */
struct _GDBusMethodInfo
{
  /*< public >*/
  gint                  ref_count;  /* (atomic) */
  gchar                *name;
  GDBusArgInfo        **in_args;
  GDBusArgInfo        **out_args;
  GDBusAnnotationInfo **annotations;
};

/**
 * GDBusSignalInfo:
 * @ref_count: The reference count or -1 if statically allocated.
 * @name: The name of the D-Bus signal, e.g. "NameOwnerChanged".
 * @args: (array zero-terminated=1): A pointer to a %NULL-terminated array of pointers to #GDBusArgInfo structures or %NULL if there are no arguments.
 * @annotations: (array zero-terminated=1): A pointer to a %NULL-terminated array of pointers to #GDBusAnnotationInfo structures or %NULL if there are no annotations.
 *
 * Information about a signal on a D-Bus interface.
 *
 * Since: 2.26
 */
struct _GDBusSignalInfo
{
  /*< public >*/
  gint                  ref_count;  /* (atomic) */
  gchar                *name;
  GDBusArgInfo        **args;
  GDBusAnnotationInfo **annotations;
};

/**
 * GDBusPropertyInfo:
 * @ref_count: The reference count or -1 if statically allocated.
 * @name: The name of the D-Bus property, e.g. "SupportedFilesystems".
 * @signature: The D-Bus signature of the property (a single complete type).
 * @flags: Access control flags for the property.
 * @annotations: (array zero-terminated=1): A pointer to a %NULL-terminated array of pointers to #GDBusAnnotationInfo structures or %NULL if there are no annotations.
 *
 * Information about a D-Bus property on a D-Bus interface.
 *
 * Since: 2.26
 */
struct _GDBusPropertyInfo
{
  /*< public >*/
  gint                      ref_count;  /* (atomic) */
  gchar                    *name;
  gchar                    *signature;
  GDBusPropertyInfoFlags    flags;
  GDBusAnnotationInfo     **annotations;
};

/**
 * GDBusInterfaceInfo:
 * @ref_count: The reference count or -1 if statically allocated.
 * @name: The name of the D-Bus interface, e.g. "org.freedesktop.DBus.Properties".
 * @methods: (array zero-terminated=1): A pointer to a %NULL-terminated array of pointers to #GDBusMethodInfo structures or %NULL if there are no methods.
 * @signals: (array zero-terminated=1): A pointer to a %NULL-terminated array of pointers to #GDBusSignalInfo structures or %NULL if there are no signals.
 * @properties: (array zero-terminated=1): A pointer to a %NULL-terminated array of pointers to #GDBusPropertyInfo structures or %NULL if there are no properties.
 * @annotations: (array zero-terminated=1): A pointer to a %NULL-terminated array of pointers to #GDBusAnnotationInfo structures or %NULL if there are no annotations.
 *
 * Information about a D-Bus interface.
 *
 * Since: 2.26
 */
struct _GDBusInterfaceInfo
{
  /*< public >*/
  gint                  ref_count;  /* (atomic) */
  gchar                *name;
  GDBusMethodInfo     **methods;
  GDBusSignalInfo     **signals;
  GDBusPropertyInfo   **properties;
  GDBusAnnotationInfo **annotations;
};

/**
 * GDBusNodeInfo:
 * @ref_count: The reference count or -1 if statically allocated.
 * @path: The path of the node or %NULL if omitted. Note that this may be a relative path. See the D-Bus specification for more details.
 * @interfaces: (array zero-terminated=1): A pointer to a %NULL-terminated array of pointers to #GDBusInterfaceInfo structures or %NULL if there are no interfaces.
 * @nodes: (array zero-terminated=1): A pointer to a %NULL-terminated array of pointers to #GDBusNodeInfo structures or %NULL if there are no nodes.
 * @annotations: (array zero-terminated=1): A pointer to a %NULL-terminated array of pointers to #GDBusAnnotationInfo structures or %NULL if there are no annotations.
 *
 * Information about nodes in a remote object hierarchy.
 *
 * Since: 2.26
 */
struct _GDBusNodeInfo
{
  /*< public >*/
  gint                  ref_count;  /* (atomic) */
  gchar                *path;
  GDBusInterfaceInfo  **interfaces;
  GDBusNodeInfo       **nodes;
  GDBusAnnotationInfo **annotations;
};

GIO_AVAILABLE_IN_ALL
const gchar        *g_dbus_annotation_info_lookup          (GDBusAnnotationInfo **annotations,
                                                            const gchar          *name);
GIO_AVAILABLE_IN_ALL
GDBusMethodInfo    *g_dbus_interface_info_lookup_method    (GDBusInterfaceInfo   *info,
                                                            const gchar          *name);
GIO_AVAILABLE_IN_ALL
GDBusSignalInfo    *g_dbus_interface_info_lookup_signal    (GDBusInterfaceInfo   *info,
                                                            const gchar          *name);
GIO_AVAILABLE_IN_ALL
GDBusPropertyInfo  *g_dbus_interface_info_lookup_property  (GDBusInterfaceInfo   *info,
                                                            const gchar          *name);
GIO_AVAILABLE_IN_ALL
void                g_dbus_interface_info_cache_build      (GDBusInterfaceInfo   *info);
GIO_AVAILABLE_IN_ALL
void                g_dbus_interface_info_cache_release    (GDBusInterfaceInfo   *info);

GIO_AVAILABLE_IN_ALL
void                g_dbus_interface_info_generate_xml     (GDBusInterfaceInfo   *info,
                                                            guint                 indent,
                                                            GString              *string_builder);

GIO_AVAILABLE_IN_ALL
GDBusNodeInfo      *g_dbus_node_info_new_for_xml           (const gchar          *xml_data,
                                                            GError              **error);
GIO_AVAILABLE_IN_ALL
GDBusInterfaceInfo *g_dbus_node_info_lookup_interface      (GDBusNodeInfo        *info,
                                                            const gchar          *name);
GIO_AVAILABLE_IN_ALL
void                g_dbus_node_info_generate_xml          (GDBusNodeInfo        *info,
                                                            guint                 indent,
                                                            GString              *string_builder);

GIO_AVAILABLE_IN_ALL
GDBusNodeInfo       *g_dbus_node_info_ref                  (GDBusNodeInfo        *info);
GIO_AVAILABLE_IN_ALL
GDBusInterfaceInfo  *g_dbus_interface_info_ref             (GDBusInterfaceInfo   *info);
GIO_AVAILABLE_IN_ALL
GDBusMethodInfo     *g_dbus_method_info_ref                (GDBusMethodInfo      *info);
GIO_AVAILABLE_IN_ALL
GDBusSignalInfo     *g_dbus_signal_info_ref                (GDBusSignalInfo      *info);
GIO_AVAILABLE_IN_ALL
GDBusPropertyInfo   *g_dbus_property_info_ref              (GDBusPropertyInfo    *info);
GIO_AVAILABLE_IN_ALL
GDBusArgInfo        *g_dbus_arg_info_ref                   (GDBusArgInfo         *info);
GIO_AVAILABLE_IN_ALL
GDBusAnnotationInfo *g_dbus_annotation_info_ref            (GDBusAnnotationInfo  *info);

GIO_AVAILABLE_IN_ALL
void                 g_dbus_node_info_unref                (GDBusNodeInfo        *info);
GIO_AVAILABLE_IN_ALL
void                 g_dbus_interface_info_unref           (GDBusInterfaceInfo   *info);
GIO_AVAILABLE_IN_ALL
void                 g_dbus_method_info_unref              (GDBusMethodInfo      *info);
GIO_AVAILABLE_IN_ALL
void                 g_dbus_signal_info_unref              (GDBusSignalInfo      *info);
GIO_AVAILABLE_IN_ALL
void                 g_dbus_property_info_unref            (GDBusPropertyInfo    *info);
GIO_AVAILABLE_IN_ALL
void                 g_dbus_arg_info_unref                 (GDBusArgInfo         *info);
GIO_AVAILABLE_IN_ALL
void                 g_dbus_annotation_info_unref          (GDBusAnnotationInfo  *info);

/**
 * G_TYPE_DBUS_NODE_INFO:
 *
 * The #GType for a boxed type holding a #GDBusNodeInfo.
 *
 * Since: 2.26
 */
#define G_TYPE_DBUS_NODE_INFO       (g_dbus_node_info_get_type ())

/**
 * G_TYPE_DBUS_INTERFACE_INFO:
 *
 * The #GType for a boxed type holding a #GDBusInterfaceInfo.
 *
 * Since: 2.26
 */
#define G_TYPE_DBUS_INTERFACE_INFO  (g_dbus_interface_info_get_type ())

/**
 * G_TYPE_DBUS_METHOD_INFO:
 *
 * The #GType for a boxed type holding a #GDBusMethodInfo.
 *
 * Since: 2.26
 */
#define G_TYPE_DBUS_METHOD_INFO     (g_dbus_method_info_get_type ())

/**
 * G_TYPE_DBUS_SIGNAL_INFO:
 *
 * The #GType for a boxed type holding a #GDBusSignalInfo.
 *
 * Since: 2.26
 */
#define G_TYPE_DBUS_SIGNAL_INFO     (g_dbus_signal_info_get_type ())

/**
 * G_TYPE_DBUS_PROPERTY_INFO:
 *
 * The #GType for a boxed type holding a #GDBusPropertyInfo.
 *
 * Since: 2.26
 */
#define G_TYPE_DBUS_PROPERTY_INFO   (g_dbus_property_info_get_type ())

/**
 * G_TYPE_DBUS_ARG_INFO:
 *
 * The #GType for a boxed type holding a #GDBusArgInfo.
 *
 * Since: 2.26
 */
#define G_TYPE_DBUS_ARG_INFO        (g_dbus_arg_info_get_type ())

/**
 * G_TYPE_DBUS_ANNOTATION_INFO:
 *
 * The #GType for a boxed type holding a #GDBusAnnotationInfo.
 *
 * Since: 2.26
 */
#define G_TYPE_DBUS_ANNOTATION_INFO (g_dbus_annotation_info_get_type ())

GIO_AVAILABLE_IN_ALL
GType g_dbus_node_info_get_type       (void) G_GNUC_CONST;
GIO_AVAILABLE_IN_ALL
GType g_dbus_interface_info_get_type  (void) G_GNUC_CONST;
GIO_AVAILABLE_IN_ALL
GType g_dbus_method_info_get_type     (void) G_GNUC_CONST;
GIO_AVAILABLE_IN_ALL
GType g_dbus_signal_info_get_type     (void) G_GNUC_CONST;
GIO_AVAILABLE_IN_ALL
GType g_dbus_property_info_get_type   (void) G_GNUC_CONST;
GIO_AVAILABLE_IN_ALL
GType g_dbus_arg_info_get_type        (void) G_GNUC_CONST;
GIO_AVAILABLE_IN_ALL
GType g_dbus_annotation_info_get_type (void) G_GNUC_CONST;

G_END_DECLS

#endif /* __G_DBUS_INTROSPECTION_H__ */
