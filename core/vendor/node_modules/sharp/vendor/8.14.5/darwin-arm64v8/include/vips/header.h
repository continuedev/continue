/* image header funcs
 *
 * 20/9/09
 * 	- from proto.h
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

#ifndef VIPS_HEADER_H
#define VIPS_HEADER_H

#ifdef __cplusplus
extern "C" {
#endif /*__cplusplus*/

/**
 * VIPS_META_EXIF_NAME:
 *
 * The name that JPEG read and write operations use for the image's EXIF data.
 */
#define VIPS_META_EXIF_NAME "exif-data"

/**
 * VIPS_META_XMP_NAME:
 *
 * The name that read and write operations use for the image's XMP data.
 */
#define VIPS_META_XMP_NAME "xmp-data"

/**
 * VIPS_META_IPTC_NAME:
 *
 * The name that read and write operations use for the image's IPTC data.
 */
#define VIPS_META_IPTC_NAME "iptc-data"

/**
 * VIPS_META_PHOTOSHOP_NAME:
 *
 * The name that TIFF read and write operations use for the image's
 * TIFFTAG_PHOTOSHOP data.
 */
#define VIPS_META_PHOTOSHOP_NAME "photoshop-data"

/**
 * VIPS_META_ICC_NAME:
 *
 * The name we use to attach an ICC profile. The file read and write
 * operations for TIFF, JPEG, PNG and others use this item of metadata to
 * attach and save ICC profiles. The profile is updated by the
 * vips_icc_transform() operations.
 */
#define VIPS_META_ICC_NAME "icc-profile-data"

/**
 * VIPS_META_IMAGEDESCRIPTION:
 *
 * The IMAGEDESCRIPTION tag. Often has useful metadata. 
 */
#define VIPS_META_IMAGEDESCRIPTION "image-description"

/**
 * VIPS_META_RESOLUTION_UNIT:
 *
 * The JPEG and TIFF read and write operations use this to record the
 * file's preferred unit for resolution.
 */
#define VIPS_META_RESOLUTION_UNIT "resolution-unit"

/**
 * VIPS_META_LOADER:
 *
 * Record the name of the original loader here. Handy for hinting file formats
 * and for debugging.
 */
#define VIPS_META_LOADER "vips-loader"

/**
 * VIPS_META_SEQUENTIAL:
 *
 * Images loaded via vips_sequential() have this int field defined. Some
 * operations (eg. vips_shrinkv()) add extra caches if they see it on their
 * input. 
 */
#define VIPS_META_SEQUENTIAL "vips-sequential"

/**
 * VIPS_META_ORIENTATION:
 *
 * The orientation tag for this image. An int from 1 - 8 using the standard 
 * exif/tiff meanings. 
 *
 * * 1 - The 0th row represents the visual top of the image, and the 0th column
 *   represents the visual left-hand side.
 * * 2 - The 0th row represents the visual top of the image, and the 0th column
 *   represents the visual right-hand side.
 * * 3 - The 0th row represents the visual bottom of the image, and the 0th
 *   column represents the visual right-hand side.
 * * 4 - The 0th row represents the visual bottom of the image, and the 0th
 *   column represents the visual left-hand side.
 * * 5 - The 0th row represents the visual left-hand side of the image, and the
 *   0th column represents the visual top.
 * * 6 - The 0th row represents the visual right-hand side of the image, and the
 *   0th column represents the visual top.
 * * 7 - The 0th row represents the visual right-hand side of the image, and the
 *   0th column represents the visual bottom.
 * * 8 - The 0th row represents the visual left-hand side of the image, and the
 *   0th column represents the visual bottom. 
 */
#define VIPS_META_ORIENTATION "orientation"

/**
 * VIPS_META_PAGE_HEIGHT:
 *
 * If set, the height of each page when this image was loaded. If you save an
 * image with "page-height" set to a format that supports multiple pages, such
 * as tiff, the image will be saved as a series of pages. 
 */
#define VIPS_META_PAGE_HEIGHT "page-height"

/**
 * VIPS_META_N_PAGES:
 *
 * If set, the number of pages in the original file. 
 */
#define VIPS_META_N_PAGES "n-pages"

/**
 * VIPS_META_N_SUBIFDS:
 *
 * If set, the number of subifds in the first page of the file.
 */
#define VIPS_META_N_SUBIFDS "n-subifds"

/**
 * VIPS_META_CONCURRENCY:
 *
 * If set, the suggested concurrency for this image.
 */
#define VIPS_META_CONCURRENCY "concurrency"

VIPS_API
guint64 vips_format_sizeof( VipsBandFormat format );
VIPS_API
guint64 vips_format_sizeof_unsafe( VipsBandFormat format );

VIPS_API
int vips_image_get_width( const VipsImage *image );
VIPS_API
int vips_image_get_height( const VipsImage *image );
VIPS_API
int vips_image_get_bands( const VipsImage *image );
VIPS_API
VipsBandFormat vips_image_get_format( const VipsImage *image );
VIPS_API
double vips_image_get_format_max( VipsBandFormat format );
VIPS_API
VipsBandFormat vips_image_guess_format( const VipsImage *image );
VIPS_API
VipsCoding vips_image_get_coding( const VipsImage *image );
VIPS_API
VipsInterpretation vips_image_get_interpretation( const VipsImage *image );
VIPS_API
VipsInterpretation vips_image_guess_interpretation( const VipsImage *image );
VIPS_API
double vips_image_get_xres( const VipsImage *image );
VIPS_API
double vips_image_get_yres( const VipsImage *image );
VIPS_API
int vips_image_get_xoffset( const VipsImage *image );
VIPS_API
int vips_image_get_yoffset( const VipsImage *image );
VIPS_API
const char *vips_image_get_filename( const VipsImage *image );
VIPS_API
const char *vips_image_get_mode( const VipsImage *image );
VIPS_API
double vips_image_get_scale( const VipsImage *image );
VIPS_API
double vips_image_get_offset( const VipsImage *image );
VIPS_API
int vips_image_get_page_height( VipsImage *image );
VIPS_API
int vips_image_get_n_pages( VipsImage *image );
VIPS_API
int vips_image_get_n_subifds( VipsImage *image );
VIPS_API
int vips_image_get_orientation( VipsImage *image );
VIPS_API
gboolean vips_image_get_orientation_swap( VipsImage *image );
VIPS_API
int vips_image_get_concurrency( VipsImage *image, int default_concurrency );
VIPS_API
const void *vips_image_get_data( VipsImage *image );

VIPS_API
void vips_image_init_fields( VipsImage *image, 
	int xsize, int ysize, int bands, 
	VipsBandFormat format, VipsCoding coding, 
	VipsInterpretation interpretation, 
	double xres, double yres );

VIPS_API
void vips_image_set( VipsImage *image, const char *name, GValue *value );
VIPS_API
int vips_image_get( const VipsImage *image, 
	const char *name, GValue *value_copy );
VIPS_API
int vips_image_get_as_string( const VipsImage *image, 
	const char *name, char **out );
VIPS_API
GType vips_image_get_typeof( const VipsImage *image, const char *name );
VIPS_API
gboolean vips_image_remove( VipsImage *image, const char *name );
typedef void *(*VipsImageMapFn)( VipsImage *image, 
	const char *name, GValue *value, void *a );
VIPS_API
void *vips_image_map( VipsImage *image, VipsImageMapFn fn, void *a );
VIPS_API
gchar **vips_image_get_fields( VipsImage *image );

VIPS_API
void vips_image_set_area( VipsImage *image, 
	const char *name, VipsCallbackFn free_fn, void *data );
VIPS_API
int vips_image_get_area( const VipsImage *image, 
	const char *name, const void **data );
VIPS_API
void vips_image_set_blob( VipsImage *image, 
	const char *name, 
	VipsCallbackFn free_fn, const void *data, size_t length );
VIPS_API
void vips_image_set_blob_copy( VipsImage *image, 
	const char *name, const void *data, size_t length );
VIPS_API
int vips_image_get_blob( const VipsImage *image, 
	const char *name, const void **data, size_t *length );

VIPS_API
int vips_image_get_int( const VipsImage *image, const char *name, int *out );
VIPS_API
void vips_image_set_int( VipsImage *image, const char *name, int i );
VIPS_API
int vips_image_get_double( const VipsImage *image, 
	const char *name, double *out );
VIPS_API
void vips_image_set_double( VipsImage *image, const char *name, double d );
VIPS_API
int vips_image_get_string( const VipsImage *image, 
	const char *name, const char **out );
VIPS_API
void vips_image_set_string( VipsImage *image, 
	const char *name, const char *str );
VIPS_API
void vips_image_print_field( const VipsImage *image, const char *name );
VIPS_API
int vips_image_get_image( const VipsImage *image, 
	const char *name, VipsImage **out );
VIPS_API
void vips_image_set_image( VipsImage *image, const char *name, VipsImage *im );
VIPS_API
void vips_image_set_array_int( VipsImage *image, const char *name,
	const int *array, int n );
VIPS_API
int vips_image_get_array_int( VipsImage *image, const char *name, 
	int **out, int *n );
VIPS_API
int vips_image_get_array_double( VipsImage *image, const char *name, 
	double **out, int *n );
VIPS_API
void vips_image_set_array_double( VipsImage *image, const char *name,
	const double *array, int n );

VIPS_API
int vips_image_history_printf( VipsImage *image, const char *format, ... )
	G_GNUC_PRINTF( 2, 3 );
VIPS_API
int vips_image_history_args( VipsImage *image, 
	const char *name, int argc, char *argv[] );
VIPS_API
const char *vips_image_get_history( VipsImage *image );

#ifdef __cplusplus
}
#endif /*__cplusplus*/

#endif /*VIPS_HEADER_H*/
