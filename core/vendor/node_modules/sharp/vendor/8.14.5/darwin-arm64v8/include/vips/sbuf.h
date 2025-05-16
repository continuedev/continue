/* Buffered inputput from a VipsSource
 *
 * J.Cupitt, 18/11/19
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

#ifndef VIPS_SBUF_H
#define VIPS_SBUF_H

#include <glib.h>
#include <glib-object.h>
#include <vips/object.h>

#ifdef __cplusplus
extern "C" {
#endif /*__cplusplus*/

#define VIPS_TYPE_SBUF (vips_sbuf_get_type())
#define VIPS_SBUF( obj ) \
	(G_TYPE_CHECK_INSTANCE_CAST( (obj), \
	VIPS_TYPE_SBUF, VipsSbuf ))
#define VIPS_SBUF_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_CAST( (klass), \
	VIPS_TYPE_SBUF, VipsSbufClass))
#define VIPS_IS_SBUF( obj ) \
	(G_TYPE_CHECK_INSTANCE_TYPE( (obj), VIPS_TYPE_SBUF ))
#define VIPS_IS_SBUF_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_TYPE( (klass), VIPS_TYPE_SBUF ))
#define VIPS_SBUF_GET_CLASS( obj ) \
	(G_TYPE_INSTANCE_GET_CLASS( (obj), \
	VIPS_TYPE_SBUF, VipsSbufClass ))

#define VIPS_SBUF_BUFFER_SIZE (4096)

/* Layer over source: read with an input buffer.
 * 
 * Libraries like libjpeg do their own input buffering and need raw IO, but
 * others, like radiance, need to parse the input into lines. A buffered read
 * class is very convenient.
 */
typedef struct _VipsSbuf {
	VipsObject parent_object;

	/*< private >*/

	/* The VipsSource we wrap.
	 */
	VipsSource *source;

	/* The +1 means there's always a \0 byte at the end.
	 *
	 * Unsigned char, since we don't want >127 to be -ve.
	 *
	 * chars_in_buffer is how many chars we have in input_buffer,
	 * read_point is the current read position in that buffer.
	 */
	unsigned char input_buffer[VIPS_SBUF_BUFFER_SIZE + 1];
	int chars_in_buffer;
	int read_point;

	/* Build lines of text here.
	 */
	unsigned char line[VIPS_SBUF_BUFFER_SIZE + 1];

} VipsSbuf;

typedef struct _VipsSbufClass {
	VipsObjectClass parent_class;

} VipsSbufClass;

VIPS_API
GType vips_sbuf_get_type( void );

VIPS_API
VipsSbuf *vips_sbuf_new_from_source( VipsSource *source );

VIPS_API
void vips_sbuf_unbuffer( VipsSbuf *sbuf );

VIPS_API
int vips_sbuf_getc( VipsSbuf *sbuf );
#define VIPS_SBUF_GETC( S ) ( \
	(S)->read_point < (S)->chars_in_buffer ? \
		(S)->input_buffer[(S)->read_point++] : \
		vips_sbuf_getc( S ) \
)
VIPS_API
void vips_sbuf_ungetc( VipsSbuf *sbuf );
#define VIPS_SBUF_UNGETC( S ) { \
	if( (S)->read_point > 0 ) \
		(S)->read_point -= 1; \
}

VIPS_API
int vips_sbuf_require( VipsSbuf *sbuf, int require );
#define VIPS_SBUF_REQUIRE( S, R ) ( \
	(S)->read_point + (R) <= (S)->chars_in_buffer ? \
		0 :  \
		vips_sbuf_require( (S), (R) ) \
)
#define VIPS_SBUF_PEEK( S ) ((S)->input_buffer + (S)->read_point)
#define VIPS_SBUF_FETCH( S ) ((S)->input_buffer[(S)->read_point++])

VIPS_API
const char *vips_sbuf_get_line( VipsSbuf *sbuf ); 
VIPS_API
char *vips_sbuf_get_line_copy( VipsSbuf *sbuf ); 
VIPS_API
const char *vips_sbuf_get_non_whitespace( VipsSbuf *sbuf );
VIPS_API
int vips_sbuf_skip_whitespace( VipsSbuf *sbuf );

#ifdef __cplusplus
}
#endif /*__cplusplus*/

#endif /*VIPS_SBUF_H*/
