/* Pango
 * pango-tabs.h: Tab-related stuff
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

#ifndef __PANGO_TABS_H__
#define __PANGO_TABS_H__

#include <pango/pango-types.h>

G_BEGIN_DECLS

typedef struct _PangoTabArray PangoTabArray;

/**
 * PangoTabAlign:
 * @PANGO_TAB_LEFT: the text appears to the right of the tab stop position
 * @PANGO_TAB_RIGHT: the text appears to the left of the tab stop position
 *   until the available space is filled. Since: 1.50
 * @PANGO_TAB_CENTER: the text is centered at the tab stop position
 *   until the available space is filled. Since: 1.50
 * @PANGO_TAB_DECIMAL: text before the first occurrence of the decimal point
 *   character appears to the left of the tab stop position (until the available
 *   space is filled), the rest to the right. Since: 1.50
 *
 * `PangoTabAlign` specifies where the text appears relative to the tab stop
 * position.
 */
typedef enum
{
  PANGO_TAB_LEFT,
  PANGO_TAB_RIGHT,
  PANGO_TAB_CENTER,
  PANGO_TAB_DECIMAL
} PangoTabAlign;

#define PANGO_TYPE_TAB_ARRAY (pango_tab_array_get_type ())

PANGO_AVAILABLE_IN_ALL
PangoTabArray  *pango_tab_array_new                 (gint           initial_size,
						     gboolean       positions_in_pixels);
PANGO_AVAILABLE_IN_ALL
PangoTabArray  *pango_tab_array_new_with_positions  (gint           size,
						     gboolean       positions_in_pixels,
						     PangoTabAlign  first_alignment,
						     gint           first_position,
						     ...);
PANGO_AVAILABLE_IN_ALL
GType           pango_tab_array_get_type            (void) G_GNUC_CONST;
PANGO_AVAILABLE_IN_ALL
PangoTabArray  *pango_tab_array_copy                (PangoTabArray *src);
PANGO_AVAILABLE_IN_ALL
void            pango_tab_array_free                (PangoTabArray *tab_array);
PANGO_AVAILABLE_IN_ALL
gint            pango_tab_array_get_size            (PangoTabArray *tab_array);
PANGO_AVAILABLE_IN_ALL
void            pango_tab_array_resize              (PangoTabArray *tab_array,
						     gint           new_size);
PANGO_AVAILABLE_IN_ALL
void            pango_tab_array_set_tab             (PangoTabArray *tab_array,
						     gint           tab_index,
						     PangoTabAlign  alignment,
						     gint           location);
PANGO_AVAILABLE_IN_ALL
void            pango_tab_array_get_tab             (PangoTabArray *tab_array,
						     gint           tab_index,
						     PangoTabAlign *alignment,
						     gint          *location);
PANGO_AVAILABLE_IN_ALL
void            pango_tab_array_get_tabs            (PangoTabArray *tab_array,
						     PangoTabAlign **alignments,
						     gint          **locations);

PANGO_AVAILABLE_IN_ALL
gboolean        pango_tab_array_get_positions_in_pixels (PangoTabArray *tab_array);

PANGO_AVAILABLE_IN_1_50
void            pango_tab_array_set_positions_in_pixels (PangoTabArray *tab_array,
                                                         gboolean       positions_in_pixels);

PANGO_AVAILABLE_IN_1_50
char *          pango_tab_array_to_string           (PangoTabArray *tab_array);
PANGO_AVAILABLE_IN_1_50
PangoTabArray * pango_tab_array_from_string         (const char    *text);

PANGO_AVAILABLE_IN_1_50
void            pango_tab_array_set_decimal_point   (PangoTabArray *tab_array,
                                                     int            tab_index,
                                                     gunichar       decimal_point);
PANGO_AVAILABLE_IN_1_50
gunichar        pango_tab_array_get_decimal_point   (PangoTabArray *tab_array,
                                                     int            tab_index);

PANGO_AVAILABLE_IN_1_50
void            pango_tab_array_sort                (PangoTabArray *tab_array);

G_DEFINE_AUTOPTR_CLEANUP_FUNC(PangoTabArray, pango_tab_array_free)

G_END_DECLS

#endif /* __PANGO_TABS_H__ */
