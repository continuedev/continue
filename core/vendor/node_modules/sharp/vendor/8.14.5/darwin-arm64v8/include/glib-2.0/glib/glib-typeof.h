/* GLIB - Library of useful routines for C programming
 * Copyright (C) 2021  Iain Lane, Xavier Claessens
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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, see <http://www.gnu.org/licenses/>.
 */

#ifndef __GLIB_TYPEOF_H__
#define __GLIB_TYPEOF_H__

#if !defined (__GLIB_H_INSIDE__) && !defined (GLIB_COMPILATION)
#error "Only <glib.h> can be included directly."
#endif

#include <glib/gversionmacros.h>

/*
 * We can only use __typeof__ on GCC >= 4.8, and not when compiling C++. Since
 * __typeof__ is used in a few places in GLib, provide a pre-processor symbol
 * to factor the check out from callers.
 *
 * This symbol is private.
 */
#undef glib_typeof
#if !G_CXX_STD_CHECK_VERSION (11) && \
    (G_GNUC_CHECK_VERSION(4, 8) || defined(__clang__))
#define glib_typeof(t) __typeof__ (t)
#elif G_CXX_STD_CHECK_VERSION (11) && \
      GLIB_VERSION_MIN_REQUIRED >= GLIB_VERSION_2_68
/* C++11 decltype() is close enough for our usage */
#include <type_traits>
#define glib_typeof(t) typename std::remove_reference<decltype (t)>::type
#endif

#endif /* __GLIB_TYPEOF_H__ */
