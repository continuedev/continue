/* -*- Mode: C; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* vim: set sw=4 sts=4 expandtab: */
/*
   rsvg.h: SAX-based renderer for SVG files into a GdkPixbuf.

   Copyright (C) 2000 Eazel, Inc.

   This library is free software; you can redistribute it and/or
   modify it under the terms of the GNU Lesser General Public
   License as published by the Free Software Foundation; either
   version 2.1 of the License, or (at your option) any later version.

   This library is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
   Lesser General Public License for more details.

   You should have received a copy of the GNU Lesser General Public
   License along with this library; if not, write to the Free Software
   Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301  USA

   Author: Raph Levien <raph@artofcode.com>
*/

#ifndef RSVG_H
#define RSVG_H

#define __RSVG_RSVG_H_INSIDE__

#include <glib-object.h>
#include <gio/gio.h>

#include <cairo.h>
#include <gdk-pixbuf/gdk-pixbuf.h>

G_BEGIN_DECLS

#ifndef __GTK_DOC_IGNORE__

/* Override to export public/semi-public APIs */
#ifndef RSVG_API
# define RSVG_API
#endif

#if defined(RSVG_DISABLE_DEPRECATION_WARNINGS) || !GLIB_CHECK_VERSION (2, 31, 0)
#define RSVG_DEPRECATED RSVG_API
#define RSVG_DEPRECATED_FOR(f) RSVG_API
#else
#define RSVG_DEPRECATED G_DEPRECATED RSVG_API
#define RSVG_DEPRECATED_FOR(f) G_DEPRECATED_FOR(f) RSVG_API
#endif

#endif /* __GTK_DOC_IGNORE__ */

/**
 * RsvgError:
 * @RSVG_ERROR_FAILED: the request failed
 *
 * An enumeration representing possible errors
 */
typedef enum {
    RSVG_ERROR_FAILED
} RsvgError;

#define RSVG_ERROR (rsvg_error_quark ())

/**
 * rsvg_error_quark:
 *
 * The error domain for RSVG
 *
 * Returns: The error domain
 */
RSVG_API
GQuark rsvg_error_quark (void) G_GNUC_CONST;

RSVG_API
GType rsvg_error_get_type (void);
#define RSVG_TYPE_ERROR (rsvg_error_get_type())

/**
 * RsvgHandle:
 *
 * [class@Rsvg.Handle] loads an SVG document into memory.
 *
 * This is the main entry point into the librsvg library.  An [class@Rsvg.Handle] is an
 * object that represents SVG data in memory.  Your program creates an
 * [class@Rsvg.Handle] from an SVG file, or from a memory buffer that contains SVG data,
 * or in the most general form, from a `GInputStream` that will provide SVG data.
 *
 * Librsvg can load SVG images and render them to Cairo surfaces,
 * using a mixture of SVG's [static mode] and [secure static mode].
 * Librsvg does not do animation nor scripting, and can load
 * references to external data only in some situations; see below.
 *
 * Librsvg supports reading [SVG 1.1](https://www.w3.org/TR/SVG11/) data, and is gradually
 * adding support for features in [SVG 2](https://www.w3.org/TR/SVG2/).  Librsvg also
 * supports SVGZ files, which are just an SVG stream compressed with the GZIP algorithm.
 *
 * [static mode]: https://www.w3.org/TR/SVG2/conform.html#static-mode
 * [secure static mode]: https://www.w3.org/TR/SVG2/conform.html#secure-static-mode
 *
 * # The "base file" and resolving references to external files
 *
 * When you load an SVG, librsvg needs to know the location of the "base file"
 * for it.  This is so that librsvg can determine the location of referenced
 * entities.  For example, say you have an SVG in `/foo/bar/foo.svg`
 * and that it has an image element like this:
 *
 * ```
 * <image href="resources/foo.png" .../>
 * ```
 *
 * In this case, librsvg needs to know the location of the toplevel
 * `/foo/bar/foo.svg` so that it can generate the appropriate
 * reference to `/foo/bar/resources/foo.png`.
 *
 * ## Security and locations of referenced files
 *
 * When processing an SVG, librsvg will only load referenced files if they are
 * in the same directory as the base file, or in a subdirectory of it.  That is,
 * if the base file is `/foo/bar/baz.svg`, then librsvg will
 * only try to load referenced files (from SVG's
 * `<image>` element, for example, or from content
 * included through XML entities) if those files are in `/foo/bar/<anything>` or in `/foo/bar/<anything>\/.../<anything>`.
 * This is so that malicious SVG files cannot include files that are in a directory above.
 *
 * The full set of rules for deciding which URLs may be loaded is as follows;
 * they are applied in order.  A referenced URL will not be loaded as soon as
 * one of these rules fails:
 *
 * 1. All `data:` URLs may be loaded.  These are sometimes used
 *    to include raster image data, encoded as base-64, directly in an SVG file.
 *
 * 2. URLs with queries ("?") or fragment identifiers ("#") are not allowed.
 *
 * 3. All URL schemes other than data: in references require a base URL.  For
 *    example, this means that if you load an SVG with
 *    [ctor@Rsvg.Handle.new_from_data] without calling [method@Rsvg.Handle.set_base_uri],
 *    then any referenced files will not be allowed (e.g. raster images to be
 *    loaded from other files will not work).
 *
 * 4. If referenced URLs are absolute, rather than relative, then they must
 *    have the same scheme as the base URL.  For example, if the base URL has a
 *    `file` scheme, then all URL references inside the SVG must
 *    also have the `file` scheme, or be relative references which
 *    will be resolved against the base URL.
 *
 * 5. If referenced URLs have a `resource` scheme, that is,
 *    if they are included into your binary program with GLib's resource
 *    mechanism, they are allowed to be loaded (provided that the base URL is
 *    also a `resource`, per the previous rule).
 *
 * 6. Otherwise, non-`file` schemes are not allowed.  For
 *    example, librsvg will not load `http` resources, to keep
 *    malicious SVG data from "phoning home".
 *
 * 7. A relative URL must resolve to the same directory as the base URL, or to
 *    one of its subdirectories.  Librsvg will canonicalize filenames, by
 *    removing ".." path components and resolving symbolic links, to decide whether
 *    files meet these conditions.
 *
 * # Loading an SVG with GIO
 *
 * This is the easiest and most resource-efficient way of loading SVG data into
 * an [class@Rsvg.Handle].
 *
 * If you have a `GFile` that stands for an SVG file, you can simply call
 * [ctor@Rsvg.Handle.new_from_gfile_sync] to load an [class@Rsvg.Handle] from it.
 *
 * Alternatively, if you have a `GInputStream`, you can use
 * [ctor@Rsvg.Handle.new_from_stream_sync].
 *
 * Both of those methods allow specifying a `GCancellable`, so the loading
 * process can be cancelled from another thread.
 *
 * ## Loading an SVG from memory
 *
 * If you already have SVG data in a byte buffer in memory, you can create a
 * memory input stream with [ctor@Gio.MemoryInputStream.new_from_data] and feed that
 * to [ctor@Rsvg.Handle.new_from_stream_sync].
 *
 * Note that in this case, it is important that you specify the base_file for
 * the in-memory SVG data.  Librsvg uses the base_file to resolve links to
 * external content, like raster images.
 *
 * # Loading an SVG without GIO
 *
 * You can load an [class@Rsvg.Handle] from a simple filename or URI with
 * [ctor@Rsvg.Handle.new_from_file].  Note that this is a blocking operation; there
 * is no way to cancel it if loading a remote URI takes a long time.  Also, note that
 * this method does not let you specify [flags@Rsvg.HandleFlags].
 *
 * Otherwise, loading an SVG without GIO is not recommended, since librsvg will
 * need to buffer your entire data internally before actually being able to
 * parse it.  The deprecated way of doing this is by creating a handle with
 * [ctor@Rsvg.Handle.new] or [ctor@Rsvg.Handle.new_with_flags], and then using
 * [method@Rsvg.Handle.write] and [method@Rsvg.Handle.close] to feed the handle with SVG data.
 * Still, please try to use the GIO stream functions instead.
 *
 * # Resolution of the rendered image (dots per inch, or DPI)
 *
 * SVG images can contain dimensions like "`5cm`" or
 * "`2pt`" that must be converted from physical units into
 * device units.  To do this, librsvg needs to know the actual dots per inch
 * (DPI) of your target device.  You can call [method@Rsvg.Handle.set_dpi] or
 * [method@Rsvg.Handle.set_dpi_x_y] on an [class@Rsvg.Handle] to set the DPI before rendering
 * it.
 *
 * # Rendering
 *
 * The preferred way to render a whole SVG document is to use
 * [method@Rsvg.Handle.render_document].  Please see its documentation for
 * details.
 *
 * # API ordering
 *
 * Due to the way the librsvg API evolved over time, an [class@Rsvg.Handle] object is available
 * for use as soon as it is constructed.  However, not all of its methods can be
 * called at any time.  For example, an [class@Rsvg.Handle] just constructed with [ctor@Rsvg.Handle.new]
 * is not loaded yet, and it does not make sense to call [method@Rsvg.Handle.render_document] on it
 * just at that point.
 *
 * The documentation for the available methods in [class@Rsvg.Handle] may mention that a particular
 * method is only callable on a "fully loaded handle".  This means either:
 *
 * * The handle was loaded with [method@Rsvg.Handle.write] and [method@Rsvg.Handle.close], and
 *   those functions returned no errors.
 *
 * * The handle was loaded with [method@Rsvg.Handle.read_stream_sync] and that function
 *   returned no errors.
 *
 * Before librsvg 2.46, the library did not fully verify that a handle was in a
 * fully loaded state for the methods that require it.  To preserve
 * compatibility with old code which inadvertently called the API without
 * checking for errors, or which called some methods outside of the expected
 * order, librsvg will just emit a `g_critical()` message in those cases.
 *
 * New methods introduced in librsvg 2.46 and later will check for the correct
 * ordering, and panic if they are called out of order.  This will abort
 * the program as if it had a failed assertion.
 */

/***** Begin documentation for RsvgHandle properties *****/

/**
 * RsvgHandle:flags:
 *
 * Flags from [flags@Rsvg.HandleFlags].
 *
 * Since: 2.36
 */

/**
 * RsvgHandle:dpi-x:
 *
 * Horizontal resolution in dots per inch.
 */

/**
 * RsvgHandle:dpi-y:
 *
 * Horizontal resolution in dots per inch.
 */

/**
 * RsvgHandle:base-uri: (attributes org.gtk.Property.get=rsvg_handle_get_base_uri org.gtk.Property.set=rsvg_handle_set_base_uri)
 *
 * Base URI, to be used to resolve relative references for resources.  See the section
 * "Security and locations of referenced files" for details.
 */

/**
 * RsvgHandle:width:
 *
 * Width, in pixels, of the rendered SVG after calling the size callback
 * as specified by [method@Rsvg.Handle.set_size_callback].
 *
 * Deprecated: 2.46.  For historical reasons, this property is of integer type,
 * which cannot give the exact size of SVG images that are not pixel-aligned.
 * Moreover, reading each of the size properties causes the size of the SVG to
 * be recomputed, so reading both the `width` and
 * `height` properties will cause two such computations.
 * Please use [method@Rsvg.Handle.get_intrinsic_dimensions] instead.
 */

/**
 * RsvgHandle:height:
 *
 * Height, in pixels, of the rendered SVG after calling the size callback
 * as specified by [method@Rsvg.Handle.set_size_callback].
 *
 * Deprecated: 2.46.  For historical reasons, this property is of integer type,
 * which cannot give the exact size of SVG images that are not pixel-aligned.
 * Moreover, reading each of the size properties causes the size of the SVG to
 * be recomputed, so reading both the `width` and
 * `height` properties will cause two such computations.
 * Please use [method@Rsvg.Handle.get_intrinsic_dimensions] instead.
 */

/**
 * RsvgHandle:em:
 *
 * Exact width, in pixels, of the rendered SVG before calling the size callback
 * as specified by [method@Rsvg.Handle.set_size_callback].
 *
 * Deprecated: 2.46.  Reading each of the size properties causes the size of the
 * SVG to be recomputed, so reading both the `em` and
 * `ex` properties will cause two such computations.  Please
 * use [method@Rsvg.Handle.get_intrinsic_dimensions] instead.
 */

/**
 * RsvgHandle:ex:
 *
 * Exact height, in pixels, of the rendered SVG before calling the size callback
 * as specified by [method@Rsvg.Handle.set_size_callback].
 *
 * Deprecated: 2.46.  Reading each of the size properties causes the size of the
 * SVG to be recomputed, so reading both the `em` and
 * `ex` properties will cause two such computations.  Please
 * use [method@Rsvg.Handle.get_intrinsic_dimensions] instead.
 */

/**
 * RsvgHandle:title:
 *
 * SVG's title.
 *
 * Deprecated: 2.36.  Reading this property always returns `NULL`.
 */

/**
 * RsvgHandle:desc:
 *
 * SVG's description.
 *
 * Deprecated: 2.36.  Reading this property always returns `NULL`.
 */

/**
 * RsvgHandle:metadata:
 *
 * SVG's metadata
 *
 * Deprecated: 2.36.  Reading this property always returns `NULL`.
 */

/***** End documentation for RsvgHandle properties *****/

#define RSVG_TYPE_HANDLE                  (rsvg_handle_get_type ())
#define RSVG_HANDLE(obj)                  (G_TYPE_CHECK_INSTANCE_CAST ((obj), RSVG_TYPE_HANDLE, RsvgHandle))
#define RSVG_HANDLE_CLASS(klass)          (G_TYPE_CHECK_CLASS_CAST ((klass), RSVG_TYPE_HANDLE, RsvgHandleClass))
#define RSVG_IS_HANDLE(obj)               (G_TYPE_CHECK_INSTANCE_TYPE ((obj), RSVG_TYPE_HANDLE))
#define RSVG_IS_HANDLE_CLASS(klass)       (G_TYPE_CHECK_CLASS_TYPE ((klass), RSVG_TYPE_HANDLE))
#define RSVG_HANDLE_GET_CLASS(obj)        (G_TYPE_INSTANCE_GET_CLASS ((obj), RSVG_TYPE_HANDLE, RsvgHandleClass))

RSVG_API
GType rsvg_handle_get_type (void);

typedef struct _RsvgHandle RsvgHandle;
typedef struct _RsvgHandleClass RsvgHandleClass;
typedef struct _RsvgDimensionData RsvgDimensionData;
typedef struct _RsvgPositionData RsvgPositionData;
typedef struct _RsvgRectangle RsvgRectangle;

/**
 * RsvgHandleClass:
 * @parent: parent class
 *
 * Class structure for [class@Rsvg.Handle].
 */
struct _RsvgHandleClass {
    GObjectClass parent;

    /*< private >*/
    gpointer _abi_padding[15];
};

struct _RsvgHandle {
    GObject parent;

    /*< private >*/

    gpointer _abi_padding[16];
};

/**
 * RsvgDimensionData:
 * @width: SVG's width, in pixels
 * @height: SVG's height, in pixels
 * @em: SVG's original width, unmodified by `RsvgSizeFunc`
 * @ex: SVG's original height, unmodified by `RsvgSizeFunc`
 *
 * Dimensions of an SVG image from [method@Rsvg.Handle.get_dimensions], or an
 * individual element from [method@Rsvg.Handle.get_dimensions_sub].  Please see
 * the deprecation documentation for those functions.
 *
 * Deprecated: 2.46.  Use [method@Rsvg.Handle.get_intrinsic_size_in_pixels] or
 * [method@Rsvg.Handle.get_geometry_for_layer] instead.
 */
struct _RsvgDimensionData {
    int width;
    int height;
    gdouble em;
    gdouble ex;
};

/**
 * RsvgPositionData:
 * @x: position on the x axis
 * @y: position on the y axis
 *
 * Position of an SVG fragment from [method@Rsvg.Handle.get_position_sub].  Please
 * the deprecation documentation for that function.
 *
 * Deprecated: 2.46.  Use [method@Rsvg.Handle.get_geometry_for_layer] instead.
 */
struct _RsvgPositionData {
    int x;
    int y;
};

/**
 * RsvgRectangle:
 * @x: X coordinate of the left side of the rectangle
 * @y: Y coordinate of the the top side of the rectangle
 * @width: width of the rectangle
 * @height: height of the rectangle
 *
 * A data structure for holding a rectangle.
 *
 * Since: 2.46
 */
struct _RsvgRectangle {
    double x;
    double y;
    double width;
    double height;
};

/**
 * rsvg_cleanup:
 *
 * This function does nothing.
 *
 * Since: 2.36
 * Deprecated: 2.46: No-op. This function should not be called from normal programs.
 */
RSVG_DEPRECATED
void rsvg_cleanup (void);

/**
 * rsvg_set_default_dpi:
 * @dpi: Dots Per Inch (aka Pixels Per Inch)
 *
 * Do not use this function.  Create an [class@Rsvg.Handle] and call
 * [method@Rsvg.Handle.set_dpi] on it instead.
 *
 * Since: 2.8
 *
 * Deprecated: 2.42.3: This function used to set a global default DPI.  However,
 * it only worked if it was called before any [class@Rsvg.Handle] objects had been
 * created; it would not work after that.  To avoid global mutable state, please
 * use [method@Rsvg.Handle.set_dpi] instead.
 */
RSVG_DEPRECATED
void rsvg_set_default_dpi (double dpi);

/**
 * rsvg_set_default_dpi_x_y:
 * @dpi_x: Dots Per Inch (aka Pixels Per Inch)
 * @dpi_y: Dots Per Inch (aka Pixels Per Inch)
 *
 * Do not use this function.  Create an [class@Rsvg.Handle] and call
 * [method@Rsvg.Handle.set_dpi_x_y] on it instead.
 *
 * Since: 2.8
 *
 * Deprecated: 2.42.3: This function used to set a global default DPI.  However,
 * it only worked if it was called before any [class@Rsvg.Handle] objects had been
 * created; it would not work after that.  To avoid global mutable state, please
 * use [method@Rsvg.Handle.set_dpi] instead.
 */
RSVG_DEPRECATED
void rsvg_set_default_dpi_x_y (double dpi_x, double dpi_y);

/**
 * rsvg_handle_set_dpi:
 * @handle: An [class@Rsvg.Handle]
 * @dpi: Dots Per Inch (i.e. as Pixels Per Inch)
 *
 * Sets the DPI at which the @handle will be rendered. Common values are
 * 75, 90, and 300 DPI.
 *
 * Passing a number <= 0 to @dpi will reset the DPI to whatever the default
 * value happens to be, but since [id@rsvg_set_default_dpi] is deprecated, please
 * do not pass values <= 0 to this function.
 *
 * Since: 2.8
 */
RSVG_API
void rsvg_handle_set_dpi (RsvgHandle *handle, double dpi);

/**
 * rsvg_handle_set_dpi_x_y:
 * @handle: An [class@Rsvg.Handle]
 * @dpi_x: Dots Per Inch (i.e. Pixels Per Inch)
 * @dpi_y: Dots Per Inch (i.e. Pixels Per Inch)
 *
 * Sets the DPI at which the @handle will be rendered. Common values are
 * 75, 90, and 300 DPI.
 *
 * Passing a number <= 0 to @dpi will reset the DPI to whatever the default
 * value happens to be, but since [id@rsvg_set_default_dpi_x_y] is deprecated,
 * please do not pass values <= 0 to this function.
 *
 * Since: 2.8
 */
RSVG_API
void rsvg_handle_set_dpi_x_y (RsvgHandle *handle, double dpi_x, double dpi_y);

/**
 * rsvg_handle_new:
 *
 * Returns a new rsvg handle.  Must be freed with [method@GObject.Object.unref].  This
 * handle can be used to load an image.
 *
 * The preferred way of loading SVG data into the returned [class@Rsvg.Handle] is with
 * [method@Rsvg.Handle.read_stream_sync].
 *
 * The deprecated way of loading SVG data is with [method@Rsvg.Handle.write] and
 * [method@Rsvg.Handle.close]; note that these require buffering the entire file
 * internally, and for this reason it is better to use the stream functions:
 * [ctor@Rsvg.Handle.new_from_stream_sync], [method@Rsvg.Handle.read_stream_sync], or
 * [ctor@Rsvg.Handle.new_from_gfile_sync].
 *
 * After loading the [class@Rsvg.Handle] with data, you can render it using Cairo or get
 * a GdkPixbuf from it. When finished, free the handle with [method@GObject.Object.unref]. No
 * more than one image can be loaded with one handle.
 *
 * Note that this function creates an [class@Rsvg.Handle] with no flags set.  If you
 * require any of [flags@Rsvg.HandleFlags] to be set, use any of
 * [ctor@Rsvg.Handle.new_with_flags], [ctor@Rsvg.Handle.new_from_stream_sync], or
 * [ctor@Rsvg.Handle.new_from_gfile_sync].
 *
 * Returns: (transfer full): A new [class@Rsvg.Handle] with no flags set.
 **/
RSVG_API
RsvgHandle *rsvg_handle_new (void);

/**
 * rsvg_handle_write:
 * @handle: an [class@Rsvg.Handle]
 * @buf: (array length=count) (element-type guchar): pointer to svg data
 * @count: length of the @buf buffer in bytes
 * @error: return location for a `GError`
 *
 * Loads the next @count bytes of the image.  You can call this function multiple
 * times until the whole document is consumed; then you must call [method@Rsvg.Handle.close]
 * to actually parse the document.
 *
 * Before calling this function for the first time, you may need to call
 * [method@Rsvg.Handle.set_base_uri] or [method@Rsvg.Handle.set_base_gfile] to set the "base
 * file" for resolving references to external resources.  SVG elements like
 * `<image>` which reference external resources will be
 * resolved relative to the location you specify with those functions.
 *
 * Returns: `TRUE` on success, or `FALSE` on error.
 *
 * Deprecated: 2.46.  Use [method@Rsvg.Handle.read_stream_sync] or the constructor
 * functions [ctor@Rsvg.Handle.new_from_gfile_sync] or
 * [ctor@Rsvg.Handle.new_from_stream_sync].  This function is deprecated because it
 * will accumulate data from the @buf in memory until [method@Rsvg.Handle.close] gets
 * called.  To avoid a big temporary buffer, use the suggested functions, which
 * take a `GFile` or a `GInputStream` and do not require a temporary buffer.
 **/
RSVG_DEPRECATED_FOR(rsvg_handle_read_stream_sync)
gboolean rsvg_handle_write (RsvgHandle   *handle,
                            const guchar *buf,
                            gsize         count,
                            GError      **error);

/**
 * rsvg_handle_close:
 * @handle: a [class@Rsvg.Handle]
 * @error: return location for a `GError`
 *
 * This is used after calling [method@Rsvg.Handle.write] to indicate that there is no more data
 * to consume, and to start the actual parsing of the SVG document.  The only reason to
 * call this function is if you use use [method@Rsvg.Handle.write] to feed data into the @handle;
 * if you use the other methods like [ctor@Rsvg.Handle.new_from_file] or
 * [method@Rsvg.Handle.read_stream_sync], then you do not need to call this function.
 *
 * This will return `TRUE` if the loader closed successfully and the
 * SVG data was parsed correctly.  Note that @handle isn't freed until
 * [method@GObject.Object.unref] is called.
 *
 * Returns: `TRUE` on success, or `FALSE` on error.
 *
 * Deprecated: 2.46.  Use [method@Rsvg.Handle.read_stream_sync] or the constructor
 * functions [ctor@Rsvg.Handle.new_from_gfile_sync] or
 * [ctor@Rsvg.Handle.new_from_stream_sync].  See the deprecation notes for
 * [method@Rsvg.Handle.write] for more information.
 **/
RSVG_DEPRECATED_FOR(rsvg_handle_read_stream_sync)
gboolean rsvg_handle_close (RsvgHandle *handle, GError **error);

/**
 * rsvg_handle_get_pixbuf:
 * @handle: An [class@Rsvg.Handle]
 *
 * Returns the pixbuf loaded by @handle.  The pixbuf returned will be reffed, so
 * the caller of this function must assume that ref.
 *
 * API ordering: This function must be called on a fully-loaded @handle.  See
 * the section "[API ordering](class.Handle.html#api-ordering)" for details.
 *
 * This function depends on the [class@Rsvg.Handle]'s dots-per-inch value (DPI) to compute the
 * "natural size" of the document in pixels, so you should call [method@Rsvg.Handle.set_dpi]
 * beforehand.
 *
 * Returns: (transfer full) (nullable): A pixbuf, or %NULL on error.
 * during rendering.
 **/
RSVG_API
GdkPixbuf *rsvg_handle_get_pixbuf (RsvgHandle *handle);

/**
 * rsvg_handle_get_pixbuf_sub:
 * @handle: An #RsvgHandle
 * @id: (nullable): An element's id within the SVG, starting with "#" (a single
 * hash character), for example, `#layer1`.  This notation corresponds to a
 * URL's fragment ID.  Alternatively, pass `NULL` to use the whole SVG.
 *
 * Creates a `GdkPixbuf` the same size as the entire SVG loaded into @handle, but
 * only renders the sub-element that has the specified @id (and all its
 * sub-sub-elements recursively).  If @id is `NULL`, this function renders the
 * whole SVG.
 *
 * This function depends on the [class@Rsvg.Handle]'s dots-per-inch value (DPI) to compute the
 * "natural size" of the document in pixels, so you should call [method@Rsvg.Handle.set_dpi]
 * beforehand.
 *
 * If you need to render an image which is only big enough to fit a particular
 * sub-element of the SVG, consider using [method@Rsvg.Handle.render_element].
 *
 * Element IDs should look like an URL fragment identifier; for example, pass
 * `#foo` (hash `foo`) to get the geometry of the element that
 * has an `id="foo"` attribute.
 *
 * API ordering: This function must be called on a fully-loaded @handle.  See
 * the section "[API ordering](class.Handle.html#api-ordering)" for details.
 *
 * Returns: (transfer full) (nullable): a pixbuf, or `NULL` if an error occurs
 * during rendering.
 *
 * Since: 2.14
 **/
RSVG_API
GdkPixbuf *rsvg_handle_get_pixbuf_sub (RsvgHandle *handle, const char *id);

/**
 * rsvg_handle_get_base_uri: (attributes org.gtk.Method.get_property=base-uri)
 * @handle: A [class@Rsvg.Handle]
 *
 * Gets the base uri for this [class@Rsvg.Handle].
 *
 * Returns: the base uri, possibly null
 * Since: 2.8
 */
RSVG_API
const char *rsvg_handle_get_base_uri (RsvgHandle *handle);

/**
 * rsvg_handle_set_base_uri: (attributes org.gtk.Method.set_property=base-uri)
 * @handle: A [class@Rsvg.Handle]
 * @base_uri: The base uri
 *
 * Set the base URI for this SVG.
 *
 * Note: This function may only be called before [method@Rsvg.Handle.write] or
 * [method@Rsvg.Handle.read_stream_sync] have been called.
 *
 * Since: 2.9
 */
RSVG_API
void rsvg_handle_set_base_uri (RsvgHandle *handle, const char *base_uri);

/**
 * rsvg_handle_get_dimensions:
 * @handle: A [class@Rsvg.Handle]
 * @dimension_data: (out): A place to store the SVG's size
 *
 * Get the SVG's size. Do not call from within the size_func callback, because
 * an infinite loop will occur.
 *
 * This function depends on the [class@Rsvg.Handle]'s DPI to compute dimensions in
 * pixels, so you should call [method@Rsvg.Handle.set_dpi] beforehand.
 *
 * Deprecated: 2.52.  Use [method@Rsvg.Handle.get_intrinsic_size_in_pixels] instead.  This
 * function is deprecated because it is not able to return exact fractional dimensions,
 * only integer pixels.
 *
 * Since: 2.14
 */
RSVG_DEPRECATED_FOR(rsvg_handle_get_intrinsic_size_in_pixels)
void rsvg_handle_get_dimensions (RsvgHandle *handle, RsvgDimensionData *dimension_data);

/**
 * rsvg_handle_get_dimensions_sub:
 * @handle: A [class@Rsvg.Handle]
 * @dimension_data: (out): A place to store the SVG's size
 * @id: (nullable): An element's id within the SVG, starting with "#" (a single
 * hash character), for example, `#layer1`.  This notation corresponds to a
 * URL's fragment ID.  Alternatively, pass `NULL` to use the whole SVG.
 *
 * Get the size of a subelement of the SVG file. Do not call from within the
 * size_func callback, because an infinite loop will occur.
 *
 * This function depends on the [class@Rsvg.Handle]'s DPI to compute dimensions in
 * pixels, so you should call [method@Rsvg.Handle.set_dpi] beforehand.
 *
 * Element IDs should look like an URL fragment identifier; for example, pass
 * `#foo` (hash `foo`) to get the geometry of the element that
 * has an `id="foo"` attribute.
 *
 * Returns: `TRUE` if the dimensions could be obtained, `FALSE` if there was an error.
 *
 * Deprecated: 2.46.  Use [method@Rsvg.Handle.get_geometry_for_layer] instead.
 *
 * Since: 2.22
 */
RSVG_DEPRECATED_FOR(rsvg_handle_get_geometry_for_layer)
gboolean rsvg_handle_get_dimensions_sub (RsvgHandle        *handle,
                                         RsvgDimensionData *dimension_data,
                                         const char        *id);

/**
 * rsvg_handle_get_position_sub:
 * @handle: A [class@Rsvg.Handle]
 * @position_data: (out): A place to store the SVG fragment's position.
 * @id: (nullable): An element's id within the SVG, starting with "#" (a single
 * hash character), for example, `#layer1`.  This notation corresponds to a
 * URL's fragment ID.  Alternatively, pass %NULL to use the whole SVG.
 *
 * Get the position of a subelement of the SVG file. Do not call from within
 * the size_func callback, because an infinite loop will occur.
 *
 * This function depends on the [class@Rsvg.Handle]'s DPI to compute dimensions in
 * pixels, so you should call [method@Rsvg.Handle.set_dpi] beforehand.
 *
 * Element IDs should look like an URL fragment identifier; for example, pass
 * `#foo` (hash `foo`) to get the geometry of the element that
 * has an `id="foo"` attribute.
 *
 * Returns: `TRUE` if the position could be obtained, `FALSE` if there was an error.
 *
 * Deprecated: 2.46.  Use [method@Rsvg.Handle.get_geometry_for_layer] instead.  This function is
 * deprecated since it is not able to return exact floating-point positions, only integer
 * pixels.
 *
 * Since: 2.22
 */
RSVG_DEPRECATED_FOR(rsvg_handle_get_geometry_for_layer)
gboolean rsvg_handle_get_position_sub (RsvgHandle       *handle,
                                       RsvgPositionData *position_data,
                                       const char       *id);

/**
 * rsvg_handle_has_sub:
 * @handle: a [class@Rsvg.Handle]
 * @id: An element's id within the SVG, starting with "#" (a single hash
 * character), for example, `#layer1`.  This notation corresponds to a URL's
 * fragment ID.
 *
 * Checks whether the element @id exists in the SVG document.
 *
 * Element IDs should look like an URL fragment identifier; for example, pass
 * `#foo` (hash `foo`) to get the geometry of the element that
 * has an `id="foo"` attribute.
 *
 * Returns: `TRUE` if @id exists in the SVG document, `FALSE` otherwise.
 *
 * Since: 2.22
 */
RSVG_API
gboolean rsvg_handle_has_sub (RsvgHandle *handle, const char *id);

/**
 * RsvgUnit:
 * @RSVG_UNIT_PERCENT: percentage values; where <literal>1.0</literal> means 100%.
 * @RSVG_UNIT_PX: pixels
 * @RSVG_UNIT_EM: em, or the current font size
 * @RSVG_UNIT_EX: x-height of the current font
 * @RSVG_UNIT_IN: inches
 * @RSVG_UNIT_CM: centimeters
 * @RSVG_UNIT_MM: millimeters
 * @RSVG_UNIT_PT: points, or 1/72 inch
 * @RSVG_UNIT_PC: picas, or 1/6 inch (12 points)
 *
 * Units for the `RsvgLength` struct.  These have the same meaning as [CSS length
 * units](https://www.w3.org/TR/CSS21/syndata.html#length-units).
 */
typedef enum {
    RSVG_UNIT_PERCENT,
    RSVG_UNIT_PX,
    RSVG_UNIT_EM,
    RSVG_UNIT_EX,
    RSVG_UNIT_IN,
    RSVG_UNIT_CM,
    RSVG_UNIT_MM,
    RSVG_UNIT_PT,
    RSVG_UNIT_PC
} RsvgUnit;

/**
 * RsvgLength:
 * @length: numeric part of the length
 * @unit: unit part of the length
 *
 * `RsvgLength` values are used in [method@Rsvg.Handle.get_intrinsic_dimensions], for
 * example, to return the CSS length values of the `width` and
 * `height` attributes of an `<svg>` element.
 *
 * This is equivalent to [CSS lengths](https://www.w3.org/TR/CSS21/syndata.html#length-units).
 *
 * It is up to the calling application to convert lengths in non-pixel units
 * (i.e. those where the @unit field is not `RSVG_UNIT_PX`) into something
 * meaningful to the application.  For example, if your application knows the
 * dots-per-inch (DPI) it is using, it can convert lengths with @unit in
 * `RSVG_UNIT_IN` or other physical units.
 */
typedef struct {
    double   length;
    RsvgUnit unit;
} RsvgLength;

/**
 * rsvg_handle_get_intrinsic_dimensions:
 * @handle: An [class@Rsvg.Handle]
 * @out_has_width: (out)(optional): Will be set to `TRUE`; see below.
 * @out_width: (out)(optional): Will be set to the computed value of the `width` property in the toplevel SVG.
 * @out_has_height: (out)(optional): Will be set to `TRUE`; see below.
 * @out_height: (out)(optional): Will be set to the computed value of the `height` property in the toplevel SVG.
 * @out_has_viewbox: (out)(optional): Will be set to `TRUE` if the toplevel SVG has a `viewBox` attribute
 * @out_viewbox: (out)(optional): Will be set to the value of the `viewBox` attribute in the toplevel SVG
 *
 * In simple terms, queries the `width`, `height`, and `viewBox` attributes in an SVG document.
 *
 * If you are calling this function to compute a scaling factor to render the SVG,
 * consider simply using [method@Rsvg.Handle.render_document] instead; it will do the
 * scaling computations automatically.
 *
 * Before librsvg 2.54.0, the `out_has_width` and `out_has_height` arguments would be set to true or false
 * depending on whether the SVG document actually had `width` and `height` attributes, respectively.
 *
 * However, since librsvg 2.54.0, `width` and `height` are now [geometry
 * properties](https://www.w3.org/TR/SVG2/geometry.html) per the SVG2 specification; they
 * are not plain attributes.  SVG2 made it so that the initial value of those properties
 * is `auto`, which is equivalent to specifing a value of `100%`.  In this sense, even SVG
 * documents which lack `width` or `height` attributes semantically have to make them
 * default to `100%`.  This is why since librsvg 2.54.0, `out_has_width` and
 * `out_has_heigth` are always returned as `TRUE`, since with SVG2 all documents *have* a
 * default width and height of `100%`.
 *
 * As an example, the following SVG element has a `width` of 100 pixels and a `height` of 400 pixels, but no `viewBox`.  This
 * function will return those sizes in `out_width` and `out_height`, and set `out_has_viewbox` to `FALSE`.
 *
 * ```
 * <svg xmlns="http://www.w3.org/2000/svg" width="100" height="400">
 * ```
 *
 * Conversely, the following element has a `viewBox`, but no `width` or `height`.  This function will
 * set `out_has_viewbox` to `TRUE`, and it will also set `out_has_width` and `out_has_height` to `TRUE` but
 * return both length values as `100%`.
 *
 * ```
 * <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 400">
 * ```
 *
 * Note that the `RsvgLength` return values have `RsvgUnits` in them; you should
 * not assume that they are always in pixels.  For example, the following SVG element
 * will return width and height values whose `units` fields are `RSVG_UNIT_MM`.
 *
 * ```
 * <svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm">
 * ```
 *
 * API ordering: This function must be called on a fully-loaded @handle.  See
 * the section "[API ordering](class.Handle.html#api-ordering)" for details.
 *
 * Panics: this function will panic if the @handle is not fully-loaded.
 *
 * Since: 2.46
 */
RSVG_API
void rsvg_handle_get_intrinsic_dimensions (RsvgHandle *handle,
                                           gboolean   *out_has_width,
                                           RsvgLength *out_width,
                                           gboolean   *out_has_height,
                                           RsvgLength *out_height,
                                           gboolean   *out_has_viewbox,
                                           RsvgRectangle *out_viewbox);

/**
 * rsvg_handle_get_intrinsic_size_in_pixels:
 * @handle: An [class@Rsvg.Handle]
 * @out_width: (out)(optional): Will be set to the computed width; you should round this up to get integer pixels.
 * @out_height: (out)(optional): Will be set to the computed height; you should round this up to get integer pixels.
 *
 * Converts an SVG document's intrinsic dimensions to pixels, and returns the result.
 *
 * This function is able to extract the size in pixels from an SVG document if the
 * document has both `width` and `height` attributes
 * with physical units (px, in, cm, mm, pt, pc) or font-based units (em, ex).  For
 * physical units, the dimensions are normalized to pixels using the dots-per-inch (DPI)
 * value set previously with [method@Rsvg.Handle.set_dpi].  For font-based units, this function
 * uses the computed value of the `font-size` property for the toplevel
 * `<svg>` element.  In those cases, this function returns `TRUE`.
 *
 * This function is not able to extract the size in pixels directly from the intrinsic
 * dimensions of the SVG document if the `width` or
 * `height` are in percentage units (or if they do not exist, in which
 * case the SVG spec mandates that they default to 100%), as these require a
 * <firstterm>viewport</firstterm> to be resolved to a final size.  In this case, the
 * function returns `FALSE`.
 *
 * For example, the following document fragment has intrinsic dimensions that will resolve
 * to 20x30 pixels.
 *
 * ```
 * <svg xmlns="http://www.w3.org/2000/svg" width="20" height="30"/>
 * ```
 *
 * Similarly, if the DPI is set to 96, this document will resolve to 192×288 pixels (i.e. 96×2 × 96×3).
 *
 * ```
 * <svg xmlns="http://www.w3.org/2000/svg" width="2in" height="3in"/>
 * ```
 *
 * The dimensions of the following documents cannot be resolved to pixels directly, and
 * this function would return `FALSE` for them:
 *
 * ```
 * <!-- Needs a viewport against which to compute the percentages. -->
 * <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"/>
 *
 * <!-- Does not have intrinsic width/height, just a 1:2 aspect ratio which
 *      needs to be fitted within a viewport. -->
 * <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200"/>
 * ```
 *
 * Instead of querying an SVG document's size, applications are encouraged to render SVG
 * documents to a size chosen by the application, by passing a suitably-sized viewport to
 * [method@Rsvg.Handle.render_document].
 *
 * Returns: `TRUE` if the dimensions could be converted directly to pixels; in this case
 * @out_width and @out_height will be set accordingly.  Note that the dimensions are
 * floating-point numbers, so your application can know the exact size of an SVG document.
 * To get integer dimensions, you should use `ceil()` to round up to the nearest integer
 * (just using `round()`, may may chop off pixels with fractional coverage).  If the
 * dimensions cannot be converted to pixels, returns `FALSE` and puts 0.0 in both
 * @out_width and @out_height.
 *
 * Since: 2.52
 */
RSVG_API
gboolean rsvg_handle_get_intrinsic_size_in_pixels (RsvgHandle *handle,
                                                   gdouble    *out_width,
                                                   gdouble    *out_height);

/* GIO APIs */

/**
 * RsvgHandleFlags:
 * @RSVG_HANDLE_FLAGS_NONE: No flags are set.
 * @RSVG_HANDLE_FLAG_UNLIMITED: Disable safety limits in the XML parser.  Libxml2 has
 * [several limits](https://gitlab.gnome.org/GNOME/libxml2/blob/master/include/libxml/parserInternals.h)
 * designed to keep malicious XML content from consuming too much memory while parsing.
 * For security reasons, this should only be used for trusted input!  Since: 2.40.3
 * @RSVG_HANDLE_FLAG_KEEP_IMAGE_DATA: Use this if the Cairo surface to which you are
 * rendering is a PDF, PostScript, SVG, or Win32 Printing surface.  This will make librsvg
 * and Cairo use the original, compressed data for images in the final output, instead of
 * passing uncompressed images.  For example, this will make the a resulting PDF file
 * smaller and faster.  Please see [the Cairo
 * documentation](https://www.cairographics.org/manual/cairo-cairo-surface-t.html#cairo-surface-set-mime-data)
 * for details.
 *
 * Configuration flags for an [class@Rsvg.Handle].  Note that not all of [class@Rsvg.Handle]'s
 * constructors let you specify flags.  For this reason, [ctor@Rsvg.Handle.new_from_gfile_sync]
 * and [ctor@Rsvg.Handle.new_from_stream_sync] are the preferred ways to create a handle.
 *
 * Since: 2.40.3
 */
typedef enum /*< flags >*/
{
    RSVG_HANDLE_FLAGS_NONE           = 0,
    RSVG_HANDLE_FLAG_UNLIMITED       = 1 << 0,
    RSVG_HANDLE_FLAG_KEEP_IMAGE_DATA = 1 << 1
} RsvgHandleFlags;

RSVG_API
GType rsvg_handle_flags_get_type (void);
#define RSVG_TYPE_HANDLE_FLAGS (rsvg_handle_flags_get_type())

/**
 * rsvg_handle_new_with_flags:
 * @flags: flags from [flags@Rsvg.HandleFlags]
 *
 * Creates a new [class@Rsvg.Handle] with flags @flags.  After calling this function,
 * you can feed the resulting handle with SVG data by using
 * [method@Rsvg.Handle.read_stream_sync].
 *
 * Returns: (transfer full): a new [class@Rsvg.Handle]
 *
 * Since: 2.36
 **/
RSVG_API
RsvgHandle *rsvg_handle_new_with_flags (RsvgHandleFlags flags);

/**
 * rsvg_handle_set_base_gfile:
 * @handle: a [class@Rsvg.Handle]
 * @base_file: a `GFile`
 *
 * Set the base URI for @handle from @file.
 *
 * Note: This function may only be called before [method@Rsvg.Handle.write] or
 * [method@Rsvg.Handle.read_stream_sync] have been called.
 *
 * Since: 2.32
 */
RSVG_API
void rsvg_handle_set_base_gfile (RsvgHandle *handle,
                                 GFile      *base_file);

/**
 * rsvg_handle_read_stream_sync:
 * @handle: a [class@Rsvg.Handle]
 * @stream: a `GInputStream`
 * @cancellable: (nullable): a `GCancellable`, or `NULL`
 * @error: return location for a `GError`
 *
 * Reads @stream and writes the data from it to @handle.
 *
 * Before calling this function, you may need to call [method@Rsvg.Handle.set_base_uri]
 * or [method@Rsvg.Handle.set_base_gfile] to set the "base file" for resolving
 * references to external resources.  SVG elements like
 * `<image>` which reference external resources will be
 * resolved relative to the location you specify with those functions.
 *
 * If @cancellable is not `NULL`, then the operation can be cancelled by
 * triggering the cancellable object from another thread. If the
 * operation was cancelled, the error `G_IO_ERROR_CANCELLED` will be
 * returned.
 *
 * Returns: `TRUE` if reading @stream succeeded, or `FALSE` otherwise
 *   with @error filled in
 *
 * Since: 2.32
 */
RSVG_API
gboolean rsvg_handle_read_stream_sync (RsvgHandle   *handle,
                                       GInputStream *stream,
                                       GCancellable *cancellable,
                                       GError      **error);

/**
 * rsvg_handle_new_from_gfile_sync:
 * @file: a `GFile`
 * @flags: flags from [flags@Rsvg.HandleFlags]
 * @cancellable: (nullable): a `GCancellable`, or `NULL`
 * @error: return location for a `GError`
 *
 * Creates a new [class@Rsvg.Handle] for @file.
 *
 * This function sets the "base file" of the handle to be @file itself, so SVG
 * elements like `<image>` which reference external
 * resources will be resolved relative to the location of @file.
 *
 * If @cancellable is not `NULL`, then the operation can be cancelled by
 * triggering the cancellable object from another thread. If the
 * operation was cancelled, the error `G_IO_ERROR_CANCELLED` will be
 * returned in @error.
 *
 * Returns: (transfer full) (nullable): a new [class@Rsvg.Handle] on success, or `NULL` with @error filled in
 *
 * Since: 2.32
 */
RSVG_API
RsvgHandle *rsvg_handle_new_from_gfile_sync (GFile          *file,
                                             RsvgHandleFlags flags,
                                             GCancellable   *cancellable,
                                             GError        **error);

/**
 * rsvg_handle_new_from_stream_sync:
 * @input_stream: a `GInputStream`
 * @base_file: (nullable): a `GFile`, or `NULL`
 * @flags: flags from [flags@Rsvg.HandleFlags]
 * @cancellable: (nullable): a `GCancellable`, or `NULL`
 * @error: return location for a `GError`
 *
 * Creates a new [class@Rsvg.Handle] for @stream.
 *
 * This function sets the "base file" of the handle to be @base_file if
 * provided.  SVG elements like `<image>` which reference
 * external resources will be resolved relative to the location of @base_file.
 *
 * If @cancellable is not `NULL`, then the operation can be cancelled by
 * triggering the cancellable object from another thread. If the
 * operation was cancelled, the error `G_IO_ERROR_CANCELLED` will be
 * returned in @error.
 *
 * Returns: (transfer full) (nullable): a new [class@Rsvg.Handle] on success, or `NULL` with @error filled in
 *
 * Since: 2.32
 */
RSVG_API
RsvgHandle *rsvg_handle_new_from_stream_sync (GInputStream   *input_stream,
                                              GFile          *base_file,
                                              RsvgHandleFlags flags,
                                              GCancellable   *cancellable,
                                              GError        **error);

/**
 * rsvg_handle_new_from_data:
 * @data: (array length=data_len): The SVG data
 * @data_len: The length of @data, in bytes
 * @error: return location for a `GError`
 *
 * Loads the SVG specified by @data.  Note that this function creates an
 * [class@Rsvg.Handle] without a base URL, and without any [flags@Rsvg.HandleFlags].  If you
 * need these, use [ctor@Rsvg.Handle.new_from_stream_sync] instead by creating
 * a [class@Gio.MemoryInputStream] from your data.
 *
 * Returns: (transfer full) (nullable): A [class@Rsvg.Handle] or `NULL` if an error occurs.
 * Since: 2.14
 */
RSVG_API
RsvgHandle *rsvg_handle_new_from_data (const guint8 *data, gsize data_len, GError **error);

/**
 * rsvg_handle_new_from_file:
 * @filename: The file name to load, or a URI.
 * @error: return location for a `GError`
 *
 * Loads the SVG specified by @file_name.  Note that this function, like
 * [ctor@Rsvg.Handle.new], does not specify any loading flags for the resulting
 * handle.  If you require the use of [flags@Rsvg.HandleFlags], use
 * [ctor@Rsvg.Handle.new_from_gfile_sync].
 *
 * Returns: (transfer full) (nullable): A [class@Rsvg.Handle] or `NULL` if an error occurs.
 * Since: 2.14
 */
RSVG_API
RsvgHandle *rsvg_handle_new_from_file (const gchar *filename, GError **error);

/**
 * rsvg_handle_set_stylesheet:
 * @handle: A [class@Rsvg.Handle].
 * @css: (array length=css_len): String with CSS data; must be valid UTF-8.
 * @css_len: Length of the @css data in bytes.
 * @error: return location for a `GError`
 *
 * Sets a CSS stylesheet to use for an SVG document.
 *
 * The @css_len argument is mandatory; this function will not compute the length
 * of the @css string.  This is because a provided stylesheet, which the calling
 * program could read from a file, can have nul characters in it.
 *
 * During the CSS cascade, the specified stylesheet will be used with a "User"
 * [origin](https://drafts.csswg.org/css-cascade-3/#cascading-origins).
 *
 * Note that `@import` rules will not be resolved, except for `data:` URLs.
 *
 * Returns: `TRUE` on success, `FALSE` on error.  Errors are returned
 * in the @error argument.
 *
 * Since: 2.48
 */
RSVG_API
gboolean rsvg_handle_set_stylesheet (RsvgHandle   *handle,
                                     const guint8 *css,
                                     gsize         css_len,
                                     GError      **error);

#ifndef __GTK_DOC_IGNORE__
/**
 * rsvg_handle_internal_set_testing:
 * @handle: a [class@Rsvg.Handle]
 * @testing: Whether to enable testing mode
 *
 * Do not call this function.  This is intended for librsvg's internal
 * test suite only.
 **/
RSVG_API
void rsvg_handle_internal_set_testing (RsvgHandle *handle, gboolean testing);
#endif /* __GTK_DOC_IGNORE__ */

/* BEGIN deprecated APIs. Do not use! */

/**
 * rsvg_init:
 *
 * This function does nothing.
 *
 * Since: 2.9
 * Deprecated: 2.36: There is no need to initialize librsvg.
 **/
RSVG_DEPRECATED_FOR(g_type_init)
void rsvg_init (void);

/**
 * rsvg_term:
 *
 * This function does nothing.
 *
 * Since: 2.9
 * Deprecated: 2.36: There is no need to de-initialize librsvg.
 **/
RSVG_DEPRECATED
void rsvg_term (void);

/**
 * rsvg_handle_free:
 * @handle: An [class@Rsvg.Handle]
 *
 * Frees @handle.
 * Deprecated: Use [method@GObject.Object.unref] instead.
 **/
RSVG_DEPRECATED_FOR(g_object_unref)
void rsvg_handle_free (RsvgHandle *handle);

/**
 * RsvgSizeFunc:
 * @width: (out): the width of the SVG
 * @height: (out): the height of the SVG
 * @user_data: user data
 *
 * Function to let a user of the library specify the SVG's dimensions
 *
 * See the documentation for [method@Rsvg.Handle.set_size_callback] for an example, and
 * for the reasons for deprecation.
 *
 * Deprecated: 2.14.  Use [method@Rsvg.Handle.render_document] instead, which lets you specify
 * a viewport size in which to render the SVG document.
 */
typedef void (*RsvgSizeFunc) (gint * width, gint * height, gpointer user_data);

/**
 * rsvg_handle_set_size_callback:
 * @handle: An [class@Rsvg.Handle]
 * @size_func: (nullable): A sizing function, or `NULL`
 * @user_data: User data to pass to @size_func, or `NULL`
 * @user_data_destroy: Function to be called to destroy the data passed in @user_data,
 *   or `NULL`.
 *
 * Sets the sizing function for the @handle, which can be used to override the
 * size that librsvg computes for SVG images.  The @size_func is called from the
 * following functions:
 *
 * * [method@Rsvg.Handle.get_dimensions]
 * * [method@Rsvg.Handle.get_dimensions_sub]
 * * [method@Rsvg.Handle.get_position_sub]
 * * [method@Rsvg.Handle.render_cairo]
 * * [method@Rsvg.Handle.render_cairo_sub]
 *
 * Librsvg computes the size of the SVG being rendered, and passes it to the
 * @size_func, which may then modify these values to set the final size of the
 * generated image.
 *
 * Deprecated: 2.14.  Use [method@Rsvg.Handle.render_document] instead.
 * This function was deprecated because when the @size_func is used, it makes it
 * unclear when the librsvg functions which call the @size_func will use the
 * size computed originally, or the callback-specified size, or whether it
 * refers to the whole SVG or to just a sub-element of it.  It is easier, and
 * unambiguous, to use code similar to the example above.
 **/
RSVG_DEPRECATED
void rsvg_handle_set_size_callback (RsvgHandle    *handle,
                                    RsvgSizeFunc   size_func,
                                    gpointer       user_data,
                                    GDestroyNotify user_data_destroy);

/* GdkPixbuf convenience API */

/**
 * rsvg-pixbuf:
 *
 * Years ago, GNOME and GTK used the gdk-pixbuf library as a general mechanism to load
 * raster images into memory (PNG, JPEG, etc.) and pass them around.  The general idiom
 * was, "load this image file and give me a `GdkPixbuf` object", which is basically a pixel
 * buffer.  Librsvg supports this kind of interface to load and render SVG documents, but
 * it is deprecated in favor of rendering to Cairo contexts.
 */

/**
 * rsvg_pixbuf_from_file:
 * @filename: A file name
 * @error: return location for a `GError`
 * 
 * Loads a new `GdkPixbuf` from @filename and returns it.  The caller must
 * assume the reference to the reurned pixbuf. If an error occurred, @error is
 * set and `NULL` is returned.
 * 
 * Returns: (transfer full) (nullable): A pixbuf, or %NULL on error.
 * Deprecated: Use [ctor@Rsvg.Handle.new_from_file] and [method@Rsvg.Handle.render_document] instead.
 **/
RSVG_DEPRECATED
GdkPixbuf *rsvg_pixbuf_from_file (const gchar *filename,
                                  GError     **error);

/**
 * rsvg_pixbuf_from_file_at_zoom:
 * @filename: A file name
 * @x_zoom: The horizontal zoom factor
 * @y_zoom: The vertical zoom factor
 * @error: return location for a `GError`
 * 
 * Loads a new `GdkPixbuf` from @filename and returns it.  This pixbuf is scaled
 * from the size indicated by the file by a factor of @x_zoom and @y_zoom.  The
 * caller must assume the reference to the returned pixbuf. If an error
 * occurred, @error is set and `NULL` is returned.
 * 
 * Returns: (transfer full) (nullable): A pixbuf, or %NULL on error.
 * Deprecated: Use [ctor@Rsvg.Handle.new_from_file] and [method@Rsvg.Handle.render_document] instead.
 **/
RSVG_DEPRECATED
GdkPixbuf *rsvg_pixbuf_from_file_at_zoom (const gchar *filename,
                                          double       x_zoom,
                                          double       y_zoom,
                                          GError     **error);

/**
 * rsvg_pixbuf_from_file_at_size:
 * @filename: A file name
 * @width: The new width, or -1
 * @height: The new height, or -1
 * @error: return location for a `GError`
 * 
 * Loads a new `GdkPixbuf` from @filename and returns it.  This pixbuf is scaled
 * from the size indicated to the new size indicated by @width and @height.  If
 * both of these are -1, then the default size of the image being loaded is
 * used.  The caller must assume the reference to the returned pixbuf. If an
 * error occurred, @error is set and `NULL` is returned.
 * 
 * Returns: (transfer full) (nullable): A pixbuf, or %NULL on error.
 * Deprecated: Use [ctor@Rsvg.Handle.new_from_file] and [method@Rsvg.Handle.render_document] instead.
 **/
RSVG_DEPRECATED
GdkPixbuf *rsvg_pixbuf_from_file_at_size (const gchar *filename,
                                          gint         width,
                                          gint         height,
                                          GError     **error);

/**
 * rsvg_pixbuf_from_file_at_max_size:
 * @filename: A file name
 * @max_width: The requested max width
 * @max_height: The requested max height
 * @error: return location for a `GError`
 * 
 * Loads a new `GdkPixbuf` from @filename and returns it.  This pixbuf is uniformly
 * scaled so that the it fits into a rectangle of size `max_width * max_height`. The
 * caller must assume the reference to the returned pixbuf. If an error occurred,
 * @error is set and `NULL` is returned.
 * 
 * Returns: (transfer full) (nullable): A pixbuf, or %NULL on error.
 * Deprecated: Use [ctor@Rsvg.Handle.new_from_file] and [method@Rsvg.Handle.render_document] instead.
 **/
RSVG_DEPRECATED
GdkPixbuf *rsvg_pixbuf_from_file_at_max_size (const gchar *filename,
                                              gint         max_width,
                                              gint         max_height,
                                              GError     **error);
/**
 * rsvg_pixbuf_from_file_at_zoom_with_max:
 * @filename: A file name
 * @x_zoom: The horizontal zoom factor
 * @y_zoom: The vertical zoom factor
 * @max_width: The requested max width
 * @max_height: The requested max height
 * @error: return location for a `GError`
 * 
 * Loads a new `GdkPixbuf` from @filename and returns it.  This pixbuf is scaled
 * from the size indicated by the file by a factor of @x_zoom and @y_zoom. If the
 * resulting pixbuf would be larger than max_width/max_heigh it is uniformly scaled
 * down to fit in that rectangle. The caller must assume the reference to the
 * returned pixbuf. If an error occurred, @error is set and `NULL` is returned.
 * 
 * Returns: (transfer full) (nullable): A pixbuf, or %NULL on error.
 * Deprecated: Use [ctor@Rsvg.Handle.new_from_file] and [method@Rsvg.Handle.render_document] instead.
 **/
RSVG_DEPRECATED
GdkPixbuf *rsvg_pixbuf_from_file_at_zoom_with_max (const gchar *filename,
                                                   double       x_zoom,
                                                   double       y_zoom,
                                                   gint         max_width,
                                                   gint         max_height,
                                                   GError     **error);

/**
 * rsvg_handle_get_title:
 * @handle: An [class@Rsvg.Handle]
 *
 * Returns: (nullable): This function always returns `NULL`.
 *
 * Since: 2.4
 *
 * Deprecated: 2.36.  Librsvg does not read the metadata/desc/title elements;
 * this function always returns `NULL`.
 */
RSVG_DEPRECATED
const char *rsvg_handle_get_title (RsvgHandle *handle);

/**
 * rsvg_handle_get_desc:
 * @handle: An [class@Rsvg.Handle]
 *
 * Returns: (nullable): This function always returns `NULL`.
 *
 * Since: 2.4
 *
 * Deprecated: 2.36.  Librsvg does not read the metadata/desc/title elements;
 * this function always returns `NULL`.
 */
RSVG_DEPRECATED
const char *rsvg_handle_get_desc (RsvgHandle *handle);

/**
 * rsvg_handle_get_metadata:
 * @handle: An [class@Rsvg.Handle]
 *
 * Returns: (nullable): This function always returns `NULL`.
 *
 * Since: 2.9
 *
 * Deprecated: 2.36.  Librsvg does not read the metadata/desc/title elements;
 * this function always returns `NULL`.
 */
RSVG_DEPRECATED
const char *rsvg_handle_get_metadata (RsvgHandle *handle);

/* END deprecated APIs. */

G_END_DECLS

#include <librsvg/rsvg-features.h>
#include <librsvg/rsvg-version.h>
#include <librsvg/rsvg-cairo.h>

#undef __RSVG_RSVG_H_INSIDE__

#endif                          /* RSVG_H */
