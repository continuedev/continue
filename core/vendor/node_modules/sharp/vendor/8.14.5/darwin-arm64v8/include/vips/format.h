/* Base type for supported image formats. Subclass this to add a new
 * format.
 */

/*

    This file is part of VIPS.
    
    VIPS is free software; you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
    02110-1301  USA

 */

/*

    These files are distributed with VIPS - http://www.vips.ecs.soton.ac.uk

 */

#ifndef VIPS_FORMAT_H
#define VIPS_FORMAT_H

#ifdef __cplusplus
extern "C" {
#endif /*__cplusplus*/

#define VIPS_TYPE_FORMAT (vips_format_get_type())
#define VIPS_FORMAT( obj ) \
	(G_TYPE_CHECK_INSTANCE_CAST( (obj), \
	VIPS_TYPE_FORMAT, VipsFormat ))
#define VIPS_FORMAT_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_CAST( (klass), \
	VIPS_TYPE_FORMAT, VipsFormatClass))
#define VIPS_IS_FORMAT( obj ) \
	(G_TYPE_CHECK_INSTANCE_TYPE( (obj), VIPS_TYPE_FORMAT ))
#define VIPS_IS_FORMAT_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_TYPE( (klass), VIPS_TYPE_FORMAT ))
#define VIPS_FORMAT_GET_CLASS( obj ) \
	(G_TYPE_INSTANCE_GET_CLASS( (obj), \
	VIPS_TYPE_FORMAT, VipsFormatClass ))

/* Image file properties. 
 */
typedef enum {
	VIPS_FORMAT_NONE = 0,		/* No flags set */
	VIPS_FORMAT_PARTIAL = 1,	/* Lazy read OK (eg. tiled tiff) */
	VIPS_FORMAT_BIGENDIAN = 2	/* Most-significant byte first */
} VipsFormatFlags;

/* Don't instantiate these things, just use the class stuff.
 */

typedef struct _VipsFormat {
	VipsObject parent_object;
	/*< public >*/

} VipsFormat;

typedef struct _VipsFormatClass {
	VipsObjectClass parent_class;

	/*< public >*/
	/* Is a file in this format.
	 */
	gboolean (*is_a)( const char * );

	/* Read just the header into the VipsImage.
	 */
	int (*header)( const char *, VipsImage * );

	/* Load the whole image.
	 */
	int (*load)( const char *, VipsImage * );

	/* Write the VipsImage to the file in this format.
	 */
	int (*save)( VipsImage *, const char * );

	/* Get the flags for this file in this format.
	 */
	VipsFormatFlags (*get_flags)( const char * );

	/* Loop over formats in this order, default 0. We need this because
	 * some formats can be read by several loaders (eg. tiff can be read
	 * by the libMagick loader as well as by the tiff loader), and we want
	 * to make sure the better loader comes first.
	 */
	int priority;

	/* Null-terminated list of allowed suffixes, eg. ".tif", ".tiff".
	 */
	const char **suffs;
} VipsFormatClass;

VIPS_API
GType vips_format_get_type( void );

/* Map over and find formats. This uses type introspection to loop over
 * subclasses of VipsFormat.
 */
VIPS_API
void *vips_format_map( VipsSListMap2Fn fn, void *a, void *b );
VIPS_API
VipsFormatClass *vips_format_for_file( const char *filename );
VIPS_API
VipsFormatClass *vips_format_for_name( const char *filename );

VIPS_API
VipsFormatFlags vips_format_get_flags( VipsFormatClass *format, 
	const char *filename );

/* Read/write an image convenience functions.
 */
VIPS_API
int vips_format_read( const char *filename, VipsImage *out );
VIPS_API
int vips_format_write( VipsImage *in, const char *filename );

#ifdef __cplusplus
}
#endif /*__cplusplus*/

#endif /*VIPS_FORMAT_H*/
