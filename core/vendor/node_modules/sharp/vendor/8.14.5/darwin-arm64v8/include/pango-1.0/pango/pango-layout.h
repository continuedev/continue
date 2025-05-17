/* Pango
 * pango-layout.h: High-level layout driver
 *
 * Copyright (C) 2000 Red Hat Software
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Library General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.	 See the GNU
 * Library General Public License for more details.
 *
 * You should have received a copy of the GNU Library General Public
 * License along with this library; if not, write to the
 * Free Software Foundation, Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307, USA.
 */

#ifndef __PANGO_LAYOUT_H__
#define __PANGO_LAYOUT_H__

#include <pango/pango-attributes.h>
#include <pango/pango-context.h>
#include <pango/pango-glyph-item.h>
#include <pango/pango-tabs.h>

G_BEGIN_DECLS

typedef struct _PangoLayout      PangoLayout;
typedef struct _PangoLayoutClass PangoLayoutClass;
typedef struct _PangoLayoutLine  PangoLayoutLine;

/**
 * PangoLayoutRun:
 *
 * A `PangoLayoutRun` represents a single run within a `PangoLayoutLine`.
 *
 * It is simply an alternate name for [struct@Pango.GlyphItem].
 * See the [struct@Pango.GlyphItem] docs for details on the fields.
 */
typedef PangoGlyphItem PangoLayoutRun;

/**
 * PangoAlignment:
 * @PANGO_ALIGN_LEFT: Put all available space on the right
 * @PANGO_ALIGN_CENTER: Center the line within the available space
 * @PANGO_ALIGN_RIGHT: Put all available space on the left
 *
 * `PangoAlignment` describes how to align the lines of a `PangoLayout`
 * within the available space.
 *
 * If the `PangoLayout` is set to justify using [method@Pango.Layout.set_justify],
 * this only affects partial lines.
 *
 * See [method@Pango.Layout.set_auto_dir] for how text direction affects
 * the interpretation of `PangoAlignment` values.
 */
typedef enum {
  PANGO_ALIGN_LEFT,
  PANGO_ALIGN_CENTER,
  PANGO_ALIGN_RIGHT
} PangoAlignment;

/**
 * PangoWrapMode:
 * @PANGO_WRAP_WORD: wrap lines at word boundaries.
 * @PANGO_WRAP_CHAR: wrap lines at character boundaries.
 * @PANGO_WRAP_WORD_CHAR: wrap lines at word boundaries, but fall back to
 *   character boundaries if there is not enough space for a full word.
 *
 * `PangoWrapMode` describes how to wrap the lines of a `PangoLayout`
 * to the desired width.
 *
 * For @PANGO_WRAP_WORD, Pango uses break opportunities that are determined
 * by the Unicode line breaking algorithm. For @PANGO_WRAP_CHAR, Pango allows
 * breaking at grapheme boundaries that are determined by the Unicode text
 * segmentation algorithm.
 */
typedef enum {
  PANGO_WRAP_WORD,
  PANGO_WRAP_CHAR,
  PANGO_WRAP_WORD_CHAR
} PangoWrapMode;

/**
 * PangoEllipsizeMode:
 * @PANGO_ELLIPSIZE_NONE: No ellipsization
 * @PANGO_ELLIPSIZE_START: Omit characters at the start of the text
 * @PANGO_ELLIPSIZE_MIDDLE: Omit characters in the middle of the text
 * @PANGO_ELLIPSIZE_END: Omit characters at the end of the text
 *
 * `PangoEllipsizeMode` describes what sort of ellipsization
 * should be applied to text.
 *
 * In the ellipsization process characters are removed from the
 * text in order to make it fit to a given width and replaced
 * with an ellipsis.
 */
typedef enum {
  PANGO_ELLIPSIZE_NONE,
  PANGO_ELLIPSIZE_START,
  PANGO_ELLIPSIZE_MIDDLE,
  PANGO_ELLIPSIZE_END
} PangoEllipsizeMode;

/**
 * PangoLayoutLine:
 * @layout: (nullable): the layout this line belongs to, might be %NULL
 * @start_index: start of line as byte index into layout->text
 * @length: length of line in bytes
 * @runs: (nullable) (element-type Pango.LayoutRun): list of runs in the
 *   line, from left to right
 * @is_paragraph_start: #TRUE if this is the first line of the paragraph
 * @resolved_dir: #Resolved PangoDirection of line
 *
 * A `PangoLayoutLine` represents one of the lines resulting from laying
 * out a paragraph via `PangoLayout`.
 *
 * `PangoLayoutLine` structures are obtained by calling
 * [method@Pango.Layout.get_line] and are only valid until the text,
 * attributes, or settings of the parent `PangoLayout` are modified.
 */
struct _PangoLayoutLine
{
  PangoLayout *layout;
  gint         start_index;     /* start of line as byte index into layout->text */
  gint         length;		/* length of line in bytes */
  GSList      *runs;
  guint        is_paragraph_start : 1;  /* TRUE if this is the first line of the paragraph */
  guint        resolved_dir : 3;  /* Resolved PangoDirection of line */
};

#define PANGO_TYPE_LAYOUT              (pango_layout_get_type ())
#define PANGO_LAYOUT(object)           (G_TYPE_CHECK_INSTANCE_CAST ((object), PANGO_TYPE_LAYOUT, PangoLayout))
#define PANGO_LAYOUT_CLASS(klass)      (G_TYPE_CHECK_CLASS_CAST ((klass), PANGO_TYPE_LAYOUT, PangoLayoutClass))
#define PANGO_IS_LAYOUT(object)        (G_TYPE_CHECK_INSTANCE_TYPE ((object), PANGO_TYPE_LAYOUT))
#define PANGO_IS_LAYOUT_CLASS(klass)   (G_TYPE_CHECK_CLASS_TYPE ((klass), PANGO_TYPE_LAYOUT))
#define PANGO_LAYOUT_GET_CLASS(obj)    (G_TYPE_INSTANCE_GET_CLASS ((obj), PANGO_TYPE_LAYOUT, PangoLayoutClass))

/* The PangoLayout and PangoLayoutClass structs are private; if you
 * need to create a subclass of these, file a bug.
 */

PANGO_AVAILABLE_IN_ALL
GType        pango_layout_get_type       (void) G_GNUC_CONST;
PANGO_AVAILABLE_IN_ALL
PangoLayout *pango_layout_new            (PangoContext   *context);
PANGO_AVAILABLE_IN_ALL
PangoLayout *pango_layout_copy           (PangoLayout    *src);

PANGO_AVAILABLE_IN_ALL
PangoContext  *pango_layout_get_context    (PangoLayout    *layout);

PANGO_AVAILABLE_IN_ALL
void           pango_layout_set_attributes (PangoLayout    *layout,
					    PangoAttrList  *attrs);
PANGO_AVAILABLE_IN_ALL
PangoAttrList *pango_layout_get_attributes (PangoLayout    *layout);

PANGO_AVAILABLE_IN_ALL
void           pango_layout_set_text       (PangoLayout    *layout,
					    const char     *text,
					    int             length);
PANGO_AVAILABLE_IN_ALL
const char    *pango_layout_get_text       (PangoLayout    *layout);

PANGO_AVAILABLE_IN_1_30
gint           pango_layout_get_character_count (PangoLayout *layout);

PANGO_AVAILABLE_IN_ALL
void           pango_layout_set_markup     (PangoLayout    *layout,
					    const char     *markup,
					    int             length);

PANGO_AVAILABLE_IN_ALL
void           pango_layout_set_markup_with_accel (PangoLayout    *layout,
						   const char     *markup,
						   int             length,
						   gunichar        accel_marker,
						   gunichar       *accel_char);

PANGO_AVAILABLE_IN_ALL
void           pango_layout_set_font_description (PangoLayout                *layout,
						  const PangoFontDescription *desc);

PANGO_AVAILABLE_IN_1_8
const PangoFontDescription *pango_layout_get_font_description (PangoLayout *layout);

PANGO_AVAILABLE_IN_ALL
void           pango_layout_set_width            (PangoLayout                *layout,
						  int                         width);
PANGO_AVAILABLE_IN_ALL
int            pango_layout_get_width            (PangoLayout                *layout);
PANGO_AVAILABLE_IN_1_20
void           pango_layout_set_height           (PangoLayout                *layout,
						  int                         height);
PANGO_AVAILABLE_IN_1_20
int            pango_layout_get_height           (PangoLayout                *layout);
PANGO_AVAILABLE_IN_ALL
void           pango_layout_set_wrap             (PangoLayout                *layout,
						  PangoWrapMode               wrap);
PANGO_AVAILABLE_IN_ALL
PangoWrapMode  pango_layout_get_wrap             (PangoLayout                *layout);
PANGO_AVAILABLE_IN_1_16
gboolean       pango_layout_is_wrapped           (PangoLayout                *layout);
PANGO_AVAILABLE_IN_ALL
void           pango_layout_set_indent           (PangoLayout                *layout,
						  int                         indent);
PANGO_AVAILABLE_IN_ALL
int            pango_layout_get_indent           (PangoLayout                *layout);
PANGO_AVAILABLE_IN_ALL
void           pango_layout_set_spacing          (PangoLayout                *layout,
						  int                         spacing);
PANGO_AVAILABLE_IN_ALL
int            pango_layout_get_spacing          (PangoLayout                *layout);
PANGO_AVAILABLE_IN_1_44
void           pango_layout_set_line_spacing     (PangoLayout                *layout,
                                                  float                       factor);
PANGO_AVAILABLE_IN_1_44
float          pango_layout_get_line_spacing     (PangoLayout                *layout);
PANGO_AVAILABLE_IN_ALL
void           pango_layout_set_justify          (PangoLayout                *layout,
                                                  gboolean                    justify);
PANGO_AVAILABLE_IN_ALL
gboolean       pango_layout_get_justify          (PangoLayout                *layout);
PANGO_AVAILABLE_IN_1_50
void           pango_layout_set_justify_last_line (PangoLayout                *layout,
                                                   gboolean                    justify);
PANGO_AVAILABLE_IN_1_50
gboolean       pango_layout_get_justify_last_line (PangoLayout                *layout);
PANGO_AVAILABLE_IN_1_4
void           pango_layout_set_auto_dir         (PangoLayout                *layout,
						  gboolean                    auto_dir);
PANGO_AVAILABLE_IN_1_4
gboolean       pango_layout_get_auto_dir         (PangoLayout                *layout);
PANGO_AVAILABLE_IN_ALL
void           pango_layout_set_alignment        (PangoLayout                *layout,
						  PangoAlignment              alignment);
PANGO_AVAILABLE_IN_ALL
PangoAlignment pango_layout_get_alignment        (PangoLayout                *layout);

PANGO_AVAILABLE_IN_ALL
void           pango_layout_set_tabs             (PangoLayout                *layout,
						  PangoTabArray              *tabs);
PANGO_AVAILABLE_IN_ALL
PangoTabArray* pango_layout_get_tabs             (PangoLayout                *layout);

PANGO_AVAILABLE_IN_ALL
void           pango_layout_set_single_paragraph_mode (PangoLayout                *layout,
						       gboolean                    setting);
PANGO_AVAILABLE_IN_ALL
gboolean       pango_layout_get_single_paragraph_mode (PangoLayout                *layout);

PANGO_AVAILABLE_IN_1_6
void               pango_layout_set_ellipsize (PangoLayout        *layout,
					       PangoEllipsizeMode  ellipsize);
PANGO_AVAILABLE_IN_1_6
PangoEllipsizeMode pango_layout_get_ellipsize (PangoLayout        *layout);
PANGO_AVAILABLE_IN_1_16
gboolean           pango_layout_is_ellipsized (PangoLayout        *layout);

PANGO_AVAILABLE_IN_1_16
int      pango_layout_get_unknown_glyphs_count (PangoLayout    *layout);

PANGO_AVAILABLE_IN_1_46
PangoDirection pango_layout_get_direction (PangoLayout *layout,
                                           int          index);

PANGO_AVAILABLE_IN_ALL
void     pango_layout_context_changed (PangoLayout    *layout);
PANGO_AVAILABLE_IN_1_32
guint    pango_layout_get_serial      (PangoLayout    *layout);

PANGO_AVAILABLE_IN_ALL
void     pango_layout_get_log_attrs (PangoLayout    *layout,
				     PangoLogAttr  **attrs,
				     gint           *n_attrs);

PANGO_AVAILABLE_IN_1_30
const PangoLogAttr *pango_layout_get_log_attrs_readonly (PangoLayout *layout,
							 gint        *n_attrs);

PANGO_AVAILABLE_IN_ALL
void     pango_layout_index_to_pos         (PangoLayout    *layout,
					    int             index_,
					    PangoRectangle *pos);
PANGO_AVAILABLE_IN_ALL
void     pango_layout_index_to_line_x      (PangoLayout    *layout,
					    int             index_,
					    gboolean        trailing,
					    int            *line,
					    int            *x_pos);
PANGO_AVAILABLE_IN_ALL
void     pango_layout_get_cursor_pos       (PangoLayout    *layout,
					    int             index_,
					    PangoRectangle *strong_pos,
					    PangoRectangle *weak_pos);

PANGO_AVAILABLE_IN_1_50
void     pango_layout_get_caret_pos        (PangoLayout    *layout,
                                            int             index_,
                                            PangoRectangle *strong_pos,
                                            PangoRectangle *weak_pos);

PANGO_AVAILABLE_IN_ALL
void     pango_layout_move_cursor_visually (PangoLayout    *layout,
					    gboolean        strong,
					    int             old_index,
					    int             old_trailing,
					    int             direction,
					    int            *new_index,
					    int            *new_trailing);
PANGO_AVAILABLE_IN_ALL
gboolean pango_layout_xy_to_index          (PangoLayout    *layout,
					    int             x,
					    int             y,
					    int            *index_,
					    int            *trailing);
PANGO_AVAILABLE_IN_ALL
void     pango_layout_get_extents          (PangoLayout    *layout,
					    PangoRectangle *ink_rect,
					    PangoRectangle *logical_rect);
PANGO_AVAILABLE_IN_ALL
void     pango_layout_get_pixel_extents    (PangoLayout    *layout,
					    PangoRectangle *ink_rect,
					    PangoRectangle *logical_rect);
PANGO_AVAILABLE_IN_ALL
void     pango_layout_get_size             (PangoLayout    *layout,
					    int            *width,
					    int            *height);
PANGO_AVAILABLE_IN_ALL
void     pango_layout_get_pixel_size       (PangoLayout    *layout,
					    int            *width,
					    int            *height);
PANGO_AVAILABLE_IN_1_22
int      pango_layout_get_baseline         (PangoLayout    *layout);

PANGO_AVAILABLE_IN_ALL
int              pango_layout_get_line_count       (PangoLayout    *layout);
PANGO_AVAILABLE_IN_ALL
PangoLayoutLine *pango_layout_get_line             (PangoLayout    *layout,
						    int             line);
PANGO_AVAILABLE_IN_1_16
PangoLayoutLine *pango_layout_get_line_readonly    (PangoLayout    *layout,
						    int             line);
PANGO_AVAILABLE_IN_ALL
GSList *         pango_layout_get_lines            (PangoLayout    *layout);
PANGO_AVAILABLE_IN_1_16
GSList *         pango_layout_get_lines_readonly   (PangoLayout    *layout);

/**
 * PangoLayoutSerializeFlags:
 * @PANGO_LAYOUT_SERIALIZE_DEFAULT: Default behavior
 * @PANGO_LAYOUT_SERIALIZE_CONTEXT: Include context information
 * @PANGO_LAYOUT_SERIALIZE_OUTPUT: Include information about the formatted output
 *
 * Flags that influence the behavior of [method@Pango.Layout.serialize].
 *
 * New members may be added to this enumeration over time.
 *
 * Since: 1.50
 */
typedef enum {
  PANGO_LAYOUT_SERIALIZE_DEFAULT = 0,
  PANGO_LAYOUT_SERIALIZE_CONTEXT = 1 << 0,
  PANGO_LAYOUT_SERIALIZE_OUTPUT = 1 << 1,
} PangoLayoutSerializeFlags;

PANGO_AVAILABLE_IN_1_50
GBytes *        pango_layout_serialize             (PangoLayout                *layout,
                                                    PangoLayoutSerializeFlags   flags);

PANGO_AVAILABLE_IN_1_50
gboolean        pango_layout_write_to_file         (PangoLayout                 *layout,
                                                    PangoLayoutSerializeFlags   flags,

                                                    const char                  *filename,
                                                    GError                     **error);

#define PANGO_LAYOUT_DESERIALIZE_ERROR (pango_layout_deserialize_error_quark ())

/**
 * PangoLayoutDeserializeError:
 * @PANGO_LAYOUT_DESERIALIZE_INVALID: Unspecified error
 * @PANGO_LAYOUT_DESERIALIZE_INVALID_VALUE: A JSon value could not be
 *   interpreted
 * @PANGO_LAYOUT_DESERIALIZE_MISSING_VALUE: A required JSon member was
 *   not found
 *
 * Errors that can be returned by [func@Pango.Layout.deserialize].
 *
 * Since: 1.50
 */
typedef enum {
  PANGO_LAYOUT_DESERIALIZE_INVALID,
  PANGO_LAYOUT_DESERIALIZE_INVALID_VALUE,
  PANGO_LAYOUT_DESERIALIZE_MISSING_VALUE,
} PangoLayoutDeserializeError;

PANGO_AVAILABLE_IN_1_50
GQuark          pango_layout_deserialize_error_quark (void);

/**
 * PangoLayoutDeserializeFlags:
 * @PANGO_LAYOUT_DESERIALIZE_DEFAULT: Default behavior
 * @PANGO_LAYOUT_DESERIALIZE_CONTEXT: Apply context information
 *   from the serialization to the `PangoContext`
 *
 * Flags that influence the behavior of [func@Pango.Layout.deserialize].
 *
 * New members may be added to this enumeration over time.
 *
 * Since: 1.50
 */
typedef enum {
  PANGO_LAYOUT_DESERIALIZE_DEFAULT = 0,
  PANGO_LAYOUT_DESERIALIZE_CONTEXT = 1 << 0,
} PangoLayoutDeserializeFlags;

PANGO_AVAILABLE_IN_1_50
PangoLayout *   pango_layout_deserialize           (PangoContext                 *context,
                                                    GBytes                       *bytes,
                                                    PangoLayoutDeserializeFlags   flags,
                                                    GError                      **error);


#define PANGO_TYPE_LAYOUT_LINE (pango_layout_line_get_type ())

PANGO_AVAILABLE_IN_ALL
GType    pango_layout_line_get_type     (void) G_GNUC_CONST;

PANGO_AVAILABLE_IN_1_10
PangoLayoutLine *pango_layout_line_ref   (PangoLayoutLine *line);
PANGO_AVAILABLE_IN_ALL
void             pango_layout_line_unref (PangoLayoutLine *line);

PANGO_AVAILABLE_IN_1_50
int      pango_layout_line_get_start_index (PangoLayoutLine *line);
PANGO_AVAILABLE_IN_1_50
int      pango_layout_line_get_length      (PangoLayoutLine *line);
PANGO_AVAILABLE_IN_1_50
gboolean pango_layout_line_is_paragraph_start (PangoLayoutLine *line);
PANGO_AVAILABLE_IN_1_50
PangoDirection pango_layout_line_get_resolved_direction (PangoLayoutLine *line);

PANGO_AVAILABLE_IN_ALL
gboolean pango_layout_line_x_to_index   (PangoLayoutLine  *line,
					 int               x_pos,
					 int              *index_,
					 int              *trailing);
PANGO_AVAILABLE_IN_ALL
void     pango_layout_line_index_to_x   (PangoLayoutLine  *line,
					 int               index_,
					 gboolean          trailing,
					 int              *x_pos);
PANGO_AVAILABLE_IN_ALL
void     pango_layout_line_get_x_ranges (PangoLayoutLine  *line,
					 int               start_index,
					 int               end_index,
					 int             **ranges,
					 int              *n_ranges);
PANGO_AVAILABLE_IN_ALL
void     pango_layout_line_get_extents  (PangoLayoutLine  *line,
					 PangoRectangle   *ink_rect,
					 PangoRectangle   *logical_rect);
PANGO_AVAILABLE_IN_1_44
void     pango_layout_line_get_height   (PangoLayoutLine  *line,
					 int              *height);

PANGO_AVAILABLE_IN_ALL
void     pango_layout_line_get_pixel_extents (PangoLayoutLine *layout_line,
					      PangoRectangle  *ink_rect,
					      PangoRectangle  *logical_rect);

typedef struct _PangoLayoutIter PangoLayoutIter;

#define PANGO_TYPE_LAYOUT_ITER         (pango_layout_iter_get_type ())

PANGO_AVAILABLE_IN_ALL
GType            pango_layout_iter_get_type (void) G_GNUC_CONST;

PANGO_AVAILABLE_IN_ALL
PangoLayoutIter *pango_layout_get_iter  (PangoLayout     *layout);
PANGO_AVAILABLE_IN_1_20
PangoLayoutIter *pango_layout_iter_copy (PangoLayoutIter *iter);
PANGO_AVAILABLE_IN_ALL
void             pango_layout_iter_free (PangoLayoutIter *iter);

PANGO_AVAILABLE_IN_ALL
int              pango_layout_iter_get_index  (PangoLayoutIter *iter);
PANGO_AVAILABLE_IN_ALL
PangoLayoutRun  *pango_layout_iter_get_run    (PangoLayoutIter *iter);
PANGO_AVAILABLE_IN_1_16
PangoLayoutRun  *pango_layout_iter_get_run_readonly   (PangoLayoutIter *iter);
PANGO_AVAILABLE_IN_ALL
PangoLayoutLine *pango_layout_iter_get_line   (PangoLayoutIter *iter);
PANGO_AVAILABLE_IN_1_16
PangoLayoutLine *pango_layout_iter_get_line_readonly  (PangoLayoutIter *iter);
PANGO_AVAILABLE_IN_ALL
gboolean         pango_layout_iter_at_last_line (PangoLayoutIter *iter);
PANGO_AVAILABLE_IN_1_20
PangoLayout     *pango_layout_iter_get_layout (PangoLayoutIter *iter);

PANGO_AVAILABLE_IN_ALL
gboolean pango_layout_iter_next_char    (PangoLayoutIter *iter);
PANGO_AVAILABLE_IN_ALL
gboolean pango_layout_iter_next_cluster (PangoLayoutIter *iter);
PANGO_AVAILABLE_IN_ALL
gboolean pango_layout_iter_next_run     (PangoLayoutIter *iter);
PANGO_AVAILABLE_IN_ALL
gboolean pango_layout_iter_next_line    (PangoLayoutIter *iter);

PANGO_AVAILABLE_IN_ALL
void pango_layout_iter_get_char_extents    (PangoLayoutIter *iter,
					    PangoRectangle  *logical_rect);
PANGO_AVAILABLE_IN_ALL
void pango_layout_iter_get_cluster_extents (PangoLayoutIter *iter,
					    PangoRectangle  *ink_rect,
					    PangoRectangle  *logical_rect);
PANGO_AVAILABLE_IN_ALL
void pango_layout_iter_get_run_extents     (PangoLayoutIter *iter,
					    PangoRectangle  *ink_rect,
					    PangoRectangle  *logical_rect);
PANGO_AVAILABLE_IN_ALL
void pango_layout_iter_get_line_extents    (PangoLayoutIter *iter,
					    PangoRectangle  *ink_rect,
					    PangoRectangle  *logical_rect);
/* All the yranges meet, unlike the logical_rect's (i.e. the yranges
 * assign between-line spacing to the nearest line)
 */
PANGO_AVAILABLE_IN_ALL
void pango_layout_iter_get_line_yrange     (PangoLayoutIter *iter,
					    int             *y0_,
					    int             *y1_);
PANGO_AVAILABLE_IN_ALL
void pango_layout_iter_get_layout_extents  (PangoLayoutIter *iter,
					    PangoRectangle  *ink_rect,
					    PangoRectangle  *logical_rect);
PANGO_AVAILABLE_IN_ALL
int  pango_layout_iter_get_baseline        (PangoLayoutIter *iter);
PANGO_AVAILABLE_IN_1_50
int  pango_layout_iter_get_run_baseline    (PangoLayoutIter *iter);


G_DEFINE_AUTOPTR_CLEANUP_FUNC(PangoLayout, g_object_unref)
G_DEFINE_AUTOPTR_CLEANUP_FUNC(PangoLayoutIter, pango_layout_iter_free)

G_END_DECLS

#endif /* __PANGO_LAYOUT_H__ */

