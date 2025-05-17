/* base class for all vips operations
 */

/*

    Copyright (C) 1991-2005 The National Gallery

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
    Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA
    02110-1301  USA

 */

/*

    These files are distributed with VIPS - http://www.vips.ecs.soton.ac.uk

 */

#ifndef VIPS_OPERATION_H
#define VIPS_OPERATION_H

#include <glib.h>
#include <glib-object.h>
#include <vips/object.h>
#include <vips/buf.h>
#include <vips/basic.h>

#ifdef __cplusplus
extern "C" {
#endif /*__cplusplus*/

typedef enum /*< flags >*/ {
	VIPS_OPERATION_NONE = 0,
	VIPS_OPERATION_SEQUENTIAL = 1,
	VIPS_OPERATION_SEQUENTIAL_UNBUFFERED = 2,
	VIPS_OPERATION_NOCACHE = 4,
	VIPS_OPERATION_DEPRECATED = 8,
	VIPS_OPERATION_UNTRUSTED = 16,
	VIPS_OPERATION_BLOCKED = 32
} VipsOperationFlags;

#define VIPS_TYPE_OPERATION (vips_operation_get_type())
#define VIPS_OPERATION( obj ) \
	(G_TYPE_CHECK_INSTANCE_CAST( (obj), \
		VIPS_TYPE_OPERATION, VipsOperation ))
#define VIPS_OPERATION_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_CAST( (klass), \
		VIPS_TYPE_OPERATION, VipsOperationClass ))
#define VIPS_IS_OPERATION( obj ) \
	(G_TYPE_CHECK_INSTANCE_TYPE( (obj), VIPS_TYPE_OPERATION ))
#define VIPS_IS_OPERATION_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_TYPE( (klass), VIPS_TYPE_OPERATION ))
#define VIPS_OPERATION_GET_CLASS( obj ) \
	(G_TYPE_INSTANCE_GET_CLASS( (obj), \
		VIPS_TYPE_OPERATION, VipsOperationClass ))

typedef gboolean (*VipsOperationBuildFn)( VipsObject *object );

typedef struct _VipsOperation {
	VipsObject parent_instance;

	/* Keep the hash here.
	 */
	guint hash;
	gboolean found_hash;

	/* Pixels calculated ... handy for measuring over-calculation.
	 */
	int pixels;

} VipsOperation;

typedef struct _VipsOperationClass {
	VipsObjectClass parent_class;

	/* Print the usage message.
	 */
	void (*usage)( struct _VipsOperationClass *cls, VipsBuf *buf );

	/* Return a set of operation flags. 
	 */
	VipsOperationFlags (*get_flags)( VipsOperation *operation ); 
	VipsOperationFlags flags;

	/* One of our input images has signalled "invalidate". The cache uses
	 * VipsOperation::invalidate to drop dirty ops.
	 */
	void (*invalidate)( VipsOperation *operation );
} VipsOperationClass;

/* Don't put spaces around void here, it breaks gtk-doc.
 */
VIPS_API
GType vips_operation_get_type(void);

VIPS_API
VipsOperationFlags vips_operation_get_flags( VipsOperation *operation );
VIPS_API
void vips_operation_class_print_usage( VipsOperationClass *operation_class );
VIPS_API
void vips_operation_invalidate( VipsOperation *operation );

VIPS_API
int vips_operation_call_valist( VipsOperation *operation, va_list ap );
VIPS_API
VipsOperation *vips_operation_new( const char *name ); 
VIPS_API
int vips_call_required_optional( VipsOperation **operation,
	va_list required, va_list optional );
VIPS_API
int vips_call( const char *operation_name, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_call_split( const char *operation_name, va_list optional, ... );
VIPS_API
int vips_call_split_option_string( const char *operation_name, 
	const char *option_string, va_list optional, ... );

VIPS_API
void vips_call_options( GOptionGroup *group, VipsOperation *operation );
VIPS_API
int vips_call_argv( VipsOperation *operation, int argc, char **argv );

VIPS_API
void vips_cache_drop_all( void );
VIPS_API
VipsOperation *vips_cache_operation_lookup( VipsOperation *operation );
VIPS_API
void vips_cache_operation_add( VipsOperation *operation );
VIPS_API
int vips_cache_operation_buildp( VipsOperation **operation );
VIPS_API
VipsOperation *vips_cache_operation_build( VipsOperation *operation );
VIPS_API
void vips_cache_print( void );
VIPS_API
void vips_cache_set_max( int max );
VIPS_API
void vips_cache_set_max_mem( size_t max_mem );
VIPS_API
int vips_cache_get_max( void );
VIPS_API
int vips_cache_get_size( void );
VIPS_API
size_t vips_cache_get_max_mem( void );
VIPS_API
int vips_cache_get_max_files( void );
VIPS_API
void vips_cache_set_max_files( int max_files );
VIPS_API
void vips_cache_set_dump( gboolean dump );
VIPS_API
void vips_cache_set_trace( gboolean trace );

/* Part of threadpool, really, but we want these in a header that gets scanned
 * for our typelib.
 */
VIPS_API
void vips_concurrency_set( int concurrency );
VIPS_API
int vips_concurrency_get( void );

VIPS_API
void vips_operation_block_set( const char *name, gboolean state );

#ifdef __cplusplus
}
#endif /*__cplusplus*/

#endif /*VIPS_OPERATION_H*/
