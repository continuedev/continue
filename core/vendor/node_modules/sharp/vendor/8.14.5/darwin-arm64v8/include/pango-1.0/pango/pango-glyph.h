/* Pango
 * pango-glyph.h: Glyph storage
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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Library General Public License for more details.
 *
 * You should have received a copy of the GNU Library General Public
 * License along with this library; if not, write to the
 * Free Software Foundation, Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307, USA.
 */

#ifndef __PANGO_GLYPH_H__
#define __PANGO_GLYPH_H__

#include <pango/pango-types.h>
#include <pango/pango-item.h>
#include <pango/pango-break.h>

G_BEGIN_DECLS

typedef struct _PangoGlyphGeometry PangoGlyphGeometry;
typedef struct _PangoGlyphVisAttr PangoGlyphVisAttr;
typedef struct _PangoGlyphInfo PangoGlyphInfo;
typedef struct _PangoGlyphString PangoGlyphString;

/* 1024ths of a device unit */
/**
 * PangoGlyphUnit:
 *
 * The `PangoGlyphUnit` type is used to store dimensions within
 * Pango.
 *
 * Dimensions are stored in 1/PANGO_SCALE of a device unit.
 * (A device unit might be a pixel for screen display, or
 * a point on a printer.) PANGO_SCALE is currently 1024, and
 * may change in the future (unlikely though), but you should not
 * depend on its exact value.
 *
 * The PANGO_PIXELS() macro can be used to convert from glyph units
 * into device units with correct rounding.
 */
typedef gint32 PangoGlyphUnit;

/* Positioning information about a glyph
 */
/**
 * PangoGlyphGeometry:
 * @width: the logical width to use for the the character.
 * @x_offset: horizontal offset from nominal character position.
 * @y_offset: vertical offset from nominal character position.
 *
 * The `PangoGlyphGeometry` structure contains width and positioning
 * information for a single glyph.
 *
 * Note that @width is not guaranteed to be the same as the glyph
 * extents. Kerning and other positioning applied during shaping will
 * affect both the @width and the @x_offset for the glyphs in the
 * glyph string that results from shaping.
 *
 * The information in this struct is intended for rendering the glyphs,
 * as follows:
 *
 * 1. Assume the current point is (x, y)
 * 2. Render the current glyph at (x + x_offset, y + y_offset),
 * 3. Advance the current point to (x + width, y)
 * 4. Render the next glyph
 */
struct _PangoGlyphGeometry
{
  PangoGlyphUnit width;
  PangoGlyphUnit x_offset;
  PangoGlyphUnit y_offset;
};

/* Visual attributes of a glyph
 */
/**
 * PangoGlyphVisAttr:
 * @is_cluster_start: set for the first logical glyph in each cluster.
 * @is_color: set if the the font will render this glyph with color. Since 1.50
 *
 * A `PangoGlyphVisAttr` structure communicates information between
 * the shaping and rendering phases.
 *
 * Currently, it contains cluster start and color information.
 * More attributes may be added in the future.
 *
 * Clusters are stored in visual order, within the cluster, glyphs
 * are always ordered in logical order, since visual order is meaningless;
 * that is, in Arabic text, accent glyphs follow the glyphs for the
 * base character.
 */
struct _PangoGlyphVisAttr
{
  guint is_cluster_start : 1;
  guint is_color         : 1;
};

/* A single glyph
 */
/**
 * PangoGlyphInfo:
 * @glyph: the glyph itself.
 * @geometry: the positional information about the glyph.
 * @attr: the visual attributes of the glyph.
 *
 * A `PangoGlyphInfo` structure represents a single glyph with
 * positioning information and visual attributes.
 */
struct _PangoGlyphInfo
{
  PangoGlyph    glyph;
  PangoGlyphGeometry geometry;
  PangoGlyphVisAttr  attr;
};

/**
 * PangoGlyphString:
 * @num_glyphs: number of glyphs in this glyph string
 * @glyphs: (array length=num_glyphs): array of glyph information
 * @log_clusters: logical cluster info, indexed by the byte index
 *   within the text corresponding to the glyph string
 *
 * A `PangoGlyphString` is used to store strings of glyphs with geometry
 * and visual attribute information.
 *
 * The storage for the glyph information is owned by the structure
 * which simplifies memory management.
 */
struct _PangoGlyphString {
  int num_glyphs;

  PangoGlyphInfo *glyphs;
  int *log_clusters;

  /*< private >*/
  int space;
};

#define PANGO_TYPE_GLYPH_STRING (pango_glyph_string_get_type ())

PANGO_AVAILABLE_IN_ALL
GType                   pango_glyph_string_get_type             (void) G_GNUC_CONST;

PANGO_AVAILABLE_IN_ALL
PangoGlyphString *      pango_glyph_string_new                  (void);
PANGO_AVAILABLE_IN_ALL
void                    pango_glyph_string_set_size             (PangoGlyphString    *string,
                                                                 int                  new_len);

PANGO_AVAILABLE_IN_ALL
PangoGlyphString *      pango_glyph_string_copy                 (PangoGlyphString    *string);
PANGO_AVAILABLE_IN_ALL
void                    pango_glyph_string_free                 (PangoGlyphString    *string);

PANGO_AVAILABLE_IN_ALL
void                    pango_glyph_string_extents              (PangoGlyphString    *glyphs,
                                                                 PangoFont           *font,
                                                                 PangoRectangle      *ink_rect,
                                                                 PangoRectangle      *logical_rect);
PANGO_AVAILABLE_IN_1_14
int                     pango_glyph_string_get_width            (PangoGlyphString    *glyphs);

PANGO_AVAILABLE_IN_ALL
void                    pango_glyph_string_extents_range        (PangoGlyphString    *glyphs,
                                                                 int                  start,
                                                                 int                  end,
                                                                 PangoFont           *font,
                                                                 PangoRectangle      *ink_rect,
                                                                 PangoRectangle      *logical_rect);

PANGO_AVAILABLE_IN_ALL
void                    pango_glyph_string_get_logical_widths   (PangoGlyphString    *glyphs,
                                                                 const char          *text,
                                                                 int                  length,
                                                                 int                  embedding_level,
                                                                 int                 *logical_widths);

PANGO_AVAILABLE_IN_ALL
void                    pango_glyph_string_index_to_x           (PangoGlyphString    *glyphs,
                                                                 const char          *text,
                                                                 int                  length,
                                                                 PangoAnalysis       *analysis,
                                                                 int                  index_,
                                                                 gboolean             trailing,
                                                                 int                 *x_pos);
PANGO_AVAILABLE_IN_ALL
void                    pango_glyph_string_x_to_index           (PangoGlyphString    *glyphs,
                                                                 const char          *text,
                                                                 int                  length,
                                                                 PangoAnalysis       *analysis,
                                                                 int                  x_pos,
                                                                 int                 *index_,
                                                                 int                 *trailing);

PANGO_AVAILABLE_IN_1_50
void                    pango_glyph_string_index_to_x_full      (PangoGlyphString    *glyphs,
                                                                 const char          *text,
                                                                 int                  length,
                                                                 PangoAnalysis       *analysis,
                                                                 PangoLogAttr        *attrs,
                                                                 int                  index_,
                                                                 gboolean             trailing,
                                                                 int                 *x_pos);

/* Shaping */

/**
 * PangoShapeFlags:
 * @PANGO_SHAPE_NONE: Default value
 * @PANGO_SHAPE_ROUND_POSITIONS: Round glyph positions and widths to whole device units
 *   This option should be set if the target renderer can't do subpixel positioning of glyphs
 *
 * Flags influencing the shaping process.
 *
 * `PangoShapeFlags` can be passed to [func@Pango.shape_with_flags].
 *
 * Since: 1.44
 */
typedef enum {
  PANGO_SHAPE_NONE            = 0,
  PANGO_SHAPE_ROUND_POSITIONS = 1 << 0,
} PangoShapeFlags;

PANGO_AVAILABLE_IN_ALL
void                    pango_shape                             (const char          *text,
                                                                 int                  length,
                                                                 const PangoAnalysis *analysis,
                                                                 PangoGlyphString    *glyphs);

PANGO_AVAILABLE_IN_1_32
void                    pango_shape_full                        (const char          *item_text,
                                                                 int                  item_length,
                                                                 const char          *paragraph_text,
                                                                 int                  paragraph_length,
                                                                 const PangoAnalysis *analysis,
                                                                 PangoGlyphString    *glyphs);

PANGO_AVAILABLE_IN_1_44
void                    pango_shape_with_flags                  (const char          *item_text,
                                                                 int                  item_length,
                                                                 const char          *paragraph_text,
                                                                 int                  paragraph_length,
                                                                 const PangoAnalysis *analysis,
                                                                 PangoGlyphString    *glyphs,
                                                                 PangoShapeFlags      flags);


PANGO_AVAILABLE_IN_1_50
void                    pango_shape_item                        (PangoItem           *item,
                                                                 const char          *paragraph_text,
                                                                 int                  paragraph_length,
                                                                 PangoLogAttr        *log_attrs,
                                                                 PangoGlyphString    *glyphs,
                                                                 PangoShapeFlags      flags);


G_END_DECLS

#endif /* __PANGO_GLYPH_H__ */
