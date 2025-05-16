/* -*- Mode: C; indent-tabs-mode: nil; c-basic-offset: 4 -*- */
/* vim: set sw=4 sts=4 expandtab: */
/* 
   rsvg-cairo.h: SAX-based renderer for SVG files using cairo
 
   Copyright (C) 2005 Red Hat, Inc.
  
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
  
   Author: Carl Worth <cworth@cworth.org>
*/

#if !defined (__RSVG_RSVG_H_INSIDE__) && !defined (RSVG_COMPILATION)
#warning "Including <librsvg/rsvg-cairo.h> directly is deprecated."
#endif

#ifndef RSVG_CAIRO_H
#define RSVG_CAIRO_H

#include <cairo.h>

G_BEGIN_DECLS 

/**
 * rsvg_handle_render_cairo:
 * @handle: A [class@Rsvg.Handle]
 * @cr: A Cairo context
 *
 * Draws a loaded SVG handle to a Cairo context.  Please try to use
 * [method@Rsvg.Handle.render_document] instead, which allows you to pick the size
 * at which the document will be rendered.
 *
 * Historically this function has picked a size by itself, based on the following rules:
 *
 * * If the SVG document has both `width` and `height`
 *   attributes with physical units (px, in, cm, mm, pt, pc) or font-based units (em,
 *   ex), the function computes the size directly based on the dots-per-inch (DPI) you
 *   have configured with [method@Rsvg.Handle.set_dpi].  This is the same approach as
 *   [method@Rsvg.Handle.get_intrinsic_size_in_pixels].
 *
 * * Otherwise, if there is a `viewBox` attribute and both
 *   `width` and `height` are set to
 *   `100%` (or if they don't exist at all and thus default to 100%),
 *   the function uses the width and height of the `viewBox` as a pixel size.  This
 *   produces a rendered document with the correct aspect ratio.
 *
 * * Otherwise, this function computes the extents of every graphical object in the SVG
 *   document to find the total extents.  This is moderately expensive, but no more expensive
 *   than rendering the whole document, for example.
 *
 * * This function cannot deal with percentage-based units for `width`
 *   and `height` because there is no viewport against which they could
 *   be resolved; that is why it will compute the extents of objects in that case.  This
 *   is why we recommend that you use [method@Rsvg.Handle.render_document] instead, which takes
 *   in a viewport and follows the sizing policy from the web platform.
 *
 * Drawing will occur with respect to the @cr's current transformation: for example, if
 * the @cr has a rotated current transformation matrix, the whole SVG will be rotated in
 * the rendered version.
 *
 * This function depends on the [class@Rsvg.Handle]'s DPI to compute dimensions in
 * pixels, so you should call [method@Rsvg.Handle.set_dpi] beforehand.
 *
 * Note that @cr must be a Cairo context that is not in an error state, that is,
 * `cairo_status()` must return `CAIRO_STATUS_SUCCESS` for it.  Cairo can set a
 * context to be in an error state in various situations, for example, if it was
 * passed an invalid matrix or if it was created for an invalid surface.
 *
 * Returns: `TRUE` if drawing succeeded; `FALSE` otherwise.  This function will emit a g_warning()
 * if a rendering error occurs.
 *
 * Since: 2.14
 *
 * Deprecated: 2.52.  Please use [method@Rsvg.Handle.render_document] instead; that function lets
 * you pass a viewport and obtain a good error message.
 */
RSVG_DEPRECATED_FOR(rsvg_handle_render_document)
gboolean rsvg_handle_render_cairo (RsvgHandle *handle, cairo_t *cr);

/**
 * rsvg_handle_render_cairo_sub:
 * @handle: A [class@Rsvg.Handle]
 * @cr: A Cairo context
 * @id: (nullable): An element's id within the SVG, starting with "#" (a single
 * hash character), for example, `#layer1`.  This notation corresponds to a
 * URL's fragment ID.  Alternatively, pass `NULL` to render the whole SVG.
 *
 * Renders a single SVG element in the same place as for a whole SVG document (a "subset"
 * of the document).  Please try to use [method@Rsvg.Handle.render_layer] instead, which allows
 * you to pick the size at which the document with the layer will be rendered.
 *
 * This is equivalent to [method@Rsvg.Handle.render_cairo], but it renders only a single
 * element and its children, as if they composed an individual layer in the SVG.
 *
 * Historically this function has picked a size for the whole document by itself, based
 * on the following rules:
 *
 * * If the SVG document has both `width` and `height`
 *   attributes with physical units (px, in, cm, mm, pt, pc) or font-based units (em,
 *   ex), the function computes the size directly based on the dots-per-inch (DPI) you
 *   have configured with [method@Rsvg.Handle.set_dpi].  This is the same approach as
 *   [method@Rsvg.Handle.get_intrinsic_size_in_pixels].
 *
 * * Otherwise, if there is a `viewBox` attribute and both
 *   `width` and `height` are set to
 *   `100%` (or if they don't exist at all and thus default to 100%),
 *   the function uses the width and height of the `viewBox` as a pixel size.  This
 *   produces a rendered document with the correct aspect ratio.
 *
 * * Otherwise, this function computes the extents of every graphical object in the SVG
 *   document to find the total extents.  This is moderately expensive, but no more expensive
 *   than rendering the whole document, for example.
 *
 * * This function cannot deal with percentage-based units for `width`
 *   and `height` because there is no viewport against which they could
 *   be resolved; that is why it will compute the extents of objects in that case.  This
 *   is why we recommend that you use [method@Rsvg.Handle.render_layer] instead, which takes
 *   in a viewport and follows the sizing policy from the web platform.
 *
 * Drawing will occur with respect to the @cr's current transformation: for example, if
 * the @cr has a rotated current transformation matrix, the whole SVG will be rotated in
 * the rendered version.
 *
 * This function depends on the [class@Rsvg.Handle]'s DPI to compute dimensions in
 * pixels, so you should call [method@Rsvg.Handle.set_dpi] beforehand.
 *
 * Note that @cr must be a Cairo context that is not in an error state, that is,
 * `cairo_status()` must return `CAIRO_STATUS_SUCCESS` for it.  Cairo can set a
 * context to be in an error state in various situations, for example, if it was
 * passed an invalid matrix or if it was created for an invalid surface.
 *
 * Element IDs should look like an URL fragment identifier; for example, pass
 * `#foo` (hash `foo`) to get the geometry of the element that
 * has an `id="foo"` attribute.
 *
 * Returns: `TRUE` if drawing succeeded; `FALSE` otherwise.  This function will emit a g_warning()
 * if a rendering error occurs.
 *
 * Since: 2.14
 *
 * Deprecated: 2.52.  Please use [method@Rsvg.Handle.render_layer] instead; that function lets
 * you pass a viewport and obtain a good error message.
 */
RSVG_DEPRECATED_FOR(rsvg_handle_render_layer)
gboolean rsvg_handle_render_cairo_sub (RsvgHandle *handle, cairo_t *cr, const char *id);

/**
 * rsvg_handle_render_document:
 * @handle: An [class@Rsvg.Handle]
 * @cr: A Cairo context
 * @viewport: Viewport size at which the whole SVG would be fitted.
 * @error: return location for a `GError`
 *
 * Renders the whole SVG document fitted to a viewport.
 *
 * The @viewport gives the position and size at which the whole SVG document will be
 * rendered.  The document is scaled proportionally to fit into this viewport.
 *
 * The @cr must be in a `CAIRO_STATUS_SUCCESS` state, or this function will not
 * render anything, and instead will return an error.
 *
 * Returns: `TRUE` on success, `FALSE` on error.  Errors are returned
 * in the @error argument.
 *
 * API ordering: This function must be called on a fully-loaded @handle.  See
 * the section "[API ordering](class.Handle.html#api-ordering)" for details.
 *
 * Panics: this function will panic if the @handle is not fully-loaded.
 *
 * Since: 2.46
 */
RSVG_API
gboolean rsvg_handle_render_document (RsvgHandle           *handle,
                                      cairo_t              *cr,
                                      const RsvgRectangle  *viewport,
                                      GError              **error);

/**
 * rsvg_handle_get_geometry_for_layer:
 * @handle: An [class@Rsvg.Handle]
 * @id: (nullable): An element's id within the SVG, starting with "#" (a single
 * hash character), for example, `#layer1`.  This notation corresponds to a
 * URL's fragment ID.  Alternatively, pass `NULL` to compute the geometry for the
 * whole SVG.
 * @viewport: Viewport size at which the whole SVG would be fitted.
 * @out_ink_rect: (out)(optional): Place to store the ink rectangle of the element.
 * @out_logical_rect: (out)(optional): Place to store the logical rectangle of the element.
 * @error: return location for a `GError`
 *
 * Computes the ink rectangle and logical rectangle of an SVG element, or the
 * whole SVG, as if the whole SVG were rendered to a specific viewport.
 *
 * Element IDs should look like an URL fragment identifier; for example, pass
 * `#foo` (hash `foo`) to get the geometry of the element that
 * has an `id="foo"` attribute.
 *
 * The "ink rectangle" is the bounding box that would be painted
 * for fully-stroked and filled elements.
 *
 * The "logical rectangle" just takes into account the unstroked
 * paths and text outlines.
 *
 * Note that these bounds are not minimum bounds; for example,
 * clipping paths are not taken into account.
 *
 * You can pass `NULL` for the @id if you want to measure all
 * the elements in the SVG, i.e. to measure everything from the
 * root element.
 *
 * This operation is not constant-time, as it involves going through all
 * the child elements.
 *
 * Returns: `TRUE` if the geometry could be obtained, or `FALSE` on error.  Errors
 * are returned in the @error argument.
 *
 * API ordering: This function must be called on a fully-loaded @handle.  See
 * the section "[API ordering](class.Handle.html#api-ordering)" for details.
 *
 * Panics: this function will panic if the @handle is not fully-loaded.
 *
 * Since: 2.46
 */
RSVG_API
gboolean rsvg_handle_get_geometry_for_layer (RsvgHandle     *handle,
                                             const char     *id,
                                             const RsvgRectangle *viewport,
                                             RsvgRectangle  *out_ink_rect,
                                             RsvgRectangle  *out_logical_rect,
                                             GError        **error);

/**
 * rsvg_handle_render_layer:
 * @handle: An [class@Rsvg.Handle]
 * @cr: A Cairo context
 * @id: (nullable): An element's id within the SVG, starting with "#" (a single
 * hash character), for example, `#layer1`.  This notation corresponds to a
 * URL's fragment ID.  Alternatively, pass `NULL` to render the whole SVG document tree.
 * @viewport: Viewport size at which the whole SVG would be fitted.
 * @error: return location for a `GError`
 *
 * Renders a single SVG element in the same place as for a whole SVG document.
 *
 * The @viewport gives the position and size at which the whole SVG document would be
 * rendered.  The document is scaled proportionally to fit into this viewport; hence the
 * individual layer may be smaller than this.
 *
 * This is equivalent to [method@Rsvg.Handle.render_document], but it renders only a
 * single element and its children, as if they composed an individual layer in
 * the SVG.  The element is rendered with the same transformation matrix as it
 * has within the whole SVG document.  Applications can use this to re-render a
 * single element and repaint it on top of a previously-rendered document, for
 * example.
 *
 * Element IDs should look like an URL fragment identifier; for example, pass
 * `#foo` (hash `foo`) to get the geometry of the element that
 * has an `id="foo"` attribute.
 *
 * You can pass `NULL` for the @id if you want to render all
 * the elements in the SVG, i.e. to render everything from the
 * root element.
 *
 * Returns: `TRUE` on success, `FALSE` on error.  Errors are returned
 * in the @error argument.
 *
 * API ordering: This function must be called on a fully-loaded @handle.  See
 * the section "[API ordering](class.Handle.html#api-ordering)" for details.
 *
 * Panics: this function will panic if the @handle is not fully-loaded.
 *
 * Since: 2.46
 */
RSVG_API
gboolean rsvg_handle_render_layer (RsvgHandle           *handle,
                                   cairo_t              *cr,
                                   const char           *id,
                                   const RsvgRectangle  *viewport,
                                   GError              **error);

/**
 * rsvg_handle_get_geometry_for_element:
 * @handle: An [class@Rsvg.Handle]
 * @id: (nullable): An element's id within the SVG, starting with "#" (a single
 * hash character), for example, `#layer1`.  This notation corresponds to a
 * URL's fragment ID.  Alternatively, pass `NULL` to compute the geometry for the
 * whole SVG.
 * @out_ink_rect: (out)(optional): Place to store the ink rectangle of the element.
 * @out_logical_rect: (out)(optional): Place to store the logical rectangle of the element.
 * @error: return location for a `GError`
 *
 * Computes the ink rectangle and logical rectangle of a single SVG element.
 *
 * While `rsvg_handle_get_geometry_for_layer` computes the geometry of an SVG element subtree with
 * its transformation matrix, this other function will compute the element's geometry
 * as if it were being rendered under an identity transformation by itself.  That is,
 * the resulting geometry is as if the element got extracted by itself from the SVG.
 *
 * This function is the counterpart to `rsvg_handle_render_element`.
 *
 * Element IDs should look like an URL fragment identifier; for example, pass
 * `#foo` (hash `foo`) to get the geometry of the element that
 * has an `id="foo"` attribute.
 *
 * The "ink rectangle" is the bounding box that would be painted
 * for fully- stroked and filled elements.
 *
 * The "logical rectangle" just takes into account the unstroked
 * paths and text outlines.
 *
 * Note that these bounds are not minimum bounds; for example,
 * clipping paths are not taken into account.
 *
 * You can pass `NULL` for the @id if you want to measure all
 * the elements in the SVG, i.e. to measure everything from the
 * root element.
 *
 * This operation is not constant-time, as it involves going through all
 * the child elements.
 *
 * Returns: `TRUE` if the geometry could be obtained, or `FALSE` on error.  Errors
 * are returned in the @error argument.
 *
 * API ordering: This function must be called on a fully-loaded @handle.  See
 * the section "[API ordering](class.Handle.html#api-ordering)" for details.
 *
 * Panics: this function will panic if the @handle is not fully-loaded.
 *
 * Since: 2.46
 */
RSVG_API
gboolean rsvg_handle_get_geometry_for_element (RsvgHandle     *handle,
                                               const char     *id,
                                               RsvgRectangle  *out_ink_rect,
                                               RsvgRectangle  *out_logical_rect,
                                               GError        **error);

/**
 * rsvg_handle_render_element:
 * @handle: An [class@Rsvg.Handle]
 * @cr: A Cairo context
 * @id: (nullable): An element's id within the SVG, starting with "#" (a single
 * hash character), for example, `#layer1`.  This notation corresponds to a
 * URL's fragment ID.  Alternatively, pass `NULL` to render the whole SVG document tree.
 * @element_viewport: Viewport size in which to fit the element
 * @error: return location for a `GError`
 *
 * Renders a single SVG element to a given viewport.
 *
 * This function can be used to extract individual element subtrees and render them,
 * scaled to a given @element_viewport.  This is useful for applications which have
 * reusable objects in an SVG and want to render them individually; for example, an
 * SVG full of icons that are meant to be be rendered independently of each other.
 *
 * Element IDs should look like an URL fragment identifier; for example, pass
 * `#foo` (hash `foo`) to get the geometry of the element that
 * has an `id="foo"` attribute.
 *
 * You can pass `NULL` for the @id if you want to render all
 * the elements in the SVG, i.e. to render everything from the
 * root element.
 *
 * The `element_viewport` gives the position and size at which the named element will
 * be rendered.  FIXME: mention proportional scaling.
 *
 * Returns: `TRUE` on success, `FALSE` on error.  Errors are returned
 * in the @error argument.
 *
 * API ordering: This function must be called on a fully-loaded @handle.  See
 * the section "[API ordering](class.Handle.html#api-ordering)" for details.
 *
 * Panics: this function will panic if the @handle is not fully-loaded.
 *
 * Since: 2.46
 */
RSVG_API
gboolean rsvg_handle_render_element (RsvgHandle           *handle,
                                     cairo_t              *cr,
                                     const char           *id,
                                     const RsvgRectangle  *element_viewport,
                                     GError              **error);

G_END_DECLS

#endif
