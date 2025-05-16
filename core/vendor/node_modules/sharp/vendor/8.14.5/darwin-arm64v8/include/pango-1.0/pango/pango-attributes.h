/* Pango
 * pango-attributes.h: Attributed text
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

#ifndef __PANGO_ATTRIBUTES_H__
#define __PANGO_ATTRIBUTES_H__

#include <pango/pango-font.h>
#include <pango/pango-color.h>
#include <glib-object.h>

G_BEGIN_DECLS


typedef struct _PangoAttribute        PangoAttribute;
typedef struct _PangoAttrClass        PangoAttrClass;

typedef struct _PangoAttrString       PangoAttrString;
typedef struct _PangoAttrLanguage     PangoAttrLanguage;
typedef struct _PangoAttrInt          PangoAttrInt;
typedef struct _PangoAttrSize         PangoAttrSize;
typedef struct _PangoAttrFloat        PangoAttrFloat;
typedef struct _PangoAttrColor        PangoAttrColor;
typedef struct _PangoAttrFontDesc     PangoAttrFontDesc;
typedef struct _PangoAttrShape        PangoAttrShape;
typedef struct _PangoAttrFontFeatures PangoAttrFontFeatures;

/**
 * PangoAttrType:
 * @PANGO_ATTR_INVALID: does not happen
 * @PANGO_ATTR_LANGUAGE: language ([struct@Pango.AttrLanguage])
 * @PANGO_ATTR_FAMILY: font family name list ([struct@Pango.AttrString])
 * @PANGO_ATTR_STYLE: font slant style ([struct@Pango.AttrInt])
 * @PANGO_ATTR_WEIGHT: font weight ([struct@Pango.AttrInt])
 * @PANGO_ATTR_VARIANT: font variant (normal or small caps) ([struct@Pango.AttrInt])
 * @PANGO_ATTR_STRETCH: font stretch ([struct@Pango.AttrInt])
 * @PANGO_ATTR_SIZE: font size in points scaled by %PANGO_SCALE ([struct@Pango.AttrInt])
 * @PANGO_ATTR_FONT_DESC: font description ([struct@Pango.AttrFontDesc])
 * @PANGO_ATTR_FOREGROUND: foreground color ([struct@Pango.AttrColor])
 * @PANGO_ATTR_BACKGROUND: background color ([struct@Pango.AttrColor])
 * @PANGO_ATTR_UNDERLINE: whether the text has an underline ([struct@Pango.AttrInt])
 * @PANGO_ATTR_STRIKETHROUGH: whether the text is struck-through ([struct@Pango.AttrInt])
 * @PANGO_ATTR_RISE: baseline displacement ([struct@Pango.AttrInt])
 * @PANGO_ATTR_SHAPE: shape ([struct@Pango.AttrShape])
 * @PANGO_ATTR_SCALE: font size scale factor ([struct@Pango.AttrFloat])
 * @PANGO_ATTR_FALLBACK: whether fallback is enabled ([struct@Pango.AttrInt])
 * @PANGO_ATTR_LETTER_SPACING: letter spacing ([struct@PangoAttrInt])
 * @PANGO_ATTR_UNDERLINE_COLOR: underline color ([struct@Pango.AttrColor])
 * @PANGO_ATTR_STRIKETHROUGH_COLOR: strikethrough color ([struct@Pango.AttrColor])
 * @PANGO_ATTR_ABSOLUTE_SIZE: font size in pixels scaled by %PANGO_SCALE ([struct@Pango.AttrInt])
 * @PANGO_ATTR_GRAVITY: base text gravity ([struct@Pango.AttrInt])
 * @PANGO_ATTR_GRAVITY_HINT: gravity hint ([struct@Pango.AttrInt])
 * @PANGO_ATTR_FONT_FEATURES: OpenType font features ([struct@Pango.AttrFontFeatures]). Since 1.38
 * @PANGO_ATTR_FOREGROUND_ALPHA: foreground alpha ([struct@Pango.AttrInt]). Since 1.38
 * @PANGO_ATTR_BACKGROUND_ALPHA: background alpha ([struct@Pango.AttrInt]). Since 1.38
 * @PANGO_ATTR_ALLOW_BREAKS: whether breaks are allowed ([struct@Pango.AttrInt]). Since 1.44
 * @PANGO_ATTR_SHOW: how to render invisible characters ([struct@Pango.AttrInt]). Since 1.44
 * @PANGO_ATTR_INSERT_HYPHENS: whether to insert hyphens at intra-word line breaks ([struct@Pango.AttrInt]). Since 1.44
 * @PANGO_ATTR_OVERLINE: whether the text has an overline ([struct@Pango.AttrInt]). Since 1.46
 * @PANGO_ATTR_OVERLINE_COLOR: overline color ([struct@Pango.AttrColor]). Since 1.46
 * @PANGO_ATTR_LINE_HEIGHT: line height factor ([struct@Pango.AttrFloat]). Since: 1.50
 * @PANGO_ATTR_ABSOLUTE_LINE_HEIGHT: line height ([struct@Pango.AttrInt]). Since: 1.50
 * @PANGO_ATTR_WORD: override segmentation to classify the range of the attribute as a single word ([struct@Pango.AttrInt]). Since 1.50
 * @PANGO_ATTR_SENTENCE: override segmentation to classify the range of the attribute as a single sentence ([struct@Pango.AttrInt]). Since 1.50
 * @PANGO_ATTR_BASELINE_SHIFT: baseline displacement ([struct@Pango.AttrInt]). Since 1.50
 * @PANGO_ATTR_FONT_SCALE: font-relative size change ([struct@Pango.AttrInt]). Since 1.50
 *
 * The `PangoAttrType` distinguishes between different types of attributes.
 *
 * Along with the predefined values, it is possible to allocate additional
 * values for custom attributes using [func@AttrType.register]. The predefined
 * values are given below. The type of structure used to store the attribute is
 * listed in parentheses after the description.
 */
typedef enum
{
  PANGO_ATTR_INVALID,           /* 0 is an invalid attribute type */
  PANGO_ATTR_LANGUAGE,          /* PangoAttrLanguage */
  PANGO_ATTR_FAMILY,            /* PangoAttrString */
  PANGO_ATTR_STYLE,             /* PangoAttrInt */
  PANGO_ATTR_WEIGHT,            /* PangoAttrInt */
  PANGO_ATTR_VARIANT,           /* PangoAttrInt */
  PANGO_ATTR_STRETCH,           /* PangoAttrInt */
  PANGO_ATTR_SIZE,              /* PangoAttrSize */
  PANGO_ATTR_FONT_DESC,         /* PangoAttrFontDesc */
  PANGO_ATTR_FOREGROUND,        /* PangoAttrColor */
  PANGO_ATTR_BACKGROUND,        /* PangoAttrColor */
  PANGO_ATTR_UNDERLINE,         /* PangoAttrInt */
  PANGO_ATTR_STRIKETHROUGH,     /* PangoAttrInt */
  PANGO_ATTR_RISE,              /* PangoAttrInt */
  PANGO_ATTR_SHAPE,             /* PangoAttrShape */
  PANGO_ATTR_SCALE,             /* PangoAttrFloat */
  PANGO_ATTR_FALLBACK,          /* PangoAttrInt */
  PANGO_ATTR_LETTER_SPACING,    /* PangoAttrInt */
  PANGO_ATTR_UNDERLINE_COLOR,   /* PangoAttrColor */
  PANGO_ATTR_STRIKETHROUGH_COLOR,/* PangoAttrColor */
  PANGO_ATTR_ABSOLUTE_SIZE,     /* PangoAttrSize */
  PANGO_ATTR_GRAVITY,           /* PangoAttrInt */
  PANGO_ATTR_GRAVITY_HINT,      /* PangoAttrInt */
  PANGO_ATTR_FONT_FEATURES,     /* PangoAttrFontFeatures */
  PANGO_ATTR_FOREGROUND_ALPHA,  /* PangoAttrInt */
  PANGO_ATTR_BACKGROUND_ALPHA,  /* PangoAttrInt */
  PANGO_ATTR_ALLOW_BREAKS,      /* PangoAttrInt */
  PANGO_ATTR_SHOW,              /* PangoAttrInt */
  PANGO_ATTR_INSERT_HYPHENS,    /* PangoAttrInt */
  PANGO_ATTR_OVERLINE,          /* PangoAttrInt */
  PANGO_ATTR_OVERLINE_COLOR,    /* PangoAttrColor */
  PANGO_ATTR_LINE_HEIGHT,       /* PangoAttrFloat */
  PANGO_ATTR_ABSOLUTE_LINE_HEIGHT, /* PangoAttrInt */
  PANGO_ATTR_TEXT_TRANSFORM,    /* PangoAttrInt */
  PANGO_ATTR_WORD,              /* PangoAttrInt */
  PANGO_ATTR_SENTENCE,          /* PangoAttrInt */
  PANGO_ATTR_BASELINE_SHIFT,    /* PangoAttrSize */
  PANGO_ATTR_FONT_SCALE,        /* PangoAttrInt */
} PangoAttrType;

/**
 * PangoUnderline:
 * @PANGO_UNDERLINE_NONE: no underline should be drawn
 * @PANGO_UNDERLINE_SINGLE: a single underline should be drawn
 * @PANGO_UNDERLINE_DOUBLE: a double underline should be drawn
 * @PANGO_UNDERLINE_LOW: a single underline should be drawn at a
 *   position beneath the ink extents of the text being
 *   underlined. This should be used only for underlining
 *   single characters, such as for keyboard accelerators.
 *   %PANGO_UNDERLINE_SINGLE should be used for extended
 *   portions of text.
 * @PANGO_UNDERLINE_ERROR: an underline indicating an error should
 *   be drawn below. The exact style of rendering is up to the
 *   `PangoRenderer` in use, but typical styles include wavy
 *   or dotted lines.
 *   This underline is typically used to indicate an error such
 *   as a possible mispelling; in some cases a contrasting color
 *   may automatically be used. This type of underlining is
 *   available since Pango 1.4.
 * @PANGO_UNDERLINE_SINGLE_LINE: Like @PANGO_UNDERLINE_SINGLE, but
 *   drawn continuously across multiple runs. This type
 *   of underlining is available since Pango 1.46.
 * @PANGO_UNDERLINE_DOUBLE_LINE: Like @PANGO_UNDERLINE_DOUBLE, but
 *   drawn continuously across multiple runs. This type
 *   of underlining is available since Pango 1.46.
 * @PANGO_UNDERLINE_ERROR_LINE: Like @PANGO_UNDERLINE_ERROR, but
 *   drawn continuously across multiple runs. This type
 *   of underlining is available since Pango 1.46.
 *
 * The `PangoUnderline` enumeration is used to specify whether text
 * should be underlined, and if so, the type of underlining.
 */
typedef enum {
  PANGO_UNDERLINE_NONE,
  PANGO_UNDERLINE_SINGLE,
  PANGO_UNDERLINE_DOUBLE,
  PANGO_UNDERLINE_LOW,
  PANGO_UNDERLINE_ERROR,
  PANGO_UNDERLINE_SINGLE_LINE,
  PANGO_UNDERLINE_DOUBLE_LINE,
  PANGO_UNDERLINE_ERROR_LINE
} PangoUnderline;


/**
 * PangoOverline:
 * @PANGO_OVERLINE_NONE: no overline should be drawn
 * @PANGO_OVERLINE_SINGLE: Draw a single line above the ink
 *   extents of the text being underlined.
 *
 * The `PangoOverline` enumeration is used to specify whether text
 * should be overlined, and if so, the type of line.
 *
 * Since: 1.46
 */
typedef enum {
  PANGO_OVERLINE_NONE,
  PANGO_OVERLINE_SINGLE
} PangoOverline;

/**
 * PangoShowFlags:
 * @PANGO_SHOW_NONE: No special treatment for invisible characters
 * @PANGO_SHOW_SPACES: Render spaces, tabs and newlines visibly
 * @PANGO_SHOW_LINE_BREAKS: Render line breaks visibly
 * @PANGO_SHOW_IGNORABLES: Render default-ignorable Unicode
 *   characters visibly
 *
 * These flags affect how Pango treats characters that are normally
 * not visible in the output.
 *
 * Since: 1.44
 */
typedef enum {
  PANGO_SHOW_NONE        = 0,
  PANGO_SHOW_SPACES      = 1 << 0,
  PANGO_SHOW_LINE_BREAKS = 1 << 1,
  PANGO_SHOW_IGNORABLES  = 1 << 2
} PangoShowFlags;

/**
 * PangoTextTransform:
 * @PANGO_TEXT_TRANSFORM_NONE: Leave text unchanged
 * @PANGO_TEXT_TRANSFORM_LOWERCASE: Display letters and numbers as lowercase
 * @PANGO_TEXT_TRANSFORM_UPPERCASE: Display letters and numbers as uppercase
 * @PANGO_TEXT_TRANSFORM_CAPITALIZE: Display the first character of a word
 *   in titlecase
 *
 * An enumeration that affects how Pango treats characters during shaping.
 *
 * Since: 1.50
 */
typedef enum {
  PANGO_TEXT_TRANSFORM_NONE,
  PANGO_TEXT_TRANSFORM_LOWERCASE,
  PANGO_TEXT_TRANSFORM_UPPERCASE,
  PANGO_TEXT_TRANSFORM_CAPITALIZE,
} PangoTextTransform;

/**
 * PangoBaselineShift:
 * @PANGO_BASELINE_SHIFT_NONE: Leave the baseline unchanged
 * @PANGO_BASELINE_SHIFT_SUPERSCRIPT: Shift the baseline to the superscript position,
 *   relative to the previous run
 * @PANGO_BASELINE_SHIFT_SUBSCRIPT: Shift the baseline to the subscript position,
 *   relative to the previous run
 *
 * An enumeration that affects baseline shifts between runs.
 *
 * Since: 1.50
 */
typedef enum {
  PANGO_BASELINE_SHIFT_NONE,
  PANGO_BASELINE_SHIFT_SUPERSCRIPT,
  PANGO_BASELINE_SHIFT_SUBSCRIPT,
} PangoBaselineShift;

/**
 * PangoFontScale:
 * @PANGO_FONT_SCALE_NONE: Leave the font size unchanged
 * @PANGO_FONT_SCALE_SUPERSCRIPT: Change the font to a size suitable for superscripts
 * @PANGO_FONT_SCALE_SUBSCRIPT: Change the font to a size suitable for subscripts
 * @PANGO_FONT_SCALE_SMALL_CAPS: Change the font to a size suitable for Small Caps
 *
 * An enumeration that affects font sizes for superscript
 * and subscript positioning and for (emulated) Small Caps.
 *
 * Since: 1.50
 */
typedef enum {
  PANGO_FONT_SCALE_NONE,
  PANGO_FONT_SCALE_SUPERSCRIPT,
  PANGO_FONT_SCALE_SUBSCRIPT,
  PANGO_FONT_SCALE_SMALL_CAPS,
} PangoFontScale;

/**
 * PANGO_ATTR_INDEX_FROM_TEXT_BEGINNING:
 *
 * Value for @start_index in `PangoAttribute` that indicates
 * the beginning of the text.
 *
 * Since: 1.24
 */
#define PANGO_ATTR_INDEX_FROM_TEXT_BEGINNING ((guint)0)

/**
 * PANGO_ATTR_INDEX_TO_TEXT_END: (value 4294967295)
 *
 * Value for @end_index in `PangoAttribute` that indicates
 * the end of the text.
 *
 * Since: 1.24
 */
#define PANGO_ATTR_INDEX_TO_TEXT_END ((guint)(G_MAXUINT + 0))

/**
 * PangoAttribute:
 * @klass: the class structure holding information about the type of the attribute
 * @start_index: the start index of the range (in bytes).
 * @end_index: end index of the range (in bytes). The character at this index
 *   is not included in the range.
 *
 * The `PangoAttribute` structure represents the common portions of all
 * attributes.
 *
 * Particular types of attributes include this structure as their initial
 * portion. The common portion of the attribute holds the range to which
 * the value in the type-specific part of the attribute applies and should
 * be initialized using [method@Pango.Attribute.init]. By default, an attribute
 * will have an all-inclusive range of [0,%G_MAXUINT].
 */
struct _PangoAttribute
{
  const PangoAttrClass *klass;
  guint start_index;
  guint end_index;
};

/**
 * PangoAttrFilterFunc:
 * @attribute: a Pango attribute
 * @user_data: user data passed to the function
 *
 * Type of a function filtering a list of attributes.
 *
 * Return value: %TRUE if the attribute should be selected for
 *   filtering, %FALSE otherwise.
 */
typedef gboolean (*PangoAttrFilterFunc) (PangoAttribute *attribute,
                                         gpointer        user_data);

/**
 * PangoAttrDataCopyFunc:
 * @user_data: user data to copy
 *
 * Type of a function that can duplicate user data for an attribute.
 *
 * Return value: new copy of @user_data.
 **/
typedef gpointer (*PangoAttrDataCopyFunc) (gconstpointer user_data);

/**
 * PangoAttrClass:
 * @type: the type ID for this attribute
 * @copy: function to duplicate an attribute of this type
 *   (see [method@Pango.Attribute.copy])
 * @destroy: function to free an attribute of this type
 *   (see [method@Pango.Attribute.destroy])
 * @equal: function to check two attributes of this type for equality
 *   (see [method@Pango.Attribute.equal])
 *
 * The `PangoAttrClass` structure stores the type and operations for
 * a particular type of attribute.
 *
 * The functions in this structure should not be called directly. Instead,
 * one should use the wrapper functions provided for `PangoAttribute`.
 */
struct _PangoAttrClass
{
  /*< public >*/
  PangoAttrType type;
  PangoAttribute * (*copy) (const PangoAttribute *attr);
  void             (*destroy) (PangoAttribute *attr);
  gboolean         (*equal) (const PangoAttribute *attr1, const PangoAttribute *attr2);
};

/**
 * PangoAttrString:
 * @attr: the common portion of the attribute
 * @value: the string which is the value of the attribute
 *
 * The `PangoAttrString` structure is used to represent attributes with
 * a string value.
 */
struct _PangoAttrString
{
  PangoAttribute attr;
  char *value;
};
/**
 * PangoAttrLanguage:
 * @attr: the common portion of the attribute
 * @value: the `PangoLanguage` which is the value of the attribute
 *
 * The `PangoAttrLanguage` structure is used to represent attributes that
 * are languages.
 */
struct _PangoAttrLanguage
{
  PangoAttribute attr;
  PangoLanguage *value;
};
/**
 * PangoAttrInt:
 * @attr: the common portion of the attribute
 * @value: the value of the attribute
 *
 * The `PangoAttrInt` structure is used to represent attributes with
 * an integer or enumeration value.
 */
struct _PangoAttrInt
{
  PangoAttribute attr;
  int value;
};
/**
 * PangoAttrFloat:
 * @attr: the common portion of the attribute
 * @value: the value of the attribute
 *
 * The `PangoAttrFloat` structure is used to represent attributes with
 * a float or double value.
 */
struct _PangoAttrFloat
{
  PangoAttribute attr;
  double value;
};
/**
 * PangoAttrColor:
 * @attr: the common portion of the attribute
 * @color: the `PangoColor` which is the value of the attribute
 *
 * The `PangoAttrColor` structure is used to represent attributes that
 * are colors.
 */
struct _PangoAttrColor
{
  PangoAttribute attr;
  PangoColor color;
};

/**
 * PangoAttrSize:
 * @attr: the common portion of the attribute
 * @size: size of font, in units of 1/%PANGO_SCALE of a point (for
 *   %PANGO_ATTR_SIZE) or of a device unit (for %PANGO_ATTR_ABSOLUTE_SIZE)
 * @absolute: whether the font size is in device units or points.
 *   This field is only present for compatibility with Pango-1.8.0
 *   (%PANGO_ATTR_ABSOLUTE_SIZE was added in 1.8.1); and always will
 *   be %FALSE for %PANGO_ATTR_SIZE and %TRUE for %PANGO_ATTR_ABSOLUTE_SIZE.
 *
 * The `PangoAttrSize` structure is used to represent attributes which
 * set font size.
 */
struct _PangoAttrSize
{
  PangoAttribute attr;
  int size;
  guint absolute : 1;
};

/**
 * PangoAttrShape:
 * @attr: the common portion of the attribute
 * @ink_rect: the ink rectangle to restrict to
 * @logical_rect: the logical rectangle to restrict to
 * @data: user data set (see [func@Pango.AttrShape.new_with_data])
 * @copy_func: copy function for the user data
 * @destroy_func: destroy function for the user data
 *
 * The `PangoAttrShape` structure is used to represent attributes which
 * impose shape restrictions.
 */
struct _PangoAttrShape
{
  PangoAttribute attr;
  PangoRectangle ink_rect;
  PangoRectangle logical_rect;

  gpointer              data;
  PangoAttrDataCopyFunc copy_func;
  GDestroyNotify        destroy_func;
};

/**
 * PangoAttrFontDesc:
 * @attr: the common portion of the attribute
 * @desc: the font description which is the value of this attribute
 *
 * The `PangoAttrFontDesc` structure is used to store an attribute that
 * sets all aspects of the font description at once.
 */
struct _PangoAttrFontDesc
{
  PangoAttribute attr;
  PangoFontDescription *desc;
};

/**
 * PangoAttrFontFeatures:
 * @attr: the common portion of the attribute
 * @features: the features, as a string in CSS syntax
 *
 * The `PangoAttrFontFeatures` structure is used to represent OpenType
 * font features as an attribute.
 *
 * Since: 1.38
 */
struct _PangoAttrFontFeatures
{
  PangoAttribute attr;
  gchar *features;
};

PANGO_AVAILABLE_IN_ALL
GType                   pango_attribute_get_type                (void) G_GNUC_CONST;

PANGO_AVAILABLE_IN_ALL
PangoAttrType           pango_attr_type_register                (const char                 *name);
PANGO_AVAILABLE_IN_1_22
const char *            pango_attr_type_get_name                (PangoAttrType               type) G_GNUC_CONST;
PANGO_AVAILABLE_IN_1_20
void                    pango_attribute_init                    (PangoAttribute             *attr,
                                                                 const PangoAttrClass       *klass);
PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attribute_copy                    (const PangoAttribute       *attr);
PANGO_AVAILABLE_IN_ALL
void                    pango_attribute_destroy                 (PangoAttribute             *attr);
PANGO_AVAILABLE_IN_ALL
gboolean                pango_attribute_equal                   (const PangoAttribute       *attr1,
                                                                 const PangoAttribute       *attr2) G_GNUC_PURE;

PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attr_language_new                 (PangoLanguage              *language);
PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attr_family_new                   (const char                 *family);
PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attr_foreground_new               (guint16                     red,
                                                                 guint16                     green,
                                                                 guint16                     blue);
PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attr_background_new               (guint16                     red,
                                                                 guint16                     green,
                                                                 guint16                     blue);
PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attr_size_new                     (int                         size);
PANGO_AVAILABLE_IN_1_8
PangoAttribute *        pango_attr_size_new_absolute            (int                         size);
PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attr_style_new                    (PangoStyle                  style);
PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attr_weight_new                   (PangoWeight                 weight);
PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attr_variant_new                  (PangoVariant                variant);
PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attr_stretch_new                  (PangoStretch                stretch);
PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attr_font_desc_new                (const PangoFontDescription *desc);

PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attr_underline_new                (PangoUnderline              underline);
PANGO_AVAILABLE_IN_1_8
PangoAttribute *        pango_attr_underline_color_new          (guint16                     red,
                                                                 guint16                     green,
                                                                 guint16                     blue);
PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attr_strikethrough_new            (gboolean                    strikethrough);
PANGO_AVAILABLE_IN_1_8
PangoAttribute *        pango_attr_strikethrough_color_new      (guint16                     red,
                                                                 guint16                     green,
                                                                 guint16                     blue);
PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attr_rise_new                     (int                         rise);
PANGO_AVAILABLE_IN_1_50
PangoAttribute *        pango_attr_baseline_shift_new           (int                         shift);
PANGO_AVAILABLE_IN_1_50
PangoAttribute *        pango_attr_font_scale_new               (PangoFontScale              scale);
PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attr_scale_new                    (double                      scale_factor);
PANGO_AVAILABLE_IN_1_4
PangoAttribute *        pango_attr_fallback_new                 (gboolean                    enable_fallback);
PANGO_AVAILABLE_IN_1_6
PangoAttribute *        pango_attr_letter_spacing_new           (int                         letter_spacing);
PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attr_shape_new                    (const PangoRectangle        *ink_rect,
                                                                 const PangoRectangle        *logical_rect);
PANGO_AVAILABLE_IN_1_8
PangoAttribute *        pango_attr_shape_new_with_data          (const PangoRectangle        *ink_rect,
                                                                 const PangoRectangle        *logical_rect,
                                                                 gpointer                     data,
                                                                 PangoAttrDataCopyFunc        copy_func,
                                                                 GDestroyNotify               destroy_func);
PANGO_AVAILABLE_IN_1_16
PangoAttribute *        pango_attr_gravity_new                  (PangoGravity                 gravity);
PANGO_AVAILABLE_IN_1_16
PangoAttribute *        pango_attr_gravity_hint_new             (PangoGravityHint             hint);
PANGO_AVAILABLE_IN_1_38
PangoAttribute *        pango_attr_font_features_new            (const char                  *features);
PANGO_AVAILABLE_IN_1_38
PangoAttribute *        pango_attr_foreground_alpha_new         (guint16                      alpha);
PANGO_AVAILABLE_IN_1_38
PangoAttribute *        pango_attr_background_alpha_new         (guint16                      alpha);
PANGO_AVAILABLE_IN_1_44
PangoAttribute *        pango_attr_allow_breaks_new             (gboolean                     allow_breaks);

PANGO_AVAILABLE_IN_1_50
PangoAttribute *        pango_attr_word_new                     (void);
PANGO_AVAILABLE_IN_1_50
PangoAttribute *        pango_attr_sentence_new                 (void);

PANGO_AVAILABLE_IN_1_44
PangoAttribute *        pango_attr_insert_hyphens_new           (gboolean                     insert_hyphens);
PANGO_AVAILABLE_IN_1_46
PangoAttribute *        pango_attr_overline_new                 (PangoOverline                overline);
PANGO_AVAILABLE_IN_1_46
PangoAttribute *        pango_attr_overline_color_new           (guint16                      red,
                                                                 guint16                      green,
                                                                 guint16                      blue);
PANGO_AVAILABLE_IN_1_44
PangoAttribute *        pango_attr_show_new                     (PangoShowFlags               flags);
PANGO_AVAILABLE_IN_1_50
PangoAttribute *        pango_attr_line_height_new              (double                       factor);
PANGO_AVAILABLE_IN_1_50
PangoAttribute *        pango_attr_line_height_new_absolute     (int                          height);
PANGO_AVAILABLE_IN_1_50
PangoAttribute *        pango_attr_text_transform_new           (PangoTextTransform transform);

PANGO_AVAILABLE_IN_1_50
PangoAttrString       * pango_attribute_as_string               (PangoAttribute              *attr);
PANGO_AVAILABLE_IN_1_50
PangoAttrLanguage     * pango_attribute_as_language             (PangoAttribute              *attr);
PANGO_AVAILABLE_IN_1_50
PangoAttrInt          * pango_attribute_as_int                  (PangoAttribute              *attr);
PANGO_AVAILABLE_IN_1_50
PangoAttrSize         * pango_attribute_as_size                 (PangoAttribute              *attr);
PANGO_AVAILABLE_IN_1_50
PangoAttrFloat        * pango_attribute_as_float                (PangoAttribute              *attr);
PANGO_AVAILABLE_IN_1_50
PangoAttrColor        * pango_attribute_as_color                (PangoAttribute              *attr);
PANGO_AVAILABLE_IN_1_50
PangoAttrFontDesc     * pango_attribute_as_font_desc            (PangoAttribute              *attr);
PANGO_AVAILABLE_IN_1_50
PangoAttrShape        * pango_attribute_as_shape                (PangoAttribute              *attr);
PANGO_AVAILABLE_IN_1_50
PangoAttrFontFeatures * pango_attribute_as_font_features        (PangoAttribute              *attr);

/* Attribute lists */

typedef struct _PangoAttrList     PangoAttrList;
typedef struct _PangoAttrIterator PangoAttrIterator;

#define PANGO_TYPE_ATTR_LIST pango_attr_list_get_type ()

/**
 * PangoAttrIterator:
 *
 * A `PangoAttrIterator` is used to iterate through a `PangoAttrList`.
 *
 * A new iterator is created with [method@Pango.AttrList.get_iterator].
 * Once the iterator is created, it can be advanced through the style
 * changes in the text using [method@Pango.AttrIterator.next]. At each
 * style change, the range of the current style segment and the attributes
 * currently in effect can be queried.
 */

/**
 * PangoAttrList:
 *
 * A `PangoAttrList` represents a list of attributes that apply to a section
 * of text.
 *
 * The attributes in a `PangoAttrList` are, in general, allowed to overlap in
 * an arbitrary fashion. However, if the attributes are manipulated only through
 * [method@Pango.AttrList.change], the overlap between properties will meet
 * stricter criteria.
 *
 * Since the `PangoAttrList` structure is stored as a linear list, it is not
 * suitable for storing attributes for large amounts of text. In general, you
 * should not use a single `PangoAttrList` for more than one paragraph of text.
 */

PANGO_AVAILABLE_IN_ALL
GType                   pango_attr_list_get_type        (void) G_GNUC_CONST;

PANGO_AVAILABLE_IN_ALL
PangoAttrList *         pango_attr_list_new             (void);
PANGO_AVAILABLE_IN_1_10
PangoAttrList *         pango_attr_list_ref             (PangoAttrList         *list);
PANGO_AVAILABLE_IN_ALL
void                    pango_attr_list_unref           (PangoAttrList         *list);
PANGO_AVAILABLE_IN_ALL
PangoAttrList *         pango_attr_list_copy            (PangoAttrList         *list);
PANGO_AVAILABLE_IN_ALL
void                    pango_attr_list_insert          (PangoAttrList         *list,
                                                         PangoAttribute        *attr);
PANGO_AVAILABLE_IN_ALL
void                    pango_attr_list_insert_before   (PangoAttrList         *list,
                                                         PangoAttribute        *attr);
PANGO_AVAILABLE_IN_ALL
void                    pango_attr_list_change          (PangoAttrList         *list,
                                                         PangoAttribute        *attr);
PANGO_AVAILABLE_IN_ALL
void                    pango_attr_list_splice          (PangoAttrList         *list,
                                                         PangoAttrList         *other,
                                                         int                    pos,
                                                         int                    len);
PANGO_AVAILABLE_IN_1_44
void                    pango_attr_list_update          (PangoAttrList         *list,
                                                         int                    pos,
                                                         int                    remove,
                                                         int                    add);

PANGO_AVAILABLE_IN_1_2
PangoAttrList *         pango_attr_list_filter          (PangoAttrList         *list,
                                                         PangoAttrFilterFunc    func,
                                                         gpointer               data);

PANGO_AVAILABLE_IN_1_44
GSList *                pango_attr_list_get_attributes  (PangoAttrList         *list);

PANGO_AVAILABLE_IN_1_46
gboolean                pango_attr_list_equal           (PangoAttrList         *list,
                                                         PangoAttrList         *other_list);

PANGO_AVAILABLE_IN_1_50
char *                  pango_attr_list_to_string       (PangoAttrList         *list);
PANGO_AVAILABLE_IN_1_50
PangoAttrList *         pango_attr_list_from_string     (const char            *text);

PANGO_AVAILABLE_IN_1_44
GType                   pango_attr_iterator_get_type    (void) G_GNUC_CONST;

PANGO_AVAILABLE_IN_ALL
PangoAttrIterator *     pango_attr_list_get_iterator    (PangoAttrList         *list);

PANGO_AVAILABLE_IN_ALL
void                    pango_attr_iterator_range       (PangoAttrIterator     *iterator,
                                                         int                   *start,
                                                         int                   *end);
PANGO_AVAILABLE_IN_ALL
gboolean                pango_attr_iterator_next        (PangoAttrIterator     *iterator);
PANGO_AVAILABLE_IN_ALL
PangoAttrIterator *     pango_attr_iterator_copy        (PangoAttrIterator     *iterator);
PANGO_AVAILABLE_IN_ALL
void                    pango_attr_iterator_destroy     (PangoAttrIterator     *iterator);
PANGO_AVAILABLE_IN_ALL
PangoAttribute *        pango_attr_iterator_get         (PangoAttrIterator     *iterator,
                                                         PangoAttrType          type);
PANGO_AVAILABLE_IN_ALL
void                    pango_attr_iterator_get_font    (PangoAttrIterator     *iterator,
                                                         PangoFontDescription  *desc,
                                                         PangoLanguage        **language,
                                                         GSList               **extra_attrs);
PANGO_AVAILABLE_IN_1_2
GSList *                pango_attr_iterator_get_attrs   (PangoAttrIterator     *iterator);

G_DEFINE_AUTOPTR_CLEANUP_FUNC(PangoAttribute, pango_attribute_destroy)
G_DEFINE_AUTOPTR_CLEANUP_FUNC(PangoAttrList, pango_attr_list_unref)
G_DEFINE_AUTOPTR_CLEANUP_FUNC(PangoAttrIterator, pango_attr_iterator_destroy)

G_END_DECLS

#endif /* __PANGO_ATTRIBUTES_H__ */
