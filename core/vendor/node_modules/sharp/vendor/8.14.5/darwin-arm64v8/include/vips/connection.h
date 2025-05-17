/* A byte source/sink .. it can be a pipe, socket, or perhaps a node.js stream.
 *
 * J.Cupitt, 19/6/14
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

#ifndef VIPS_CONNECTION_H
#define VIPS_CONNECTION_H

#include <glib.h>
#include <glib-object.h>
#include <gio/gio.h>
#include <vips/object.h>
#include <vips/type.h>

#ifdef __cplusplus
extern "C" {
#endif /*__cplusplus*/

#define VIPS_TYPE_CONNECTION (vips_connection_get_type())
#define VIPS_CONNECTION( obj ) \
	(G_TYPE_CHECK_INSTANCE_CAST( (obj), \
	VIPS_TYPE_CONNECTION, VipsConnection ))
#define VIPS_CONNECTION_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_CAST( (klass), \
	VIPS_TYPE_CONNECTION, VipsConnectionClass))
#define VIPS_IS_CONNECTION( obj ) \
	(G_TYPE_CHECK_INSTANCE_TYPE( (obj), VIPS_TYPE_CONNECTION ))
#define VIPS_IS_CONNECTION_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_TYPE( (klass), VIPS_TYPE_CONNECTION ))
#define VIPS_CONNECTION_GET_CLASS( obj ) \
	(G_TYPE_INSTANCE_GET_CLASS( (obj), \
	VIPS_TYPE_CONNECTION, VipsConnectionClass ))

/* Communicate with something like a socket or pipe. 
 */
typedef struct _VipsConnection {
	VipsObject parent_object;

	/*< private >*/

	/* Read/write this fd if connected to a system pipe/socket. Override
	 * ::read() and ::write() to do something else.
	 */
	int descriptor;	

	/* A descriptor we close with vips_tracked_close().
	 */
	int tracked_descriptor;	

	/* A descriptor we close with close().
	 */
	int close_descriptor;	

	/* If descriptor is a file, the filename we opened. Handy for error
	 * messages. 
	 */
	char *filename; 

} VipsConnection;

typedef struct _VipsConnectionClass {
	VipsObjectClass parent_class;

} VipsConnectionClass;

VIPS_API
GType vips_connection_get_type( void );

VIPS_API
const char *vips_connection_filename( VipsConnection *connection );
VIPS_API
const char *vips_connection_nick( VipsConnection *connection );

VIPS_API
void vips_pipe_read_limit_set( gint64 limit );

#define VIPS_TYPE_SOURCE (vips_source_get_type())
#define VIPS_SOURCE( obj ) \
	(G_TYPE_CHECK_INSTANCE_CAST( (obj), \
	VIPS_TYPE_SOURCE, VipsSource ))
#define VIPS_SOURCE_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_CAST( (klass), \
	VIPS_TYPE_SOURCE, VipsSourceClass))
#define VIPS_IS_SOURCE( obj ) \
	(G_TYPE_CHECK_INSTANCE_TYPE( (obj), VIPS_TYPE_SOURCE ))
#define VIPS_IS_SOURCE_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_TYPE( (klass), VIPS_TYPE_SOURCE ))
#define VIPS_SOURCE_GET_CLASS( obj ) \
	(G_TYPE_INSTANCE_GET_CLASS( (obj), \
	VIPS_TYPE_SOURCE, VipsSourceClass ))

/* Read from something like a socket, file or memory area and present the data
 * with a unified seek / read / map interface.
 *
 * During the header phase, we save data from unseekable sources in a buffer
 * so readers can rewind and read again. We don't buffer data during the
 * decode stage.
 */
struct _VipsSource {
	VipsConnection parent_object;

	/* We have two phases: 
	 *
	 * During the header phase, we save bytes read from the input (if this
	 * is an unseekable source) so that we can rewind and try again, if
	 * necessary.
	 *
	 * Once we reach decode phase, we no longer support rewind and the
	 * buffer of saved data is discarded.
	 */
	gboolean decode;

	/* TRUE if this input is something like a pipe. These don't support
	 * seek or map -- all you can do is read() bytes sequentially.
	 *
	 * If you attempt to map or get the size of a pipe-style input, it'll 
	 * get read entirely into memory. Seeks will cause read up to the seek
	 * point.
	 */
	gboolean have_tested_seek;
	gboolean is_pipe;

	/* The current read point and length.
	 *
	 * length is -1 for is_pipe sources.
	 *
	 * off_t can be 32 bits on some platforms, so make sure we have a 
	 * full 64.
	 */
	gint64 read_position;
	gint64 length;

	/*< private >*/

	/* For sources where we have the whole image in memory (from a memory
	 * buffer, from mmaping the file, from reading the pipe into memory), 
	 * a pointer to the start.
	 */
	const void *data;

	/* For is_pipe sources, save data read during header phase here. If 
	 * we rewind and try again, serve data from this until it runs out.
	 *
	 * If we need to force the whole pipe into memory, read everything to
	 * this and put a copy of the pointer in data.
	 */
	GByteArray *header_bytes;

	/* Save the first few bytes here for file type sniffing.
	 */
	GByteArray *sniff;

	/* For a memory source, the blob we read from. 
	 */
	VipsBlob *blob;

	/* If we mmaped the file, what we need to unmmap on finalize.
	 */
	void *mmap_baseaddr;
	size_t mmap_length;

};

typedef struct _VipsSourceClass {
	VipsConnectionClass parent_class;

	/* Subclasses can define these to implement other source methods.
	 */

	/* Read from the source into the supplied buffer, args exactly as
	 * read(2). Set errno on error.
	 *
	 * We must return gint64, since ssize_t is often defined as unsigned
	 * on Windows.
	 */
	gint64 (*read)( VipsSource *, void *, size_t );

	/* Seek to a certain position, args exactly as lseek(2). Set errno on
	 * error.
	 *
	 * Unseekable sources should always return -1. VipsSource will then
	 * seek by _read()ing bytes into memory as required.
	 *
	 * We have to use int64 rather than off_t, since we must work on
	 * Windows, where off_t can be 32-bits.
	 */
	gint64 (*seek)( VipsSource *, gint64, int );

} VipsSourceClass;

VIPS_API
GType vips_source_get_type( void );

VIPS_API
VipsSource *vips_source_new_from_descriptor( int descriptor );
VIPS_API
VipsSource *vips_source_new_from_file( const char *filename );
VIPS_API
VipsSource *vips_source_new_from_blob( VipsBlob *blob );
VIPS_API
VipsSource *vips_source_new_from_target( VipsTarget *target );
VIPS_API
VipsSource *vips_source_new_from_memory( const void *data, size_t size );
VIPS_API
VipsSource *vips_source_new_from_options( const char *options );

VIPS_API
void vips_source_minimise( VipsSource *source );
VIPS_API
int vips_source_unminimise( VipsSource *source );
VIPS_API
int vips_source_decode( VipsSource *source );
VIPS_API
gint64 vips_source_read( VipsSource *source, void *data, size_t length );
VIPS_API
gboolean vips_source_is_mappable( VipsSource *source );
VIPS_API
gboolean vips_source_is_file( VipsSource *source );
VIPS_API
const void *vips_source_map( VipsSource *source, size_t *length );
VIPS_API
VipsBlob *vips_source_map_blob( VipsSource *source );
VIPS_API
gint64 vips_source_seek( VipsSource *source, gint64 offset, int whence );
VIPS_API
int vips_source_rewind( VipsSource *source );
VIPS_API
gint64 vips_source_sniff_at_most( VipsSource *source, 
	unsigned char **data, size_t length );
VIPS_API
unsigned char *vips_source_sniff( VipsSource *source, size_t length );
VIPS_API
gint64 vips_source_length( VipsSource *source ); 

#define VIPS_TYPE_SOURCE_CUSTOM (vips_source_custom_get_type())
#define VIPS_SOURCE_CUSTOM( obj ) \
	(G_TYPE_CHECK_INSTANCE_CAST( (obj), \
	VIPS_TYPE_SOURCE_CUSTOM, VipsSourceCustom ))
#define VIPS_SOURCE_CUSTOM_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_CAST( (klass), \
	VIPS_TYPE_SOURCE_CUSTOM, VipsSourceCustomClass))
#define VIPS_IS_SOURCE_CUSTOM( obj ) \
	(G_TYPE_CHECK_INSTANCE_TYPE( (obj), VIPS_TYPE_SOURCE_CUSTOM ))
#define VIPS_IS_SOURCE_CUSTOM_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_TYPE( (klass), VIPS_TYPE_SOURCE_CUSTOM ))
#define VIPS_SOURCE_CUSTOM_GET_CLASS( obj ) \
	(G_TYPE_INSTANCE_GET_CLASS( (obj), \
	VIPS_TYPE_SOURCE_CUSTOM, VipsSourceCustomClass ))

/* Subclass of source_custom with signals for handlers. This is supposed to be
 * useful for language bindings.
 */
typedef struct _VipsSourceCustom {
	VipsSource parent_object;

} VipsSourceCustom;

typedef struct _VipsSourceCustomClass {
	VipsSourceClass parent_class;

	/* The action signals clients can use to implement read and seek.
	 * We must use gint64 everywhere since there's no G_TYPE_SIZE.
	 */

	gint64 (*read)( VipsSourceCustom *, void *, gint64 );
	gint64 (*seek)( VipsSourceCustom *, gint64, int );

} VipsSourceCustomClass;

VIPS_API
GType vips_source_custom_get_type( void );
VIPS_API
VipsSourceCustom *vips_source_custom_new( void );

/* A GInputStream that wraps a VipsSource. This lets us eg. 
 * hook librsvg up to libvips using their GInputStream interface.
 */

#define VIPS_TYPE_G_INPUT_STREAM (vips_g_input_stream_get_type())
#define VIPS_G_INPUT_STREAM( obj ) \
	(G_TYPE_CHECK_INSTANCE_CAST( (obj), \
	VIPS_TYPE_G_INPUT_STREAM, VipsGInputStream ))
#define VIPS_G_INPUT_STREAM_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_CAST( (klass), \
	VIPS_TYPE_G_INPUT_STREAM, VipsGInputStreamClass))
#define VIPS_IS_G_INPUT_STREAM( obj ) \
	(G_TYPE_CHECK_INSTANCE_TYPE( (obj), VIPS_TYPE_G_INPUT_STREAM ))
#define VIPS_IS_G_INPUT_STREAM_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_TYPE( (klass), VIPS_TYPE_G_INPUT_STREAM ))
#define VIPS_G_INPUT_STREAM_GET_CLASS( obj ) \
	(G_TYPE_INSTANCE_GET_CLASS( (obj), \
	VIPS_TYPE_G_INPUT_STREAM, VipsGInputStreamClass ))

typedef struct _VipsGInputStream {
	GInputStream parent_instance;

	/*< private >*/

	/* The VipsSource we wrap.
	 */
	VipsSource *source;

} VipsGInputStream;

typedef struct _VipsGInputStreamClass {
	GInputStreamClass parent_class;

} VipsGInputStreamClass;

VIPS_API
GInputStream *vips_g_input_stream_new_from_source( VipsSource *source );

/* A VipsSource that wraps a GInputStream. This lets us eg. load PNGs from 
 * GFile objects.
 */

#define VIPS_TYPE_SOURCE_G_INPUT_STREAM (vips_source_g_input_stream_get_type())
#define VIPS_SOURCE_G_INPUT_STREAM( obj ) \
	(G_TYPE_CHECK_INSTANCE_CAST( (obj), \
	VIPS_TYPE_SOURCE_G_INPUT_STREAM, VipsSourceGInputStream ))
#define VIPS_SOURCE_G_INPUT_STREAM_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_CAST( (klass), \
	VIPS_TYPE_SOURCE_G_INPUT_STREAM, VipsSourceGInputStreamClass))
#define VIPS_IS_SOURCE_G_INPUT_STREAM( obj ) \
	(G_TYPE_CHECK_INSTANCE_TYPE( (obj), VIPS_TYPE_SOURCE_G_INPUT_STREAM ))
#define VIPS_IS_SOURCE_G_INPUT_STREAM_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_TYPE( (klass), VIPS_TYPE_SOURCE_G_INPUT_STREAM ))
#define VIPS_SOURCE_G_INPUT_STREAM_GET_CLASS( obj ) \
	(G_TYPE_INSTANCE_GET_CLASS( (obj), \
	VIPS_TYPE_SOURCE_G_INPUT_STREAM, VipsSourceGInputStreamClass ))

typedef struct _VipsSourceGInputStream {
	VipsSource parent_instance;

	/*< private >*/

	/* The GInputStream we wrap.
	 */
	GInputStream *stream;

	GSeekable *seekable;
	GFileInfo *info;

} VipsSourceGInputStream;

typedef struct _VipsSourceGInputStreamClass {
	VipsSourceClass parent_class;

} VipsSourceGInputStreamClass;

VIPS_API
VipsSourceGInputStream *vips_source_g_input_stream_new( GInputStream *stream );

#define VIPS_TYPE_TARGET (vips_target_get_type())
#define VIPS_TARGET( obj ) \
	(G_TYPE_CHECK_INSTANCE_CAST( (obj), \
	VIPS_TYPE_TARGET, VipsTarget ))
#define VIPS_TARGET_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_CAST( (klass), \
	VIPS_TYPE_TARGET, VipsTargetClass))
#define VIPS_IS_TARGET( obj ) \
	(G_TYPE_CHECK_INSTANCE_TYPE( (obj), VIPS_TYPE_TARGET ))
#define VIPS_IS_TARGET_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_TYPE( (klass), VIPS_TYPE_TARGET ))
#define VIPS_TARGET_GET_CLASS( obj ) \
	(G_TYPE_INSTANCE_GET_CLASS( (obj), \
	VIPS_TYPE_TARGET, VipsTargetClass ))

/* PNG writes in 8kb chunks, so we need to be a little larger than that.
 */
#define VIPS_TARGET_BUFFER_SIZE (8500)

/* Output to something like a socket, pipe or memory area. 
 */
struct _VipsTarget {
	VipsConnection parent_object;

	/*< private >*/

	/* This target should write to memory.
	 */
	gboolean memory;

	/* The target has been ended and can no longer be written.
	 */
	gboolean ended;

	/* Write memory output here. We use a GString rather than a 
	 * GByteArray since we need eg. g_string_overwrite_len().
	 * @position tracks the current write position in this.
	 */
	GString *memory_buffer;

	/* And return memory via this blob.
	 */
	VipsBlob *blob;

	/* Buffer small writes here. write_point is the index of the next
	 * character to write.
	 */
	unsigned char output_buffer[VIPS_TARGET_BUFFER_SIZE];
	int write_point;

	/* Write position in memory_buffer.
	 */
	off_t position;

	/* Temp targets on the filesystem need deleting, sometimes.
	 */
	gboolean delete_on_close;
	char *delete_on_close_filename;

};

typedef struct _VipsTargetClass {
	VipsConnectionClass parent_class;

	/* Write to output. Args exactly as write(2).
	 *
	 * We must return gint64, since ssize_t is often defined as unsigned
	 * on Windows.
	 */
	gint64 (*write)( VipsTarget *, const void *, size_t );

	/* Deprecated in favour of ::end.
	 */
	void (*finish)( VipsTarget * );

	/* libtiff needs to be able to seek and read on targets,
	 * unfortunately. 
	 *
	 * This will not work for eg. pipes, of course.
	 */

	/* Read from the target into the supplied buffer, args exactly as
	 * read(2). Set errno on error.
	 *
	 * We must return gint64, since ssize_t is often defined as unsigned
	 * on Windows.
	 */
	gint64 (*read)( VipsTarget *, void *, size_t );

	/* Seek output. Args exactly as lseek(2).
	 */
	off_t (*seek)( VipsTarget *, off_t offset, int whence);

	/* Output has been generated, so do any clearing up,
	 * eg. copy the bytes we saved in memory to the target blob.
	 */
	int (*end)( VipsTarget * );

} VipsTargetClass;

VIPS_API
GType vips_target_get_type( void );

VIPS_API
VipsTarget *vips_target_new_to_descriptor( int descriptor );
VIPS_API
VipsTarget *vips_target_new_to_file( const char *filename );
VIPS_API
VipsTarget *vips_target_new_to_memory( void );
VIPS_API
VipsTarget *vips_target_new_temp( VipsTarget *target );
VIPS_API
int vips_target_write( VipsTarget *target, const void *data, size_t length );
VIPS_API
gint64 vips_target_read( VipsTarget *target, void *buffer, size_t length );
VIPS_API
off_t vips_target_seek( VipsTarget *target, off_t offset, int whence );
VIPS_API
int vips_target_end( VipsTarget *target );
VIPS_DEPRECATED_FOR(vips_target_end)
void vips_target_finish( VipsTarget *target );
VIPS_API
unsigned char *vips_target_steal( VipsTarget *target, size_t *length );
VIPS_API
char *vips_target_steal_text( VipsTarget *target );

VIPS_API
int vips_target_putc( VipsTarget *target, int ch );
#define VIPS_TARGET_PUTC( S, C ) ( \
	(S)->write_point < VIPS_TARGET_BUFFER_SIZE ? \
	((S)->output_buffer[(S)->write_point++] = (C), 0) : \
	vips_target_putc( (S), (C) ) \
)
VIPS_API
int vips_target_writes( VipsTarget *target, const char *str );
VIPS_API
int vips_target_writef( VipsTarget *target, const char *fmt, ... )
	G_GNUC_PRINTF( 2, 3 );
VIPS_API
int vips_target_write_amp( VipsTarget *target, const char *str );

#define VIPS_TYPE_TARGET_CUSTOM (vips_target_custom_get_type())
#define VIPS_TARGET_CUSTOM( obj ) \
	(G_TYPE_CHECK_INSTANCE_CAST( (obj), \
	VIPS_TYPE_TARGET_CUSTOM, VipsTargetCustom ))
#define VIPS_TARGET_CUSTOM_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_CAST( (klass), \
	VIPS_TYPE_TARGET_CUSTOM, VipsTargetCustomClass))
#define VIPS_IS_TARGET_CUSTOM( obj ) \
	(G_TYPE_CHECK_INSTANCE_TYPE( (obj), VIPS_TYPE_TARGET_CUSTOM ))
#define VIPS_IS_TARGET_CUSTOM_CLASS( klass ) \
	(G_TYPE_CHECK_CLASS_TYPE( (klass), VIPS_TYPE_TARGET_CUSTOM ))
#define VIPS_TARGET_CUSTOM_GET_CLASS( obj ) \
	(G_TYPE_INSTANCE_GET_CLASS( (obj), \
	VIPS_TYPE_TARGET_CUSTOM, VipsTargetCustomClass ))

#define VIPS_TARGET_CUSTOM_BUFFER_SIZE (4096)

/* Output to something like a socket, pipe or memory area. 
 */
typedef struct _VipsTargetCustom {
	VipsTarget parent_object;

} VipsTargetCustom;

typedef struct _VipsTargetCustomClass {
	VipsTargetClass parent_class;

	/* The action signals clients can use to implement write and finish.
	 * We must use gint64 everywhere since there's no G_TYPE_SIZE.
	 */

	gint64 (*write)( VipsTargetCustom *, const void *, gint64 );
	void (*finish)( VipsTargetCustom * );
	gint64 (*read)( VipsTargetCustom *, void *, gint64 );
	gint64 (*seek)( VipsTargetCustom *, gint64, int );
	int (*end)( VipsTargetCustom * );

} VipsTargetCustomClass;

VIPS_API
GType vips_target_custom_get_type( void );
VIPS_API
VipsTargetCustom *vips_target_custom_new( void );

#ifdef __cplusplus
}
#endif /*__cplusplus*/

#endif /*VIPS_CONNECTION_H*/
