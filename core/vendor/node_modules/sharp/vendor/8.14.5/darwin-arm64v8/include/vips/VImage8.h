// VIPS image wrapper

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

#ifndef VIPS_VIMAGE_H
#define VIPS_VIMAGE_H

#include <list>
#include <complex>
#include <vector>

#include <cstring>

#include <vips/vips.h>

VIPS_NAMESPACE_START

/* Small utility things.
 */

VIPS_CPLUSPLUS_API std::vector<double> to_vectorv( int n, ... );
VIPS_CPLUSPLUS_API std::vector<double> to_vector( double value );
VIPS_CPLUSPLUS_API std::vector<double> to_vector( int n, double array[] );
VIPS_CPLUSPLUS_API std::vector<double> negate( std::vector<double> value );
VIPS_CPLUSPLUS_API std::vector<double> invert( std::vector<double> value );

/**
 * Whether or not VObject should take over the reference that you pass in. See
 * VObject().
 */
enum VSteal {
	NOSTEAL = 0,
	STEAL = 1
};

/**
 * A smart VipsObject pointer. It calls g_object_ref()/_unref() for you
 * automatically.
 *
 * VObjects can be null (have no value set). See is_null().
 */
class VObject
{
private:
	// can be NULL, see eg. VObject()
	VipsObject *vobject; 

public:
	/**
	 * Wrap a VObject around the underlying VipsObject pointer.
	 *
	 * If steal is STEAL, then the new VObject takes over the reference
	 * that you pass in.
	 */
	VObject( VipsObject *new_vobject, VSteal steal = STEAL ) : 
		vobject( new_vobject )
	{
		// we allow NULL init, eg. "VImage a;"
		g_assert( !new_vobject ||
			VIPS_IS_OBJECT( new_vobject ) ); 

#ifdef VIPS_DEBUG_VERBOSE
		printf( "VObject constructor, obj = %p, steal = %d\n",
			new_vobject, steal ); 
		if( new_vobject ) { 
			printf( "   obj " ); 
			vips_object_print_name( VIPS_OBJECT( new_vobject ) );
			printf( "\n" ); 
		}
#endif /*VIPS_DEBUG_VERBOSE*/

		if( !steal && vobject ) {
#ifdef VIPS_DEBUG_VERBOSE
			printf( "   reffing object\n" ); 
#endif /*VIPS_DEBUG_VERBOSE*/
			g_object_ref( vobject ); 
		}
	}

	VObject() :
		vobject( 0 )
	{
	}

	VObject( const VObject &a ) : 
		vobject( a.vobject )
	{
		g_assert( !vobject ||
			VIPS_IS_OBJECT( vobject ) );

#ifdef VIPS_DEBUG_VERBOSE
		printf( "VObject copy constructor, obj = %p\n", 
			vobject ); 
		printf( "   reffing object\n" ); 
#endif /*VIPS_DEBUG_VERBOSE*/
		if( vobject )
			g_object_ref( vobject );
	}

	// assignment ... we must delete the old ref
	VObject &operator=( const VObject &a )
	{
#ifdef VIPS_DEBUG_VERBOSE
		printf( "VObject assignment\n" );  
		printf( "   reffing %p\n", a.vobject ); 
		printf( "   unreffing %p\n", vobject ); 
#endif /*VIPS_DEBUG_VERBOSE*/

		g_assert( !vobject ||
			VIPS_IS_OBJECT( vobject ) ); 
		g_assert( !a.vobject ||
			VIPS_IS_OBJECT( a.vobject ) ); 

		// delete the old ref at the end ... otherwise "a = a;" could
		// unref before reffing again 
		if( a.vobject )
			g_object_ref( a.vobject );
		if( vobject )
			g_object_unref( vobject );
		vobject = a.vobject;

		return( *this ); 
	}

	// this mustn't be virtual: we want this class to only be a pointer,
	// no vtable allowed
	~VObject()
	{
#ifdef VIPS_DEBUG_VERBOSE
		printf( "VObject destructor\n" );  
		printf( "   unreffing %p\n", vobject ); 
#endif /*VIPS_DEBUG_VERBOSE*/

		g_assert( !vobject ||
			VIPS_IS_OBJECT( vobject ) ); 
		
		if( vobject ) 
			g_object_unref( vobject ); 
	}

	/**
	 * Return the underlying VipsObject pointer. This does not make a new
	 * reference -- you'll need to g_object_ref() the result if you want
	 * to keep it.
	 */
	VipsObject *
	get_object() const
	{
		g_assert( !vobject ||
			VIPS_IS_OBJECT( vobject ) ); 

		return( vobject ); 
	}

	/**
	 * TRUE if this is a null VObject.
	 */
	bool is_null() const
	{
		return vobject == 0;
	}

};

class VIPS_CPLUSPLUS_API VImage;
class VIPS_CPLUSPLUS_API VInterpolate;
class VIPS_CPLUSPLUS_API VRegion;
class VIPS_CPLUSPLUS_API VSource;
class VIPS_CPLUSPLUS_API VTarget;
class VIPS_CPLUSPLUS_API VOption;

/**
 * A list of name-value pairs. Pass these to libvips operations to set
 * options. For example:
 *
 *     VImage out = in.embed( 10, 10, 1000, 1000, VImage::option()
 *         ->set( "extend", "background" )
 *         ->set( "background", 128 ) );
 *
 * The `set` member functions will take copies (or hold references to)
 * compound objects, so you can free them immediately afterwards if necessary.
 *
 * You can get values back from operations by using the * form of the set
 * member functions. For example:
 *
 *     VImage in = VImage::new_from_file( argv[1] );
 *     int x, y;
 *     double value = in.max( VImage::option()
 *         set( "x", &x )
 *         set( "y", &y ) );
 *
 */
class VOption {
private:
	struct Pair {
		const char *name;

		// the thing we pass to and from our caller
		GValue value; 

		// an input or output parameter ... we guess the direction
		// from the arg to set()
		bool input; 

		// the pointer we write output values to
		union {
			bool *vbool;
			int *vint;
			double *vdouble;
			VImage *vimage;
			std::vector<double> *vvector;
			VipsBlob **vblob;
		}; 

		Pair( const char *name ) : 
			name( name ), input( false ), vimage( 0 )
		{
			// argh = {0} won't work wil vanilla C++
			memset( &value, 0, sizeof( GValue ) ); 
		}

		~Pair()
		{
			g_value_unset( &value );
		}
	};

	std::list<Pair *> options;

public:
	VOption()
	{
	}

	virtual ~VOption();

	/**
	 * Set an input boolean option.
	 */
	VOption *
	set( const char *name, bool value ); 

	/**
	 * Set an input int option. This is used for enums as well, or you can
	 * use the string version.
	 */
	VOption *
	set( const char *name, int value );

	/** 
	 * Set an input unsigned 64-bit integer option.
	 */
	VOption *
	set( const char *name, guint64 value );

	/**
	 * Set an input double option.
	 */
	VOption *
	set( const char *name, double value );

	/**
	 * Set an input string option. 
	 *
	 * A copy is taken of the object.
	 */
	VOption *
	set( const char *name, const char *value );

	/**
	 * Set a libvips object as an option. These can be images, sources,
	 * targets, etc.
	 *
	 * A copy is taken of the object.
	 */
	VOption *
	set( const char *name, const VObject value );

	/**
	 * Set an array of integers as an input option.
	 *
	 * A copy is taken of the object.
	 */
	VOption *
	set( const char *name, std::vector<int> value );

	/**
	 * Set an array of doubles as an input option.
	 *
	 * A copy is taken of the object.
	 */
	VOption *
	set( const char *name, std::vector<double> value );

	/**
	 * Set an array of images as an input option.
	 *
	 * A copy is taken of the object.
	 */
	VOption *
	set( const char *name, std::vector<VImage> value );

	/**
	 * Set a binary object an input option. Use vips_blob_new() to make
	 * blobs. 
	 *
	 * A copy is taken of the object.
	 */
	VOption *
	set( const char *name, VipsBlob *value ); 

	/**
	 * Set an option which will return a bool value.
	 */
	VOption *
	set( const char *name, bool *value ); 

	/**
	 * Set an option which will return an integer value.
	 */
	VOption *
	set( const char *name, int *value );

	/**
	 * Set an option which will return a double value.
	 */
	VOption *
	set( const char *name, double *value );

	/**
	 * Set an option which will return a reference to an image. 
	 */
	VOption *
	set( const char *name, VImage *value );

	/**
	 * Set an option which will return an array of doubles.
	 */
	VOption *
	set( const char *name, std::vector<double> *value );

	/**
	 * Set an option which will return a binary object, such as an ICC
	 * profile.
	 */
	VOption *
	set( const char *name, VipsBlob **blob ); 

	/**
	 * Walk the set of options, setting options on the operation. This is
	 * used internally by VImage::call().
	 */
	void 
	set_operation( VipsOperation *operation );

	/**
	 * Walk the set of options, fetching any output values. This is used
	 * internally by VImage::call().
	 */
	void 
	get_operation( VipsOperation *operation );

};

/**
 * An image object. 
 *
 * Image processing operations on images are member functions of VImage. For
 * example:
 *
 *     VImage in = VImage::new_from_file( argv[1], VImage::option()
 *         ->set( "access", "sequential" ) ); 
 *     VImage out = in.embed( 10, 10, 1000, 1000, VImage::option()
 *         ->set( "extend", "copy" ) );
 *     out.write_to_file( argv[2] );
 *
 * VImage objects are smart pointers over the underlying VipsImage objects. 
 * They manage the complications of GLib's ref and unref system for you.
 */
class VImage : public VObject
{
public:
	using VObject::is_null;

	/**
	 * Wrap a VImage around an underlying VipsImage object. 
	 *
	 * If steal is STEAL, then the VImage will take ownership of the 
	 * reference to the VipsImage.
	 */
	VImage( VipsImage *image, VSteal steal = STEAL ) : 
		VObject( (VipsObject *) image, steal )
	{
	}

	/**
	 * An empty (NULL) VImage, eg. "VImage a;"
	 */
	VImage() :
		VObject( 0 )
	{
	}

	/**
	 * Return the underlying VipsImage reference that this VImage holds.
	 * This does not make a new reference -- you'll need to g_object_ref()
	 * the pointer if you need it to last.
	 */
	VipsImage * 
	get_image() const
	{
		return( (VipsImage *) VObject::get_object() );
	}

	/**
	 * Return the width of the image in pixels.
	 */
	int 
	width() const
	{
		return( vips_image_get_width( get_image() ) ); 
	}

	/**
	 * Return the height of the image in pixels.
	 */
	int 
	height() const
	{
		return( vips_image_get_height( get_image() ) ); 
	}

	/**
	 * Return the number of image bands.
	 */
	int 
	bands() const
	{
		return( vips_image_get_bands( get_image() ) ); 
	}

	/**
	 * Return the image format, for example VIPS_FORMAT_UCHAR.
	 */
	VipsBandFormat 
	format() const
	{
		return( vips_image_get_format( get_image() ) ); 
	}

	/**
	 * Return the image coding, for example VIPS_CODING_NONE.
	 */
	VipsCoding 
	coding() const
	{
		return( vips_image_get_coding( get_image() ) ); 
	}

	/**
	 * Return the image interpretation, for example
	 * VIPS_INTERPRETATION_sRGB.
	 */
	VipsInterpretation 
	interpretation() const
	{
		return( vips_image_get_interpretation( get_image() ) ); 
	}

	/**
	 * Try to guess the image interpretation from other fields. This is
	 * handy if the interpretation has not been set correctly.
	 */
	VipsInterpretation 
	guess_interpretation() const
	{
		return( vips_image_guess_interpretation( get_image() ) ); 
	}

	/**
	 * The horizontal resolution in pixels per millimeter.
	 */
	double 
	xres() const
	{
		return( vips_image_get_xres( get_image() ) ); 
	}

	/**
	 * The vertical resolution in pixels per millimeter.
	 */
	double 
	yres() const
	{
		return( vips_image_get_yres( get_image() ) ); 
	}

	/**
	 * The horizontal offset of the origin in pixels.
	 */
	int
	xoffset() const
	{
		return( vips_image_get_xoffset( get_image() ) ); 
	}

	/**
	 * The vertical offset of the origin in pixels.
	 */
	int
	yoffset() const
	{
		return( vips_image_get_yoffset( get_image() ) ); 
	}

	/**
	 * TRUE if the image has an alpha channel.
	 */
	bool
	has_alpha() const
	{
		return( vips_image_hasalpha( get_image() ) );
	}

	/**
	 * The name of the file this image originally came from, or NULL if 
	 * it's not a file image. 
	 */
	const char *
	filename() const
	{
		return( vips_image_get_filename( get_image() ) ); 
	}

	/**
	 * Arrange for the underlying object to be entirely in memory, then
	 * return a pointer to the first pixel.
	 * 
	 * This can take a long time and need a very large amount of RAM.
	 */
	const void *
	data() const
	{
		return( vips_image_get_data( get_image() ) ); 
	}

	/**
	 * Set the value of an int metadata item on an image.
	 */
	void 
	set( const char *field, int value )
	{
		vips_image_set_int( this->get_image(), field, value ); 
	}

	/**
	 * Set the value of an int array metadata item on an image.
	 *
	 * A copy of the array is taken.
	 */
	void 
	set( const char *field, int *value, int n )
	{
		vips_image_set_array_int( this->get_image(), field, value, n ); 
	}

	/**
	 * Set the value of an int array metadata item on an image.
	 *
	 * A copy of the array is taken.
	 */
	void 
	set( const char *field, std::vector<int> value )
	{
		vips_image_set_array_int( this->get_image(), field, &value[0],
			static_cast<int>( value.size() ) );
	}

	/**
	 * Set the value of an double array metadata item on an image.
	 *
	 * A copy of the array is taken.
	 */
	void
	set( const char *field, double *value, int n )
	{
		vips_image_set_array_double( this->get_image(), field, value, n );
	}

	/**
	 * Set the value of an double array metadata item on an image.
	 *
	 * A copy of the array is taken.
	 */
	void
	set( const char *field, std::vector<double> value )
	{
		vips_image_set_array_double( this->get_image(), field, &value[0],
			static_cast<int>( value.size() ) );
	}

	/**
	 * Set the value of a double metadata item on an image.
	 */
	void 
	set( const char *field, double value )
	{
		vips_image_set_double( this->get_image(), field, value ); 
	}

	/**
	 * Set the value of a string metadata item on an image.
	 *
	 * A copy of the string is taken.
	 */
	void 
	set( const char *field, const char *value )
	{
		vips_image_set_string( this->get_image(), field, value ); 
	}

	/**
	 * Set the value of a binary object metadata item on an image, such as
	 * an ICC profile.
	 *
	 * When libvips no longer needs the value, it will be disposed with
	 * the free function. This can be NULL.
	 */
	void 
	set( const char *field, 
		VipsCallbackFn free_fn, void *data, size_t length )
	{
		vips_image_set_blob( this->get_image(), field, 
			free_fn, data, length ); 
	}

	/**
	 * Return the GType of a metadata item, or 0 if the named item does not
	 * exist.
	 */
	GType 
	get_typeof( const char *field ) const
	{
		return( vips_image_get_typeof( this->get_image(), field ) ); 
	}

	/**
	 * Get the value of a metadata item as an int. 
	 *
	 * If the item is not of this type, an exception is thrown.
	 */
	int 
	get_int( const char *field ) const
	{
		int value;

		if( vips_image_get_int( this->get_image(), field, &value ) )
			throw( VError() ); 

		return( value ); 
	}

	/**
	 * Get the value of a metadata item as an array of ints. Do not free
	 * the result. 
	 *
	 * If the item is not of this type, an exception is thrown.
	 */
	void
	get_array_int( const char *field, int **out, int *n ) const
	{
		if( vips_image_get_array_int( this->get_image(), 
			field, out, n ) )
			throw( VError() ); 
	}

	/**
	 * Get the value of a metadata item as an array of ints. 
	 *
	 * If the item is not of this type, an exception is thrown.
	 */
	std::vector<int> 
	get_array_int( const char *field ) const
	{
		int length;
		int *array;

		if( vips_image_get_array_int( this->get_image(), 
			field, &array, &length ) )
			throw( VError() ); 

		std::vector<int> vector( array, array + length );

		return( vector );
	}

	/**
	 * Get the value of a metadata item as an array of doubles. Do not free
	 * the result. 
	 *
	 * If the item is not of this type, an exception is thrown.
	 */
	void
	get_array_double( const char *field, double **out, int *n ) const
	{
		if( vips_image_get_array_double( this->get_image(),
			field, out, n ) )
			throw( VError() );
	}

	/**
	 * Get the value of a metadata item as an array of doubles. 
	 *
	 * If the item is not of this type, an exception is thrown.
	 */
	std::vector<double>
	get_array_double( const char *field ) const
	{
		int length;
		double *array;

		if( vips_image_get_array_double( this->get_image(),
			field, &array, &length ) )
			throw( VError() );

		std::vector<double> vector( array, array + length );

		return( vector );
	}

	/**
	 * Get the value of a metadata item as a double.
	 *
	 * If the item is not of this type, an exception is thrown.
	 */
	double 
	get_double( const char *field ) const
	{
		double value;

		if( vips_image_get_double( this->get_image(), field, &value ) )
			throw( VError() ); 

		return( value ); 
	}

	/**
	 * Get the value of a metadata item as a string. You must not free the
	 * result.
	 *
	 * If the item is not of this type, an exception is thrown.
	 */
	const char *
	get_string( const char *field ) const
	{
		const char *value; 

		if( vips_image_get_string( this->get_image(), field, &value ) )
			throw( VError() ); 

		return( value ); 
	}

	/**
	 * Get the value of a metadata item as a binary object. You must not 
	 * free the result.
	 *
	 * If the item is not of this type, an exception is thrown.
	 */
	const void *
	get_blob( const char *field, size_t *length ) const
	{
		const void *value; 

		if( vips_image_get_blob( this->get_image(), field, 
			&value, length ) )
			throw( VError() ); 

		return( value ); 
	}

	/**
	 * Remove a metadata item. This does nothing if the item does not
	 * exist.
	 */
	bool
	remove( const char *name ) const
	{
		return( vips_image_remove( get_image(), name ) );
	}

	/**
	 * Make a new VOption. Can save some typing.
	 */
	static VOption *
	option()
	{
		return( new VOption() );
	}

	/**
	 * Call any libvips operation, with a set of string-encoded options as
	 * well as VOption.
	 */
	static void 
	call_option_string( const char *operation_name, 
		const char *option_string, VOption *options = 0 );

	/**
	 * Call any libvips operation.
	 */
	static void 
	call( const char *operation_name, VOption *options = 0 );

	/**
	 * Make a new image which, when written to, will create a large memory
	 * object. See VImage::write().
	 */
	static VImage 
	new_memory()
	{
		return( VImage( vips_image_new_memory() ) ); 
	}

	/**
	 * Make a new VImage which, when written to, will craete a temporary
	 * file on disc. See VImage::write().
	 */
	static VImage 
	new_temp_file( const char *file_format = ".v" )
	{
		VipsImage *image;

		if( !(image = vips_image_new_temp_file( file_format )) )
			throw( VError() ); 

		return( VImage( image ) ); 
	}

	/**
	 * Create a new VImage object from a file on disc.
	 *
	 * The available options depends on the image format. See for example
	 * VImage::jpegload().
	 */
	static VImage 
	new_from_file( const char *name, VOption *options = 0 );

	/**
	 * Create a new VImage object from an area of memory containing an
	 * image encoded in some format such as JPEG.
	 *
	 * The available options depends on the image format. See for example
	 * VImage::jpegload().
	 */
	static VImage 
	new_from_buffer( const void *buf, size_t len,
		const char *option_string, VOption *options = 0 );

	/**
	 * Create a new VImage object from an area of memory containing an
	 * image encoded in some format such as JPEG.
	 *
	 * The available options depends on the image format. See for example
	 * VImage::jpegload().
	 */
	static VImage 
	new_from_buffer( const std::string &buf,
		const char *option_string, VOption *options = 0 );

	/**
	 * Create a new VImage object from a generic source object.
	 *
	 * The available options depends on the image format. See for example
	 * VImage::jpegload().
	 */
	static VImage 
	new_from_source( VSource source, 
		const char *option_string, VOption *options = 0 );

	/**
	 * Create a new VImage object from an area of memory containing a
	 * C-style array.
	 */
	static VImage 
	new_from_memory( void *data, size_t size,
		int width, int height, int bands, VipsBandFormat format )
	{
		VipsImage *image;

		if( !(image = vips_image_new_from_memory( data, size, 
			width, height, bands, format )) )
			throw( VError() ); 

		return( VImage( image ) ); 
	}

	/**
	 * Create a new VImage object from an area of memory containing a
	 * C-style array.
	 *
	 * The VImage steals ownership of @data and will free() it when it
	 * goes out of scope.
	 */
	static VImage 
	new_from_memory_steal( void *data, size_t size,
		int width, int height, int bands, VipsBandFormat format );

	/**
	 * Create a matrix image of a specified size. All elements will be
	 * zero.
	 */
	static VImage
	new_matrix( int width, int height );

	/**
	 * Create a matrix image of a specified size, initialized from the
	 * array.
	 */
	static VImage 
	new_matrix( int width, int height, double *array, int size )
	{
		VipsImage *image;

		if( !(image = vips_image_new_matrix_from_array( width, height,
			array, size )) )
			throw( VError() ); 

		return( VImage( image ) ); 
	}

	/**
	 * Create a matrix image of a specified size, initialized from the
	 * function parameters.
	 */
	static VImage 
	new_matrixv( int width, int height, ... );

	/**
	 * Make a new image of the same size and type as self, but with each
	 * pixel initialized with the constant.
	 */
	VImage 
	new_from_image( std::vector<double> pixel ) const
	{
		VipsImage *image;

		if( !(image = vips_image_new_from_image( this->get_image(), 
			&pixel[0], static_cast<int>( pixel.size() ) )) )
			throw( VError() ); 

		return( VImage( image ) ); 
	}

	/**
	 * Make a new image of the same size and type as self, but with each
	 * pixel initialized with the constant.
	 */
	VImage 
	new_from_image( double pixel ) const
	{
		return( new_from_image( to_vectorv( 1, pixel ) ) ); 
	}

	/**
	 * This operation allocates memory, renders self into it, builds a new
	 * image around the memory area, and returns that.
	 *
	 * If the image is already a simple area of memory, it does nothing.
	 *
	 * Call this before using the draw operations to make sure you have a
	 * memory image that can be modified.
	 *
	 * VImage::copy() adds a null "copy" node to a pipeline. Use that
	 * instead if you want to change metadata and not pixels.
	 */ 
	VImage 
	copy_memory() const
	{
		VipsImage *image;

		if( !(image = vips_image_copy_memory( this->get_image() )) )
			throw( VError() );

		return( VImage( image ) );
	}

	/**
	 * Write self to out. See VImage::new_memory() etc.
	 */
	VImage write( VImage out ) const;

	/**
	 * Write an image to a file.
	 *
	 * The available options depends on the file format. See
	 * VImage::jpegsave(), for example.
	 */
	void write_to_file( const char *name, VOption *options = 0 ) const;

	/**
	 * Write an image to an area of memory in the specified format. You
	 * must free() the memory area once you are done with it.
	 *
	 * For example:
	 *
	 *     void *buf;
	 *     size_t size;
	 *     image.write_to_buffer( ".jpg", &buf, &size );
	 *
	 * The available options depends on the file format. See
	 * VImage::jpegsave(), for example.
	 */
	void write_to_buffer( const char *suffix, void **buf, size_t *size, 
		VOption *options = 0 ) const;

	/**
	 * Write an image to a generic target object in the specified format. 
	 *
	 * The available options depends on the file format. See
	 * VImage::jpegsave(), for example.
	 */
	void write_to_target( const char *suffix, VTarget target, 
		VOption *options = 0 ) const;

	/**
	 * Write an image to an area of memory as a C-style array.
	 */
	void *
	write_to_memory( size_t *size ) const
	{
		void *result;

		if( !(result = vips_image_write_to_memory( this->get_image(), 
			size )) )
			throw( VError() ); 

		return( result ); 
	}

	/**
	 * Acquire an unprepared VRegion.
	 */
	VRegion
	region() const;

	/**
	 * Acquire VRegion covering the given VipsRect.
	 */
	VRegion
	region( VipsRect *rect ) const;

	/**
	 * Acquire VRegion covering the given coordinates.
	 */
	VRegion
	region( int left, int top, int width, int height ) const;

	/**
	 * Apply a linear transform to an image. For every pixel,
	 *
	 *     out = in * a + b
	 */
	VImage
	linear( double a, double b, VOption *options = 0 ) const
	{
		return( this->linear( to_vector( a ), to_vector( b ), 
			options ) ); 
	}

	/**
	 * Apply a linear transform to an image. For every pixel,
	 *
	 *     out = in * a + b
	 */
	VImage
	linear( std::vector<double> a, double b, VOption *options = 0 ) const
	{
		return( this->linear( a, to_vector( b ), options ) ); 
	}

	/**
	 * Apply a linear transform to an image. For every pixel,
	 *
	 *     out = in * a + b
	 */
	VImage
	linear( double a, std::vector<double> b, VOption *options = 0 ) const
	{
		return( this->linear( to_vector( a ), b, options ) ); 
	}

	/**
	 * Split a many-band image into an array of one-band images. 
	 */
	std::vector<VImage> bandsplit( VOption *options = 0 ) const;

	/**
	 * Join two images bandwise.
	 */
	VImage bandjoin( VImage other, VOption *options = 0 ) const;

	/**
	 * Append a band to an image, with each element initialized to the
	 * constant value.
	 */
	VImage
	bandjoin( double other, VOption *options = 0 ) const
	{
		return( bandjoin( to_vector( other ), options ) ); 
	}

	/**
	 * Append a series of bands to an image, with each element initialized 
	 * to the constant values.
	 */
	VImage
	bandjoin( std::vector<double> other, VOption *options = 0 ) const
	{
		return( bandjoin_const( other, options ) ); 
	}

	/**
	 * Composite other on top of self using the specified blending mode.
	 */
	VImage composite( VImage other, VipsBlendMode mode, 
		VOption *options = 0 ) const;

	/**
	 * Find the position of the image minimum as (x, y).
	 */
	std::complex<double> minpos( VOption *options = 0 ) const;

	/**
	 * Find the position of the image maximum as (x, y).
	 */
	std::complex<double> maxpos( VOption *options = 0 ) const;

	/**
	 * Flip the image left-right.
	 */
	VImage 
	fliphor( VOption *options = 0 ) const
	{
		return( flip( VIPS_DIRECTION_HORIZONTAL, options ) ); 
	}

	/**
	 * Flip the image top-bottom.
	 */
	VImage 
	flipver( VOption *options = 0 ) const
	{
		return( flip( VIPS_DIRECTION_VERTICAL, options ) ); 
	}

	/**
	 * Rotate the image by 90 degrees clockwise.
	 */
	VImage 
	rot90( VOption *options = 0 ) const
	{
		return( rot( VIPS_ANGLE_D90, options ) ); 
	}

	/**
	 * Rotate the image by 180 degrees.
	 */
	VImage 
	rot180( VOption *options = 0 ) const
	{
		return( rot( VIPS_ANGLE_D180, options ) ); 
	}

	/**
	 * Rotate the image by 270 degrees clockwise.
	 */
	VImage 
	rot270( VOption *options = 0 ) const
	{
		return( rot( VIPS_ANGLE_D270, options ) ); 
	}

	/**
	 * Dilate the image with the specified strucuring element, see
	 * VImage::new_matrix(). Stucturing element values can be 0 for 
	 * black, 255 for white and 128 for don't care. See VImage::morph().
	 */
	VImage 
	dilate( VImage mask, VOption *options = 0 ) const
	{
		return( morph( mask, VIPS_OPERATION_MORPHOLOGY_DILATE, 
			options ) ); 
	}

	/**
	 * Erode the image with the specified strucuring element, see
	 * VImage::new_matrix(). Stucturing element values can be 0 for 
	 * black, 255 for white and 128 for don't care. See VImage::morph().
	 */
	VImage 
	erode( VImage mask, VOption *options = 0 ) const
	{
		return( morph( mask, VIPS_OPERATION_MORPHOLOGY_ERODE, 
			options ) ); 
	}

	/**
	 * A median filter of the specified size. See VImage::rank().
	 */
	VImage 
	median( int size = 3, VOption *options = 0 ) const
	{
		return( rank( size, size, (size * size) / 2, options ) ); 
	}

	/**
	 * Convert to integer, rounding down.
	 */
	VImage 
	floor( VOption *options = 0 ) const
	{
		return( round( VIPS_OPERATION_ROUND_FLOOR, options ) ); 
	}

	/**
	 * Convert to integer, rounding up.
	 */
	VImage 
	ceil( VOption *options = 0 ) const
	{
		return( round( VIPS_OPERATION_ROUND_CEIL, options ) ); 
	}

	/**
	 * Convert to integer, rounding to nearest.
	 */
	VImage 
	rint( VOption *options = 0 ) const
	{
		return( round( VIPS_OPERATION_ROUND_RINT, options ) ); 
	}

	/**
	 * AND all bands of an image together to make a one-band image. Useful
	 * with the relational operators, for example:
	 *
	 *     VImage mask = (in > 128).bandand()
	 */
	VImage 
	bandand( VOption *options = 0 ) const
	{
		return( bandbool( VIPS_OPERATION_BOOLEAN_AND, options ) ); 
	}

	/**
	 * OR all bands of an image together to make a one-band image. Useful
	 * with the relational operators, for example:
	 *
	 *     VImage mask = (in > 128).bandand()
	 */
	VImage 
	bandor( VOption *options = 0 ) const
	{
		return( bandbool( VIPS_OPERATION_BOOLEAN_OR, options ) ); 
	}

	/**
	 * EOR all bands of an image together to make a one-band image. Useful
	 * with the relational operators, for example:
	 *
	 *     VImage mask = (in > 128).bandand()
	 */
	VImage 
	bandeor( VOption *options = 0 ) const
	{
		return( bandbool( VIPS_OPERATION_BOOLEAN_EOR, options ) ); 
	}

	/**
	 * Return the real part of a complex image.
	 */
	VImage 
	real( VOption *options = 0 ) const
	{
		return( complexget( VIPS_OPERATION_COMPLEXGET_REAL, options ) );
	}

	/**
	 * Return the imaginary part of a complex image.
	 */
	VImage 
	imag( VOption *options = 0 ) const
	{
		return( complexget( VIPS_OPERATION_COMPLEXGET_IMAG, options ) );
	}

	/**
	 * Convert a complex image to polar coordinates.
	 */
	VImage 
	polar( VOption *options = 0 ) const
	{
		return( complex( VIPS_OPERATION_COMPLEX_POLAR, options ) );
	}

	/**
	 * Convert a complex image to rectangular coordinates.
	 */
	VImage 
	rect( VOption *options = 0 ) const
	{
		return( complex( VIPS_OPERATION_COMPLEX_RECT, options ) );
	}

	/**
	 * Find the complex conjugate.
	 */
	VImage 
	conj( VOption *options = 0 ) const
	{
		return( complex( VIPS_OPERATION_COMPLEX_CONJ, options ) );
	}

	/**
	 * Find the sine of each pixel. Angles are in degrees.
	 */
	VImage 
	sin( VOption *options = 0 ) const
	{
		return( math( VIPS_OPERATION_MATH_SIN, options ) );
	}

	/**
	 * Find the cosine of each pixel. Angles are in degrees.
	 */
	VImage 
	cos( VOption *options = 0 ) const
	{
		return( math( VIPS_OPERATION_MATH_COS, options ) );
	}

	/**
	 * Find the tangent of each pixel. Angles are in degrees.
	 */
	VImage 
	tan( VOption *options = 0 ) const
	{
		return( math( VIPS_OPERATION_MATH_TAN, options ) );
	}

	/**
	 * Find the arc sine of each pixel. Angles are in degrees.
	 */
	VImage 
	asin( VOption *options = 0 ) const
	{
		return( math( VIPS_OPERATION_MATH_ASIN, options ) );
	}

	/**
	 * Find the arc cosine of each pixel. Angles are in degrees.
	 */
	VImage 
	acos( VOption *options = 0 ) const
	{
		return( math( VIPS_OPERATION_MATH_ACOS, options ) );
	}

	/**
	 * Find the arc tangent of each pixel. Angles are in degrees.
	 */
	VImage 
	atan( VOption *options = 0 ) const
	{
		return( math( VIPS_OPERATION_MATH_ATAN, options ) );
	}

	/**
	 * Find the hyperbolic sine of each pixel. Angles are in degrees.
	 */
	VImage 
	sinh( VOption *options = 0 ) const
	{
		return( math( VIPS_OPERATION_MATH_SINH, options ) );
	}

	/**
	 * Find the hyperbolic cosine of each pixel. Angles are in degrees.
	 */
	VImage 
	cosh( VOption *options = 0 ) const
	{
		return( math( VIPS_OPERATION_MATH_COSH, options ) );
	}

	/**
	 * Find the hyperbolic tangent of each pixel. Angles are in degrees.
	 */
	VImage 
	tanh( VOption *options = 0 ) const
	{
		return( math( VIPS_OPERATION_MATH_TANH, options ) );
	}

	/**
	 * Find the hyperbolic arc sine of each pixel. Angles are in radians.
	 */
	VImage 
	asinh( VOption *options = 0 ) const
	{
		return( math( VIPS_OPERATION_MATH_ASINH, options ) );
	}

	/**
	 * Find the hyperbolic arc cosine of each pixel. Angles are in radians.
	 */
	VImage 
	acosh( VOption *options = 0 ) const
	{
		return( math( VIPS_OPERATION_MATH_ACOSH, options ) );
	}

	/**
	 * Find the hyperbolic arc tangent of each pixel. Angles are in radians.
	 */
	VImage 
	atanh( VOption *options = 0 ) const
	{
		return( math( VIPS_OPERATION_MATH_ATANH, options ) );
	}

	/**
	 * Find the natural log of each pixel. 
	 */
	VImage 
	log( VOption *options = 0 ) const
	{
		return( math( VIPS_OPERATION_MATH_LOG, options ) );
	}

	/**
	 * Find the base 10 log of each pixel. 
	 */
	VImage 
	log10( VOption *options = 0 ) const
	{
		return( math( VIPS_OPERATION_MATH_LOG10, options ) );
	}

	/**
	 * Find e to the power of each pixel.
	 */
	VImage 
	exp( VOption *options = 0 ) const
	{
		return( math( VIPS_OPERATION_MATH_EXP, options ) );
	}

	/**
	 * Find 10 to the power of each pixel.
	 */
	VImage 
	exp10( VOption *options = 0 ) const
	{
		return( math( VIPS_OPERATION_MATH_EXP10, options ) );
	}

	/**
	 * Raise each pixel to the specified power.
	 */
	VImage 
	pow( VImage other, VOption *options = 0 ) const
	{
		return( math2( other, VIPS_OPERATION_MATH2_POW, options ) );
	}

	/**
	 * Raise each pixel to the specified power.
	 */
	VImage 
	pow( double other, VOption *options = 0 ) const
	{
		return( math2_const( VIPS_OPERATION_MATH2_POW, 
			to_vector( other ), options ) );
	}

	/**
	 * Raise each pixel to the specified power.
	 */
	VImage 
	pow( std::vector<double> other, VOption *options = 0 ) const
	{
		return( math2_const( VIPS_OPERATION_MATH2_POW, 
			other, options ) );
	}

	/**
	 * Raise other to the power of each pixel (the opposite of pow).
	 */
	VImage 
	wop( VImage other, VOption *options = 0 ) const
	{
		return( math2( other, VIPS_OPERATION_MATH2_WOP, options ) );
	}

	/**
	 * Raise the constant to the power of each pixel (the opposite of pow).
	 */
	VImage 
	wop( double other, VOption *options = 0 ) const
	{
		return( math2_const( VIPS_OPERATION_MATH2_WOP, 
			to_vector( other ), options ) );
	}

	/**
	 * Raise the constant to the power of each pixel (the opposite of pow).
	 */
	VImage 
	wop( std::vector<double> other, VOption *options = 0 ) const
	{
		return( math2_const( VIPS_OPERATION_MATH2_WOP, 
			other, options ) );
	}
	
	/**
	 * Calculate atan2 of each pixel.
	 */
	VImage 
	atan2( VImage other, VOption *options = 0 ) const
	{
		return( math2( other, VIPS_OPERATION_MATH2_ATAN2, options ) );
	}

	/**
	 * Calculate atan2 of each pixel.
	 */
	VImage 
	atan2( double other, VOption *options = 0 ) const
	{
		return( math2_const( VIPS_OPERATION_MATH2_ATAN2, 
			to_vector( other ), options ) );
	}

	/**
	 * Calculate atan2 of each pixel.
	 */
	VImage 
	atan2( std::vector<double> other, VOption *options = 0 ) const
	{
		return( math2_const( VIPS_OPERATION_MATH2_ATAN2, 
			other, options ) );
	}

	/**
	 * Use self as a conditional image (not zero meaning TRUE) to pick
	 * pixels from th (then) or el (else).
	 */
	VImage 
	ifthenelse( std::vector<double> th, VImage el, 
		VOption *options = 0 ) const
	{
		return( ifthenelse( el.new_from_image( th ), el, options ) ); 
	}

	/**
	 * Use self as a conditional image (not zero meaning TRUE) to pick
	 * pixels from th (then) or el (else).
	 */
	VImage 
	ifthenelse( VImage th, std::vector<double> el, 
		VOption *options = 0 ) const
	{
		return( ifthenelse( th, th.new_from_image( el ), options ) ); 
	}

	/**
	 * Use self as a conditional image (not zero meaning TRUE) to pick
	 * pixels from th (then) or el (else).
	 */
	VImage 
	ifthenelse( std::vector<double> th, std::vector<double> el, 
		VOption *options = 0 ) const
	{
		return( ifthenelse( new_from_image( th ), new_from_image( el ),
			options ) ); 
	}

	/**
	 * Use self as a conditional image (not zero meaning TRUE) to pick
	 * pixels from th (then) or el (else).
	 */
	VImage 
	ifthenelse( double th, VImage el, VOption *options = 0 ) const
	{
		return( ifthenelse( to_vector( th ), el, options ) ); 
	}

	/**
	 * Use self as a conditional image (not zero meaning TRUE) to pick
	 * pixels from th (then) or el (else).
	 */
	VImage 
	ifthenelse( VImage th, double el, VOption *options = 0 ) const
	{
		return( ifthenelse( th, to_vector( el ), options ) ); 
	}

	/**
	 * Use self as a conditional image (not zero meaning TRUE) to pick
	 * pixels from th (then) or el (else).
	 */
	VImage 
	ifthenelse( double th, double el, VOption *options = 0 ) const
	{
		return( ifthenelse( to_vector( th ), to_vector( el ), 
			options ) );
	}

	// Operator overloads

	VImage operator[]( int index ) const;

	std::vector<double> operator()( int x, int y ) const;

	friend VIPS_CPLUSPLUS_API VImage 
		operator+( const VImage a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator+( const double a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator+( const VImage a, const double b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator+( const std::vector<double> a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator+( const VImage a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage & 
		operator+=( VImage &a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator+=( VImage &a, const double b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator+=( VImage &a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage 
		operator-( const VImage a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator-( const double a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator-( const VImage a, const double b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator-( const std::vector<double> a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator-( const VImage a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage & 
		operator-=( VImage &a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator-=( VImage &a, const double b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator-=( VImage &a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage 
		operator-( const VImage a );

	friend VIPS_CPLUSPLUS_API VImage 
		operator*( const VImage a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator*( const double a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator*( const VImage a, const double b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator*( const std::vector<double> a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator*( const VImage a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage & 
		operator*=( VImage &a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator*=( VImage &a, const double b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator*=( VImage &a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage 
		operator/( const VImage a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator/( const double a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator/( const VImage a, const double b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator/( const std::vector<double> a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator/( const VImage a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage & 
		operator/=( VImage &a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator/=( VImage &a, const double b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator/=( VImage &a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage 
		operator%( const VImage a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator%( const VImage a, const double b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator%( const VImage a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage & 
		operator%=( VImage &a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator%=( VImage &a, const double b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator%=( VImage &a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage 
		operator<( const VImage a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator<( const double a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator<( const VImage a, const double b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator<( const std::vector<double> a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator<( const VImage a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage 
		operator<=( const VImage a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator<=( const double a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator<=( const VImage a, const double b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator<=( const std::vector<double> a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator<=( const VImage a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage 
		operator>( const VImage a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator>( const double a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator>( const VImage a, const double b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator>( const std::vector<double> a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator>( const VImage a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage 
		operator>=( const VImage a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator>=( const double a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator>=( const VImage a, const double b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator>=( const std::vector<double> a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator>=( const VImage a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage 
		operator==( const VImage a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator==( const double a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator==( const VImage a, const double b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator==( const std::vector<double> a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator==( const VImage a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage 
		operator!=( const VImage a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator!=( const double a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator!=( const VImage a, const double b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator!=( const std::vector<double> a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator!=( const VImage a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage 
		operator&( const VImage a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator&( const double a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator&( const VImage a, const double b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator&( const std::vector<double> a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator&( const VImage a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage & 
		operator&=( VImage &a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator&=( VImage &a, const double b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator&=( VImage &a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage 
		operator|( const VImage a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator|( const double a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator|( const VImage a, const double b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator|( const std::vector<double> a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator|( const VImage a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage & 
		operator|=( VImage &a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator|=( VImage &a, const double b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator|=( VImage &a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage 
		operator^( const VImage a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator^( const double a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator^( const VImage a, const double b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator^( const std::vector<double> a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator^( const VImage a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage & 
		operator^=( VImage &a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator^=( VImage &a, const double b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator^=( VImage &a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage 
		operator<<( const VImage a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator<<( const VImage a, const double b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator<<( const VImage a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage & 
		operator<<=( VImage &a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator<<=( VImage &a, const double b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator<<=( VImage &a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage 
		operator>>( const VImage a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator>>( const VImage a, const double b );
	friend VIPS_CPLUSPLUS_API VImage 
		operator>>( const VImage a, const std::vector<double> b );

	friend VIPS_CPLUSPLUS_API VImage & 
		operator>>=( VImage &a, const VImage b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator>>=( VImage &a, const double b );
	friend VIPS_CPLUSPLUS_API VImage & 
		operator>>=( VImage &a, const std::vector<double> b );

	/* Automatically generated members.
	 *
	 * Rebuild with:
	 *
	 * 	meson compile -Cbuild vips-operators-header
	 *
	 * Then delete from here to the end of the class and paste in
	 * vips-operators.h. We could just #include vips-operators.h, but 
	 * that confuses doxygen.
	 */

// headers for vips operations
// this file is generated automatically, do not edit!

/**
 * Transform lch to cmc.
 * @param options Set of options.
 * @return Output image.
 */
VImage CMC2LCh( VOption *options = 0 ) const;

/**
 * Transform cmyk to xyz.
 * @param options Set of options.
 * @return Output image.
 */
VImage CMYK2XYZ( VOption *options = 0 ) const;

/**
 * Transform hsv to srgb.
 * @param options Set of options.
 * @return Output image.
 */
VImage HSV2sRGB( VOption *options = 0 ) const;

/**
 * Transform lch to cmc.
 * @param options Set of options.
 * @return Output image.
 */
VImage LCh2CMC( VOption *options = 0 ) const;

/**
 * Transform lch to lab.
 * @param options Set of options.
 * @return Output image.
 */
VImage LCh2Lab( VOption *options = 0 ) const;

/**
 * Transform lab to lch.
 * @param options Set of options.
 * @return Output image.
 */
VImage Lab2LCh( VOption *options = 0 ) const;

/**
 * Transform float lab to labq coding.
 * @param options Set of options.
 * @return Output image.
 */
VImage Lab2LabQ( VOption *options = 0 ) const;

/**
 * Transform float lab to signed short.
 * @param options Set of options.
 * @return Output image.
 */
VImage Lab2LabS( VOption *options = 0 ) const;

/**
 * Transform cielab to xyz.
 *
 * **Optional parameters**
 *   - **temp** -- Color temperature, std::vector<double>.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage Lab2XYZ( VOption *options = 0 ) const;

/**
 * Unpack a labq image to float lab.
 * @param options Set of options.
 * @return Output image.
 */
VImage LabQ2Lab( VOption *options = 0 ) const;

/**
 * Unpack a labq image to short lab.
 * @param options Set of options.
 * @return Output image.
 */
VImage LabQ2LabS( VOption *options = 0 ) const;

/**
 * Convert a labq image to srgb.
 * @param options Set of options.
 * @return Output image.
 */
VImage LabQ2sRGB( VOption *options = 0 ) const;

/**
 * Transform signed short lab to float.
 * @param options Set of options.
 * @return Output image.
 */
VImage LabS2Lab( VOption *options = 0 ) const;

/**
 * Transform short lab to labq coding.
 * @param options Set of options.
 * @return Output image.
 */
VImage LabS2LabQ( VOption *options = 0 ) const;

/**
 * Transform xyz to cmyk.
 * @param options Set of options.
 * @return Output image.
 */
VImage XYZ2CMYK( VOption *options = 0 ) const;

/**
 * Transform xyz to lab.
 *
 * **Optional parameters**
 *   - **temp** -- Colour temperature, std::vector<double>.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage XYZ2Lab( VOption *options = 0 ) const;

/**
 * Transform xyz to yxy.
 * @param options Set of options.
 * @return Output image.
 */
VImage XYZ2Yxy( VOption *options = 0 ) const;

/**
 * Transform xyz to scrgb.
 * @param options Set of options.
 * @return Output image.
 */
VImage XYZ2scRGB( VOption *options = 0 ) const;

/**
 * Transform yxy to xyz.
 * @param options Set of options.
 * @return Output image.
 */
VImage Yxy2XYZ( VOption *options = 0 ) const;

/**
 * Absolute value of an image.
 * @param options Set of options.
 * @return Output image.
 */
VImage abs( VOption *options = 0 ) const;

/**
 * Add two images.
 * @param right Right-hand image argument.
 * @param options Set of options.
 * @return Output image.
 */
VImage add( VImage right, VOption *options = 0 ) const;

/**
 * Affine transform of an image.
 *
 * **Optional parameters**
 *   - **interpolate** -- Interpolate pixels with this, VInterpolate.
 *   - **oarea** -- Area of output to generate, std::vector<int>.
 *   - **odx** -- Horizontal output displacement, double.
 *   - **ody** -- Vertical output displacement, double.
 *   - **idx** -- Horizontal input displacement, double.
 *   - **idy** -- Vertical input displacement, double.
 *   - **background** -- Background value, std::vector<double>.
 *   - **premultiplied** -- Images have premultiplied alpha, bool.
 *   - **extend** -- How to generate the extra pixels, VipsExtend.
 *
 * @param matrix Transformation matrix.
 * @param options Set of options.
 * @return Output image.
 */
VImage affine( std::vector<double> matrix, VOption *options = 0 ) const;

/**
 * Load an analyze6 image.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage analyzeload( const char *filename, VOption *options = 0 );

/**
 * Join an array of images.
 *
 * **Optional parameters**
 *   - **across** -- Number of images across grid, int.
 *   - **shim** -- Pixels between images, int.
 *   - **background** -- Colour for new pixels, std::vector<double>.
 *   - **halign** -- Align on the left, centre or right, VipsAlign.
 *   - **valign** -- Align on the top, centre or bottom, VipsAlign.
 *   - **hspacing** -- Horizontal spacing between images, int.
 *   - **vspacing** -- Vertical spacing between images, int.
 *
 * @param in Array of input images.
 * @param options Set of options.
 * @return Output image.
 */
static VImage arrayjoin( std::vector<VImage> in, VOption *options = 0 );

/**
 * Autorotate image by exif tag.
 * @param options Set of options.
 * @return Output image.
 */
VImage autorot( VOption *options = 0 ) const;

/**
 * Find image average.
 * @param options Set of options.
 * @return Output value.
 */
double avg( VOption *options = 0 ) const;

/**
 * Boolean operation across image bands.
 * @param boolean Boolean to perform.
 * @param options Set of options.
 * @return Output image.
 */
VImage bandbool( VipsOperationBoolean boolean, VOption *options = 0 ) const;

/**
 * Fold up x axis into bands.
 *
 * **Optional parameters**
 *   - **factor** -- Fold by this factor, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage bandfold( VOption *options = 0 ) const;

/**
 * Bandwise join a set of images.
 * @param in Array of input images.
 * @param options Set of options.
 * @return Output image.
 */
static VImage bandjoin( std::vector<VImage> in, VOption *options = 0 );

/**
 * Append a constant band to an image.
 * @param c Array of constants to add.
 * @param options Set of options.
 * @return Output image.
 */
VImage bandjoin_const( std::vector<double> c, VOption *options = 0 ) const;

/**
 * Band-wise average.
 * @param options Set of options.
 * @return Output image.
 */
VImage bandmean( VOption *options = 0 ) const;

/**
 * Band-wise rank of a set of images.
 *
 * **Optional parameters**
 *   - **index** -- Select this band element from sorted list, int.
 *
 * @param in Array of input images.
 * @param options Set of options.
 * @return Output image.
 */
static VImage bandrank( std::vector<VImage> in, VOption *options = 0 );

/**
 * Unfold image bands into x axis.
 *
 * **Optional parameters**
 *   - **factor** -- Unfold by this factor, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage bandunfold( VOption *options = 0 ) const;

/**
 * Make a black image.
 *
 * **Optional parameters**
 *   - **bands** -- Number of bands in image, int.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param options Set of options.
 * @return Output image.
 */
static VImage black( int width, int height, VOption *options = 0 );

/**
 * Boolean operation on two images.
 * @param right Right-hand image argument.
 * @param boolean Boolean to perform.
 * @param options Set of options.
 * @return Output image.
 */
VImage boolean( VImage right, VipsOperationBoolean boolean, VOption *options = 0 ) const;

/**
 * Boolean operations against a constant.
 * @param boolean Boolean to perform.
 * @param c Array of constants.
 * @param options Set of options.
 * @return Output image.
 */
VImage boolean_const( VipsOperationBoolean boolean, std::vector<double> c, VOption *options = 0 ) const;

/**
 * Build a look-up table.
 * @param options Set of options.
 * @return Output image.
 */
VImage buildlut( VOption *options = 0 ) const;

/**
 * Byteswap an image.
 * @param options Set of options.
 * @return Output image.
 */
VImage byteswap( VOption *options = 0 ) const;

/**
 * Cache an image.
 *
 * **Optional parameters**
 *   - **max_tiles** -- Maximum number of tiles to cache, int.
 *   - **tile_height** -- Tile height in pixels, int.
 *   - **tile_width** -- Tile width in pixels, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage cache( VOption *options = 0 ) const;

/**
 * Canny edge detector.
 *
 * **Optional parameters**
 *   - **sigma** -- Sigma of Gaussian, double.
 *   - **precision** -- Convolve with this precision, VipsPrecision.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage canny( VOption *options = 0 ) const;

/**
 * Use pixel values to pick cases from an array of images.
 * @param cases Array of case images.
 * @param options Set of options.
 * @return Output image.
 */
VImage case_image( std::vector<VImage> cases, VOption *options = 0 ) const;

/**
 * Cast an image.
 *
 * **Optional parameters**
 *   - **shift** -- Shift integer values up and down, bool.
 *
 * @param format Format to cast to.
 * @param options Set of options.
 * @return Output image.
 */
VImage cast( VipsBandFormat format, VOption *options = 0 ) const;

/**
 * Convert to a new colorspace.
 *
 * **Optional parameters**
 *   - **source_space** -- Source color space, VipsInterpretation.
 *
 * @param space Destination color space.
 * @param options Set of options.
 * @return Output image.
 */
VImage colourspace( VipsInterpretation space, VOption *options = 0 ) const;

/**
 * Convolve with rotating mask.
 *
 * **Optional parameters**
 *   - **times** -- Rotate and convolve this many times, int.
 *   - **angle** -- Rotate mask by this much between convolutions, VipsAngle45.
 *   - **combine** -- Combine convolution results like this, VipsCombine.
 *   - **precision** -- Convolve with this precision, VipsPrecision.
 *   - **layers** -- Use this many layers in approximation, int.
 *   - **cluster** -- Cluster lines closer than this in approximation, int.
 *
 * @param mask Input matrix image.
 * @param options Set of options.
 * @return Output image.
 */
VImage compass( VImage mask, VOption *options = 0 ) const;

/**
 * Perform a complex operation on an image.
 * @param cmplx Complex to perform.
 * @param options Set of options.
 * @return Output image.
 */
VImage complex( VipsOperationComplex cmplx, VOption *options = 0 ) const;

/**
 * Complex binary operations on two images.
 * @param right Right-hand image argument.
 * @param cmplx Binary complex operation to perform.
 * @param options Set of options.
 * @return Output image.
 */
VImage complex2( VImage right, VipsOperationComplex2 cmplx, VOption *options = 0 ) const;

/**
 * Form a complex image from two real images.
 * @param right Right-hand image argument.
 * @param options Set of options.
 * @return Output image.
 */
VImage complexform( VImage right, VOption *options = 0 ) const;

/**
 * Get a component from a complex image.
 * @param get Complex to perform.
 * @param options Set of options.
 * @return Output image.
 */
VImage complexget( VipsOperationComplexget get, VOption *options = 0 ) const;

/**
 * Blend an array of images with an array of blend modes.
 *
 * **Optional parameters**
 *   - **x** -- Array of x coordinates to join at, std::vector<int>.
 *   - **y** -- Array of y coordinates to join at, std::vector<int>.
 *   - **compositing_space** -- Composite images in this colour space, VipsInterpretation.
 *   - **premultiplied** -- Images have premultiplied alpha, bool.
 *
 * @param in Array of input images.
 * @param mode Array of VipsBlendMode to join with.
 * @param options Set of options.
 * @return Output image.
 */
static VImage composite( std::vector<VImage> in, std::vector<int> mode, VOption *options = 0 );

/**
 * Blend a pair of images with a blend mode.
 *
 * **Optional parameters**
 *   - **x** -- x position of overlay, int.
 *   - **y** -- y position of overlay, int.
 *   - **compositing_space** -- Composite images in this colour space, VipsInterpretation.
 *   - **premultiplied** -- Images have premultiplied alpha, bool.
 *
 * @param overlay Overlay image.
 * @param mode VipsBlendMode to join with.
 * @param options Set of options.
 * @return Output image.
 */
VImage composite2( VImage overlay, VipsBlendMode mode, VOption *options = 0 ) const;

/**
 * Convolution operation.
 *
 * **Optional parameters**
 *   - **precision** -- Convolve with this precision, VipsPrecision.
 *   - **layers** -- Use this many layers in approximation, int.
 *   - **cluster** -- Cluster lines closer than this in approximation, int.
 *
 * @param mask Input matrix image.
 * @param options Set of options.
 * @return Output image.
 */
VImage conv( VImage mask, VOption *options = 0 ) const;

/**
 * Approximate integer convolution.
 *
 * **Optional parameters**
 *   - **layers** -- Use this many layers in approximation, int.
 *   - **cluster** -- Cluster lines closer than this in approximation, int.
 *
 * @param mask Input matrix image.
 * @param options Set of options.
 * @return Output image.
 */
VImage conva( VImage mask, VOption *options = 0 ) const;

/**
 * Approximate separable integer convolution.
 *
 * **Optional parameters**
 *   - **layers** -- Use this many layers in approximation, int.
 *
 * @param mask Input matrix image.
 * @param options Set of options.
 * @return Output image.
 */
VImage convasep( VImage mask, VOption *options = 0 ) const;

/**
 * Float convolution operation.
 * @param mask Input matrix image.
 * @param options Set of options.
 * @return Output image.
 */
VImage convf( VImage mask, VOption *options = 0 ) const;

/**
 * Int convolution operation.
 * @param mask Input matrix image.
 * @param options Set of options.
 * @return Output image.
 */
VImage convi( VImage mask, VOption *options = 0 ) const;

/**
 * Seperable convolution operation.
 *
 * **Optional parameters**
 *   - **precision** -- Convolve with this precision, VipsPrecision.
 *   - **layers** -- Use this many layers in approximation, int.
 *   - **cluster** -- Cluster lines closer than this in approximation, int.
 *
 * @param mask Input matrix image.
 * @param options Set of options.
 * @return Output image.
 */
VImage convsep( VImage mask, VOption *options = 0 ) const;

/**
 * Copy an image.
 *
 * **Optional parameters**
 *   - **width** -- Image width in pixels, int.
 *   - **height** -- Image height in pixels, int.
 *   - **bands** -- Number of bands in image, int.
 *   - **format** -- Pixel format in image, VipsBandFormat.
 *   - **coding** -- Pixel coding, VipsCoding.
 *   - **interpretation** -- Pixel interpretation, VipsInterpretation.
 *   - **xres** -- Horizontal resolution in pixels/mm, double.
 *   - **yres** -- Vertical resolution in pixels/mm, double.
 *   - **xoffset** -- Horizontal offset of origin, int.
 *   - **yoffset** -- Vertical offset of origin, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage copy( VOption *options = 0 ) const;

/**
 * Count lines in an image.
 * @param direction Countlines left-right or up-down.
 * @param options Set of options.
 * @return Number of lines.
 */
double countlines( VipsDirection direction, VOption *options = 0 ) const;

/**
 * Extract an area from an image.
 * @param left Left edge of extract area.
 * @param top Top edge of extract area.
 * @param width Width of extract area.
 * @param height Height of extract area.
 * @param options Set of options.
 * @return Output image.
 */
VImage crop( int left, int top, int width, int height, VOption *options = 0 ) const;

/**
 * Load csv.
 *
 * **Optional parameters**
 *   - **skip** -- Skip this many lines at the start of the file, int.
 *   - **lines** -- Read this many lines from the file, int.
 *   - **whitespace** -- Set of whitespace characters, const char *.
 *   - **separator** -- Set of separator characters, const char *.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage csvload( const char *filename, VOption *options = 0 );

/**
 * Load csv.
 *
 * **Optional parameters**
 *   - **skip** -- Skip this many lines at the start of the file, int.
 *   - **lines** -- Read this many lines from the file, int.
 *   - **whitespace** -- Set of whitespace characters, const char *.
 *   - **separator** -- Set of separator characters, const char *.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage csvload_source( VSource source, VOption *options = 0 );

/**
 * Save image to csv.
 *
 * **Optional parameters**
 *   - **separator** -- Separator characters, const char *.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to save to.
 * @param options Set of options.
 */
void csvsave( const char *filename, VOption *options = 0 ) const;

/**
 * Save image to csv.
 *
 * **Optional parameters**
 *   - **separator** -- Separator characters, const char *.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param target Target to save to.
 * @param options Set of options.
 */
void csvsave_target( VTarget target, VOption *options = 0 ) const;

/**
 * Calculate de00.
 * @param right Right-hand input image.
 * @param options Set of options.
 * @return Output image.
 */
VImage dE00( VImage right, VOption *options = 0 ) const;

/**
 * Calculate de76.
 * @param right Right-hand input image.
 * @param options Set of options.
 * @return Output image.
 */
VImage dE76( VImage right, VOption *options = 0 ) const;

/**
 * Calculate decmc.
 * @param right Right-hand input image.
 * @param options Set of options.
 * @return Output image.
 */
VImage dECMC( VImage right, VOption *options = 0 ) const;

/**
 * Find image standard deviation.
 * @param options Set of options.
 * @return Output value.
 */
double deviate( VOption *options = 0 ) const;

/**
 * Divide two images.
 * @param right Right-hand image argument.
 * @param options Set of options.
 * @return Output image.
 */
VImage divide( VImage right, VOption *options = 0 ) const;

/**
 * Draw a circle on an image.
 *
 * **Optional parameters**
 *   - **fill** -- Draw a solid object, bool.
 *
 * @param ink Color for pixels.
 * @param cx Centre of draw_circle.
 * @param cy Centre of draw_circle.
 * @param radius Radius in pixels.
 * @param options Set of options.
 */
void draw_circle( std::vector<double> ink, int cx, int cy, int radius, VOption *options = 0 ) const;

/**
 * Flood-fill an area.
 *
 * **Optional parameters**
 *   - **test** -- Test pixels in this image, VImage.
 *   - **equal** -- DrawFlood while equal to edge, bool.
 *
 * @param ink Color for pixels.
 * @param x DrawFlood start point.
 * @param y DrawFlood start point.
 * @param options Set of options.
 */
void draw_flood( std::vector<double> ink, int x, int y, VOption *options = 0 ) const;

/**
 * Paint an image into another image.
 *
 * **Optional parameters**
 *   - **mode** -- Combining mode, VipsCombineMode.
 *
 * @param sub Sub-image to insert into main image.
 * @param x Draw image here.
 * @param y Draw image here.
 * @param options Set of options.
 */
void draw_image( VImage sub, int x, int y, VOption *options = 0 ) const;

/**
 * Draw a line on an image.
 * @param ink Color for pixels.
 * @param x1 Start of draw_line.
 * @param y1 Start of draw_line.
 * @param x2 End of draw_line.
 * @param y2 End of draw_line.
 * @param options Set of options.
 */
void draw_line( std::vector<double> ink, int x1, int y1, int x2, int y2, VOption *options = 0 ) const;

/**
 * Draw a mask on an image.
 * @param ink Color for pixels.
 * @param mask Mask of pixels to draw.
 * @param x Draw mask here.
 * @param y Draw mask here.
 * @param options Set of options.
 */
void draw_mask( std::vector<double> ink, VImage mask, int x, int y, VOption *options = 0 ) const;

/**
 * Paint a rectangle on an image.
 *
 * **Optional parameters**
 *   - **fill** -- Draw a solid object, bool.
 *
 * @param ink Color for pixels.
 * @param left Rect to fill.
 * @param top Rect to fill.
 * @param width Rect to fill.
 * @param height Rect to fill.
 * @param options Set of options.
 */
void draw_rect( std::vector<double> ink, int left, int top, int width, int height, VOption *options = 0 ) const;

/**
 * Blur a rectangle on an image.
 * @param left Rect to fill.
 * @param top Rect to fill.
 * @param width Rect to fill.
 * @param height Rect to fill.
 * @param options Set of options.
 */
void draw_smudge( int left, int top, int width, int height, VOption *options = 0 ) const;

/**
 * Save image to deepzoom file.
 *
 * **Optional parameters**
 *   - **basename** -- Base name to save to, const char *.
 *   - **layout** -- Directory layout, VipsForeignDzLayout.
 *   - **suffix** -- Filename suffix for tiles, const char *.
 *   - **overlap** -- Tile overlap in pixels, int.
 *   - **tile_size** -- Tile size in pixels, int.
 *   - **centre** -- Center image in tile, bool.
 *   - **depth** -- Pyramid depth, VipsForeignDzDepth.
 *   - **angle** -- Rotate image during save, VipsAngle.
 *   - **container** -- Pyramid container type, VipsForeignDzContainer.
 *   - **compression** -- ZIP deflate compression level, int.
 *   - **region_shrink** -- Method to shrink regions, VipsRegionShrink.
 *   - **skip_blanks** -- Skip tiles which are nearly equal to the background, int.
 *   - **no_strip** -- Don't strip tile metadata, bool.
 *   - **id** -- Resource ID, const char *.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to save to.
 * @param options Set of options.
 */
void dzsave( const char *filename, VOption *options = 0 ) const;

/**
 * Save image to dz buffer.
 *
 * **Optional parameters**
 *   - **basename** -- Base name to save to, const char *.
 *   - **layout** -- Directory layout, VipsForeignDzLayout.
 *   - **suffix** -- Filename suffix for tiles, const char *.
 *   - **overlap** -- Tile overlap in pixels, int.
 *   - **tile_size** -- Tile size in pixels, int.
 *   - **centre** -- Center image in tile, bool.
 *   - **depth** -- Pyramid depth, VipsForeignDzDepth.
 *   - **angle** -- Rotate image during save, VipsAngle.
 *   - **container** -- Pyramid container type, VipsForeignDzContainer.
 *   - **compression** -- ZIP deflate compression level, int.
 *   - **region_shrink** -- Method to shrink regions, VipsRegionShrink.
 *   - **skip_blanks** -- Skip tiles which are nearly equal to the background, int.
 *   - **no_strip** -- Don't strip tile metadata, bool.
 *   - **id** -- Resource ID, const char *.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param options Set of options.
 * @return Buffer to save to.
 */
VipsBlob *dzsave_buffer( VOption *options = 0 ) const;

/**
 * Save image to deepzoom target.
 *
 * **Optional parameters**
 *   - **basename** -- Base name to save to, const char *.
 *   - **layout** -- Directory layout, VipsForeignDzLayout.
 *   - **suffix** -- Filename suffix for tiles, const char *.
 *   - **overlap** -- Tile overlap in pixels, int.
 *   - **tile_size** -- Tile size in pixels, int.
 *   - **centre** -- Center image in tile, bool.
 *   - **depth** -- Pyramid depth, VipsForeignDzDepth.
 *   - **angle** -- Rotate image during save, VipsAngle.
 *   - **container** -- Pyramid container type, VipsForeignDzContainer.
 *   - **compression** -- ZIP deflate compression level, int.
 *   - **region_shrink** -- Method to shrink regions, VipsRegionShrink.
 *   - **skip_blanks** -- Skip tiles which are nearly equal to the background, int.
 *   - **no_strip** -- Don't strip tile metadata, bool.
 *   - **id** -- Resource ID, const char *.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param target Target to save to.
 * @param options Set of options.
 */
void dzsave_target( VTarget target, VOption *options = 0 ) const;

/**
 * Embed an image in a larger image.
 *
 * **Optional parameters**
 *   - **extend** -- How to generate the extra pixels, VipsExtend.
 *   - **background** -- Color for background pixels, std::vector<double>.
 *
 * @param x Left edge of input in output.
 * @param y Top edge of input in output.
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param options Set of options.
 * @return Output image.
 */
VImage embed( int x, int y, int width, int height, VOption *options = 0 ) const;

/**
 * Extract an area from an image.
 * @param left Left edge of extract area.
 * @param top Top edge of extract area.
 * @param width Width of extract area.
 * @param height Height of extract area.
 * @param options Set of options.
 * @return Output image.
 */
VImage extract_area( int left, int top, int width, int height, VOption *options = 0 ) const;

/**
 * Extract band from an image.
 *
 * **Optional parameters**
 *   - **n** -- Number of bands to extract, int.
 *
 * @param band Band to extract.
 * @param options Set of options.
 * @return Output image.
 */
VImage extract_band( int band, VOption *options = 0 ) const;

/**
 * Make an image showing the eye's spatial response.
 *
 * **Optional parameters**
 *   - **uchar** -- Output an unsigned char image, bool.
 *   - **factor** -- Maximum spatial frequency, double.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param options Set of options.
 * @return Output image.
 */
static VImage eye( int width, int height, VOption *options = 0 );

/**
 * False-color an image.
 * @param options Set of options.
 * @return Output image.
 */
VImage falsecolour( VOption *options = 0 ) const;

/**
 * Fast correlation.
 * @param ref Input reference image.
 * @param options Set of options.
 * @return Output image.
 */
VImage fastcor( VImage ref, VOption *options = 0 ) const;

/**
 * Fill image zeros with nearest non-zero pixel.
 * @param options Set of options.
 * @return Value of nearest non-zero pixel.
 */
VImage fill_nearest( VOption *options = 0 ) const;

/**
 * Search an image for non-edge areas.
 *
 * **Optional parameters**
 *   - **threshold** -- Object threshold, double.
 *   - **background** -- Color for background pixels, std::vector<double>.
 *
 * @param top Top edge of extract area.
 * @param width Width of extract area.
 * @param height Height of extract area.
 * @param options Set of options.
 * @return Left edge of image.
 */
int find_trim( int *top, int *width, int *height, VOption *options = 0 ) const;

/**
 * Load a fits image.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage fitsload( const char *filename, VOption *options = 0 );

/**
 * Load fits from a source.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage fitsload_source( VSource source, VOption *options = 0 );

/**
 * Save image to fits file.
 *
 * **Optional parameters**
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to save to.
 * @param options Set of options.
 */
void fitssave( const char *filename, VOption *options = 0 ) const;

/**
 * Flatten alpha out of an image.
 *
 * **Optional parameters**
 *   - **background** -- Background value, std::vector<double>.
 *   - **max_alpha** -- Maximum value of alpha channel, double.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage flatten( VOption *options = 0 ) const;

/**
 * Flip an image.
 * @param direction Direction to flip image.
 * @param options Set of options.
 * @return Output image.
 */
VImage flip( VipsDirection direction, VOption *options = 0 ) const;

/**
 * Transform float rgb to radiance coding.
 * @param options Set of options.
 * @return Output image.
 */
VImage float2rad( VOption *options = 0 ) const;

/**
 * Make a fractal surface.
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param fractal_dimension Fractal dimension.
 * @param options Set of options.
 * @return Output image.
 */
static VImage fractsurf( int width, int height, double fractal_dimension, VOption *options = 0 );

/**
 * Frequency-domain filtering.
 * @param mask Input mask image.
 * @param options Set of options.
 * @return Output image.
 */
VImage freqmult( VImage mask, VOption *options = 0 ) const;

/**
 * Forward fft.
 * @param options Set of options.
 * @return Output image.
 */
VImage fwfft( VOption *options = 0 ) const;

/**
 * Gamma an image.
 *
 * **Optional parameters**
 *   - **exponent** -- Gamma factor, double.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage gamma( VOption *options = 0 ) const;

/**
 * Gaussian blur.
 *
 * **Optional parameters**
 *   - **min_ampl** -- Minimum amplitude of Gaussian, double.
 *   - **precision** -- Convolve with this precision, VipsPrecision.
 *
 * @param sigma Sigma of Gaussian.
 * @param options Set of options.
 * @return Output image.
 */
VImage gaussblur( double sigma, VOption *options = 0 ) const;

/**
 * Make a gaussian image.
 *
 * **Optional parameters**
 *   - **separable** -- Generate separable Gaussian, bool.
 *   - **precision** -- Generate with this precision, VipsPrecision.
 *
 * @param sigma Sigma of Gaussian.
 * @param min_ampl Minimum amplitude of Gaussian.
 * @param options Set of options.
 * @return Output image.
 */
static VImage gaussmat( double sigma, double min_ampl, VOption *options = 0 );

/**
 * Make a gaussnoise image.
 *
 * **Optional parameters**
 *   - **sigma** -- Standard deviation of pixels in generated image, double.
 *   - **mean** -- Mean of pixels in generated image, double.
 *   - **seed** -- Random number seed, int.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param options Set of options.
 * @return Output image.
 */
static VImage gaussnoise( int width, int height, VOption *options = 0 );

/**
 * Read a point from an image.
 * @param x Point to read.
 * @param y Point to read.
 * @param options Set of options.
 * @return Array of output values.
 */
std::vector<double> getpoint( int x, int y, VOption *options = 0 ) const;

/**
 * Load gif with libnsgif.
 *
 * **Optional parameters**
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **page** -- First page to load, int.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage gifload( const char *filename, VOption *options = 0 );

/**
 * Load gif with libnsgif.
 *
 * **Optional parameters**
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **page** -- First page to load, int.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param buffer Buffer to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage gifload_buffer( VipsBlob *buffer, VOption *options = 0 );

/**
 * Load gif from source.
 *
 * **Optional parameters**
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **page** -- First page to load, int.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage gifload_source( VSource source, VOption *options = 0 );

/**
 * Save as gif.
 *
 * **Optional parameters**
 *   - **dither** -- Amount of dithering, double.
 *   - **effort** -- Quantisation effort, int.
 *   - **bitdepth** -- Number of bits per pixel, int.
 *   - **interframe_maxerror** -- Maximum inter-frame error for transparency, double.
 *   - **reuse** -- Reuse palette from input, bool.
 *   - **interpalette_maxerror** -- Maximum inter-palette error for palette reusage, double.
 *   - **interlace** -- Generate an interlaced (progressive) GIF, bool.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to save to.
 * @param options Set of options.
 */
void gifsave( const char *filename, VOption *options = 0 ) const;

/**
 * Save as gif.
 *
 * **Optional parameters**
 *   - **dither** -- Amount of dithering, double.
 *   - **effort** -- Quantisation effort, int.
 *   - **bitdepth** -- Number of bits per pixel, int.
 *   - **interframe_maxerror** -- Maximum inter-frame error for transparency, double.
 *   - **reuse** -- Reuse palette from input, bool.
 *   - **interpalette_maxerror** -- Maximum inter-palette error for palette reusage, double.
 *   - **interlace** -- Generate an interlaced (progressive) GIF, bool.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param options Set of options.
 * @return Buffer to save to.
 */
VipsBlob *gifsave_buffer( VOption *options = 0 ) const;

/**
 * Save as gif.
 *
 * **Optional parameters**
 *   - **dither** -- Amount of dithering, double.
 *   - **effort** -- Quantisation effort, int.
 *   - **bitdepth** -- Number of bits per pixel, int.
 *   - **interframe_maxerror** -- Maximum inter-frame error for transparency, double.
 *   - **reuse** -- Reuse palette from input, bool.
 *   - **interpalette_maxerror** -- Maximum inter-palette error for palette reusage, double.
 *   - **interlace** -- Generate an interlaced (progressive) GIF, bool.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param target Target to save to.
 * @param options Set of options.
 */
void gifsave_target( VTarget target, VOption *options = 0 ) const;

/**
 * Global balance an image mosaic.
 *
 * **Optional parameters**
 *   - **gamma** -- Image gamma, double.
 *   - **int_output** -- Integer output, bool.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage globalbalance( VOption *options = 0 ) const;

/**
 * Place an image within a larger image with a certain gravity.
 *
 * **Optional parameters**
 *   - **extend** -- How to generate the extra pixels, VipsExtend.
 *   - **background** -- Color for background pixels, std::vector<double>.
 *
 * @param direction Direction to place image within width/height.
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param options Set of options.
 * @return Output image.
 */
VImage gravity( VipsCompassDirection direction, int width, int height, VOption *options = 0 ) const;

/**
 * Make a grey ramp image.
 *
 * **Optional parameters**
 *   - **uchar** -- Output an unsigned char image, bool.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param options Set of options.
 * @return Output image.
 */
static VImage grey( int width, int height, VOption *options = 0 );

/**
 * Grid an image.
 * @param tile_height Chop into tiles this high.
 * @param across Number of tiles across.
 * @param down Number of tiles down.
 * @param options Set of options.
 * @return Output image.
 */
VImage grid( int tile_height, int across, int down, VOption *options = 0 ) const;

/**
 * Load a heif image.
 *
 * **Optional parameters**
 *   - **page** -- First page to load, int.
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **thumbnail** -- Fetch thumbnail image, bool.
 *   - **unlimited** -- Remove all denial of service limits, bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage heifload( const char *filename, VOption *options = 0 );

/**
 * Load a heif image.
 *
 * **Optional parameters**
 *   - **page** -- First page to load, int.
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **thumbnail** -- Fetch thumbnail image, bool.
 *   - **unlimited** -- Remove all denial of service limits, bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param buffer Buffer to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage heifload_buffer( VipsBlob *buffer, VOption *options = 0 );

/**
 * Load a heif image.
 *
 * **Optional parameters**
 *   - **page** -- First page to load, int.
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **thumbnail** -- Fetch thumbnail image, bool.
 *   - **unlimited** -- Remove all denial of service limits, bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage heifload_source( VSource source, VOption *options = 0 );

/**
 * Save image in heif format.
 *
 * **Optional parameters**
 *   - **Q** -- Q factor, int.
 *   - **bitdepth** -- Number of bits per pixel, int.
 *   - **lossless** -- Enable lossless compression, bool.
 *   - **compression** -- Compression format, VipsForeignHeifCompression.
 *   - **effort** -- CPU effort, int.
 *   - **subsample_mode** -- Select chroma subsample operation mode, VipsForeignSubsample.
 *   - **encoder** -- Select encoder to use, VipsForeignHeifEncoder.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to save to.
 * @param options Set of options.
 */
void heifsave( const char *filename, VOption *options = 0 ) const;

/**
 * Save image in heif format.
 *
 * **Optional parameters**
 *   - **Q** -- Q factor, int.
 *   - **bitdepth** -- Number of bits per pixel, int.
 *   - **lossless** -- Enable lossless compression, bool.
 *   - **compression** -- Compression format, VipsForeignHeifCompression.
 *   - **effort** -- CPU effort, int.
 *   - **subsample_mode** -- Select chroma subsample operation mode, VipsForeignSubsample.
 *   - **encoder** -- Select encoder to use, VipsForeignHeifEncoder.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param options Set of options.
 * @return Buffer to save to.
 */
VipsBlob *heifsave_buffer( VOption *options = 0 ) const;

/**
 * Save image in heif format.
 *
 * **Optional parameters**
 *   - **Q** -- Q factor, int.
 *   - **bitdepth** -- Number of bits per pixel, int.
 *   - **lossless** -- Enable lossless compression, bool.
 *   - **compression** -- Compression format, VipsForeignHeifCompression.
 *   - **effort** -- CPU effort, int.
 *   - **subsample_mode** -- Select chroma subsample operation mode, VipsForeignSubsample.
 *   - **encoder** -- Select encoder to use, VipsForeignHeifEncoder.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param target Target to save to.
 * @param options Set of options.
 */
void heifsave_target( VTarget target, VOption *options = 0 ) const;

/**
 * Form cumulative histogram.
 * @param options Set of options.
 * @return Output image.
 */
VImage hist_cum( VOption *options = 0 ) const;

/**
 * Estimate image entropy.
 * @param options Set of options.
 * @return Output value.
 */
double hist_entropy( VOption *options = 0 ) const;

/**
 * Histogram equalisation.
 *
 * **Optional parameters**
 *   - **band** -- Equalise with this band, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage hist_equal( VOption *options = 0 ) const;

/**
 * Find image histogram.
 *
 * **Optional parameters**
 *   - **band** -- Find histogram of band, int.
 *
 * @param options Set of options.
 * @return Output histogram.
 */
VImage hist_find( VOption *options = 0 ) const;

/**
 * Find indexed image histogram.
 *
 * **Optional parameters**
 *   - **combine** -- Combine bins like this, VipsCombine.
 *
 * @param index Index image.
 * @param options Set of options.
 * @return Output histogram.
 */
VImage hist_find_indexed( VImage index, VOption *options = 0 ) const;

/**
 * Find n-dimensional image histogram.
 *
 * **Optional parameters**
 *   - **bins** -- Number of bins in each dimension, int.
 *
 * @param options Set of options.
 * @return Output histogram.
 */
VImage hist_find_ndim( VOption *options = 0 ) const;

/**
 * Test for monotonicity.
 * @param options Set of options.
 * @return true if in is monotonic.
 */
bool hist_ismonotonic( VOption *options = 0 ) const;

/**
 * Local histogram equalisation.
 *
 * **Optional parameters**
 *   - **max_slope** -- Maximum slope (CLAHE), int.
 *
 * @param width Window width in pixels.
 * @param height Window height in pixels.
 * @param options Set of options.
 * @return Output image.
 */
VImage hist_local( int width, int height, VOption *options = 0 ) const;

/**
 * Match two histograms.
 * @param ref Reference histogram.
 * @param options Set of options.
 * @return Output image.
 */
VImage hist_match( VImage ref, VOption *options = 0 ) const;

/**
 * Normalise histogram.
 * @param options Set of options.
 * @return Output image.
 */
VImage hist_norm( VOption *options = 0 ) const;

/**
 * Plot histogram.
 * @param options Set of options.
 * @return Output image.
 */
VImage hist_plot( VOption *options = 0 ) const;

/**
 * Find hough circle transform.
 *
 * **Optional parameters**
 *   - **scale** -- Scale down dimensions by this factor, int.
 *   - **min_radius** -- Smallest radius to search for, int.
 *   - **max_radius** -- Largest radius to search for, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage hough_circle( VOption *options = 0 ) const;

/**
 * Find hough line transform.
 *
 * **Optional parameters**
 *   - **width** -- Horizontal size of parameter space, int.
 *   - **height** -- Vertical size of parameter space, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage hough_line( VOption *options = 0 ) const;

/**
 * Output to device with icc profile.
 *
 * **Optional parameters**
 *   - **pcs** -- Set Profile Connection Space, VipsPCS.
 *   - **intent** -- Rendering intent, VipsIntent.
 *   - **black_point_compensation** -- Enable black point compensation, bool.
 *   - **output_profile** -- Filename to load output profile from, const char *.
 *   - **depth** -- Output device space depth in bits, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage icc_export( VOption *options = 0 ) const;

/**
 * Import from device with icc profile.
 *
 * **Optional parameters**
 *   - **pcs** -- Set Profile Connection Space, VipsPCS.
 *   - **intent** -- Rendering intent, VipsIntent.
 *   - **black_point_compensation** -- Enable black point compensation, bool.
 *   - **embedded** -- Use embedded input profile, if available, bool.
 *   - **input_profile** -- Filename to load input profile from, const char *.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage icc_import( VOption *options = 0 ) const;

/**
 * Transform between devices with icc profiles.
 *
 * **Optional parameters**
 *   - **pcs** -- Set Profile Connection Space, VipsPCS.
 *   - **intent** -- Rendering intent, VipsIntent.
 *   - **black_point_compensation** -- Enable black point compensation, bool.
 *   - **embedded** -- Use embedded input profile, if available, bool.
 *   - **input_profile** -- Filename to load input profile from, const char *.
 *   - **depth** -- Output device space depth in bits, int.
 *
 * @param output_profile Filename to load output profile from.
 * @param options Set of options.
 * @return Output image.
 */
VImage icc_transform( const char *output_profile, VOption *options = 0 ) const;

/**
 * Make a 1d image where pixel values are indexes.
 *
 * **Optional parameters**
 *   - **bands** -- Number of bands in LUT, int.
 *   - **ushort** -- Create a 16-bit LUT, bool.
 *   - **size** -- Size of 16-bit LUT, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
static VImage identity( VOption *options = 0 );

/**
 * Ifthenelse an image.
 *
 * **Optional parameters**
 *   - **blend** -- Blend smoothly between then and else parts, bool.
 *
 * @param in1 Source for TRUE pixels.
 * @param in2 Source for FALSE pixels.
 * @param options Set of options.
 * @return Output image.
 */
VImage ifthenelse( VImage in1, VImage in2, VOption *options = 0 ) const;

/**
 * Insert image @sub into @main at @x, @y.
 *
 * **Optional parameters**
 *   - **expand** -- Expand output to hold all of both inputs, bool.
 *   - **background** -- Color for new pixels, std::vector<double>.
 *
 * @param sub Sub-image to insert into main image.
 * @param x Left edge of sub in main.
 * @param y Top edge of sub in main.
 * @param options Set of options.
 * @return Output image.
 */
VImage insert( VImage sub, int x, int y, VOption *options = 0 ) const;

/**
 * Invert an image.
 * @param options Set of options.
 * @return Output image.
 */
VImage invert( VOption *options = 0 ) const;

/**
 * Build an inverted look-up table.
 *
 * **Optional parameters**
 *   - **size** -- LUT size to generate, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage invertlut( VOption *options = 0 ) const;

/**
 * Inverse fft.
 *
 * **Optional parameters**
 *   - **real** -- Output only the real part of the transform, bool.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage invfft( VOption *options = 0 ) const;

/**
 * Join a pair of images.
 *
 * **Optional parameters**
 *   - **expand** -- Expand output to hold all of both inputs, bool.
 *   - **shim** -- Pixels between images, int.
 *   - **background** -- Colour for new pixels, std::vector<double>.
 *   - **align** -- Align on the low, centre or high coordinate edge, VipsAlign.
 *
 * @param in2 Second input image.
 * @param direction Join left-right or up-down.
 * @param options Set of options.
 * @return Output image.
 */
VImage join( VImage in2, VipsDirection direction, VOption *options = 0 ) const;

/**
 * Load jpeg2000 image.
 *
 * **Optional parameters**
 *   - **page** -- Load this page from the image, int.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage jp2kload( const char *filename, VOption *options = 0 );

/**
 * Load jpeg2000 image.
 *
 * **Optional parameters**
 *   - **page** -- Load this page from the image, int.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param buffer Buffer to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage jp2kload_buffer( VipsBlob *buffer, VOption *options = 0 );

/**
 * Load jpeg2000 image.
 *
 * **Optional parameters**
 *   - **page** -- Load this page from the image, int.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage jp2kload_source( VSource source, VOption *options = 0 );

/**
 * Save image in jpeg2000 format.
 *
 * **Optional parameters**
 *   - **tile_width** -- Tile width in pixels, int.
 *   - **tile_height** -- Tile height in pixels, int.
 *   - **lossless** -- Enable lossless compression, bool.
 *   - **Q** -- Q factor, int.
 *   - **subsample_mode** -- Select chroma subsample operation mode, VipsForeignSubsample.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 */
void jp2ksave( const char *filename, VOption *options = 0 ) const;

/**
 * Save image in jpeg2000 format.
 *
 * **Optional parameters**
 *   - **tile_width** -- Tile width in pixels, int.
 *   - **tile_height** -- Tile height in pixels, int.
 *   - **lossless** -- Enable lossless compression, bool.
 *   - **Q** -- Q factor, int.
 *   - **subsample_mode** -- Select chroma subsample operation mode, VipsForeignSubsample.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param options Set of options.
 * @return Buffer to save to.
 */
VipsBlob *jp2ksave_buffer( VOption *options = 0 ) const;

/**
 * Save image in jpeg2000 format.
 *
 * **Optional parameters**
 *   - **tile_width** -- Tile width in pixels, int.
 *   - **tile_height** -- Tile height in pixels, int.
 *   - **lossless** -- Enable lossless compression, bool.
 *   - **Q** -- Q factor, int.
 *   - **subsample_mode** -- Select chroma subsample operation mode, VipsForeignSubsample.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param target Target to save to.
 * @param options Set of options.
 */
void jp2ksave_target( VTarget target, VOption *options = 0 ) const;

/**
 * Load jpeg from file.
 *
 * **Optional parameters**
 *   - **shrink** -- Shrink factor on load, int.
 *   - **autorotate** -- Rotate image using exif orientation, bool.
 *   - **unlimited** -- Remove all denial of service limits, bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage jpegload( const char *filename, VOption *options = 0 );

/**
 * Load jpeg from buffer.
 *
 * **Optional parameters**
 *   - **shrink** -- Shrink factor on load, int.
 *   - **autorotate** -- Rotate image using exif orientation, bool.
 *   - **unlimited** -- Remove all denial of service limits, bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param buffer Buffer to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage jpegload_buffer( VipsBlob *buffer, VOption *options = 0 );

/**
 * Load image from jpeg source.
 *
 * **Optional parameters**
 *   - **shrink** -- Shrink factor on load, int.
 *   - **autorotate** -- Rotate image using exif orientation, bool.
 *   - **unlimited** -- Remove all denial of service limits, bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage jpegload_source( VSource source, VOption *options = 0 );

/**
 * Save image to jpeg file.
 *
 * **Optional parameters**
 *   - **Q** -- Q factor, int.
 *   - **profile** -- ICC profile to embed, const char *.
 *   - **optimize_coding** -- Compute optimal Huffman coding tables, bool.
 *   - **interlace** -- Generate an interlaced (progressive) jpeg, bool.
 *   - **trellis_quant** -- Apply trellis quantisation to each 8x8 block, bool.
 *   - **overshoot_deringing** -- Apply overshooting to samples with extreme values, bool.
 *   - **optimize_scans** -- Split spectrum of DCT coefficients into separate scans, bool.
 *   - **quant_table** -- Use predefined quantization table with given index, int.
 *   - **subsample_mode** -- Select chroma subsample operation mode, VipsForeignSubsample.
 *   - **restart_interval** -- Add restart markers every specified number of mcu, int.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to save to.
 * @param options Set of options.
 */
void jpegsave( const char *filename, VOption *options = 0 ) const;

/**
 * Save image to jpeg buffer.
 *
 * **Optional parameters**
 *   - **Q** -- Q factor, int.
 *   - **profile** -- ICC profile to embed, const char *.
 *   - **optimize_coding** -- Compute optimal Huffman coding tables, bool.
 *   - **interlace** -- Generate an interlaced (progressive) jpeg, bool.
 *   - **trellis_quant** -- Apply trellis quantisation to each 8x8 block, bool.
 *   - **overshoot_deringing** -- Apply overshooting to samples with extreme values, bool.
 *   - **optimize_scans** -- Split spectrum of DCT coefficients into separate scans, bool.
 *   - **quant_table** -- Use predefined quantization table with given index, int.
 *   - **subsample_mode** -- Select chroma subsample operation mode, VipsForeignSubsample.
 *   - **restart_interval** -- Add restart markers every specified number of mcu, int.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param options Set of options.
 * @return Buffer to save to.
 */
VipsBlob *jpegsave_buffer( VOption *options = 0 ) const;

/**
 * Save image to jpeg mime.
 *
 * **Optional parameters**
 *   - **Q** -- Q factor, int.
 *   - **profile** -- ICC profile to embed, const char *.
 *   - **optimize_coding** -- Compute optimal Huffman coding tables, bool.
 *   - **interlace** -- Generate an interlaced (progressive) jpeg, bool.
 *   - **trellis_quant** -- Apply trellis quantisation to each 8x8 block, bool.
 *   - **overshoot_deringing** -- Apply overshooting to samples with extreme values, bool.
 *   - **optimize_scans** -- Split spectrum of DCT coefficients into separate scans, bool.
 *   - **quant_table** -- Use predefined quantization table with given index, int.
 *   - **subsample_mode** -- Select chroma subsample operation mode, VipsForeignSubsample.
 *   - **restart_interval** -- Add restart markers every specified number of mcu, int.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param options Set of options.
 */
void jpegsave_mime( VOption *options = 0 ) const;

/**
 * Save image to jpeg target.
 *
 * **Optional parameters**
 *   - **Q** -- Q factor, int.
 *   - **profile** -- ICC profile to embed, const char *.
 *   - **optimize_coding** -- Compute optimal Huffman coding tables, bool.
 *   - **interlace** -- Generate an interlaced (progressive) jpeg, bool.
 *   - **trellis_quant** -- Apply trellis quantisation to each 8x8 block, bool.
 *   - **overshoot_deringing** -- Apply overshooting to samples with extreme values, bool.
 *   - **optimize_scans** -- Split spectrum of DCT coefficients into separate scans, bool.
 *   - **quant_table** -- Use predefined quantization table with given index, int.
 *   - **subsample_mode** -- Select chroma subsample operation mode, VipsForeignSubsample.
 *   - **restart_interval** -- Add restart markers every specified number of mcu, int.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param target Target to save to.
 * @param options Set of options.
 */
void jpegsave_target( VTarget target, VOption *options = 0 ) const;

/**
 * Load jpeg-xl image.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage jxlload( const char *filename, VOption *options = 0 );

/**
 * Load jpeg-xl image.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param buffer Buffer to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage jxlload_buffer( VipsBlob *buffer, VOption *options = 0 );

/**
 * Load jpeg-xl image.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage jxlload_source( VSource source, VOption *options = 0 );

/**
 * Save image in jpeg-xl format.
 *
 * **Optional parameters**
 *   - **tier** -- Decode speed tier, int.
 *   - **distance** -- Target butteraugli distance, double.
 *   - **effort** -- Encoding effort, int.
 *   - **lossless** -- Enable lossless compression, bool.
 *   - **Q** -- Quality factor, int.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 */
void jxlsave( const char *filename, VOption *options = 0 ) const;

/**
 * Save image in jpeg-xl format.
 *
 * **Optional parameters**
 *   - **tier** -- Decode speed tier, int.
 *   - **distance** -- Target butteraugli distance, double.
 *   - **effort** -- Encoding effort, int.
 *   - **lossless** -- Enable lossless compression, bool.
 *   - **Q** -- Quality factor, int.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param options Set of options.
 * @return Buffer to save to.
 */
VipsBlob *jxlsave_buffer( VOption *options = 0 ) const;

/**
 * Save image in jpeg-xl format.
 *
 * **Optional parameters**
 *   - **tier** -- Decode speed tier, int.
 *   - **distance** -- Target butteraugli distance, double.
 *   - **effort** -- Encoding effort, int.
 *   - **lossless** -- Enable lossless compression, bool.
 *   - **Q** -- Quality factor, int.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param target Target to save to.
 * @param options Set of options.
 */
void jxlsave_target( VTarget target, VOption *options = 0 ) const;

/**
 * Label regions in an image.
 * @param options Set of options.
 * @return Mask of region labels.
 */
VImage labelregions( VOption *options = 0 ) const;

/**
 * Calculate (a * in + b).
 *
 * **Optional parameters**
 *   - **uchar** -- Output should be uchar, bool.
 *
 * @param a Multiply by this.
 * @param b Add this.
 * @param options Set of options.
 * @return Output image.
 */
VImage linear( std::vector<double> a, std::vector<double> b, VOption *options = 0 ) const;

/**
 * Cache an image as a set of lines.
 *
 * **Optional parameters**
 *   - **tile_height** -- Tile height in pixels, int.
 *   - **access** -- Expected access pattern, VipsAccess.
 *   - **threaded** -- Allow threaded access, bool.
 *   - **persistent** -- Keep cache between evaluations, bool.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage linecache( VOption *options = 0 ) const;

/**
 * Make a laplacian of gaussian image.
 *
 * **Optional parameters**
 *   - **separable** -- Generate separable Gaussian, bool.
 *   - **precision** -- Generate with this precision, VipsPrecision.
 *
 * @param sigma Radius of Gaussian.
 * @param min_ampl Minimum amplitude of Gaussian.
 * @param options Set of options.
 * @return Output image.
 */
static VImage logmat( double sigma, double min_ampl, VOption *options = 0 );

/**
 * Load file with imagemagick.
 *
 * **Optional parameters**
 *   - **density** -- Canvas resolution for rendering vector formats like SVG, const char *.
 *   - **page** -- First page to load, int.
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage magickload( const char *filename, VOption *options = 0 );

/**
 * Load buffer with imagemagick.
 *
 * **Optional parameters**
 *   - **density** -- Canvas resolution for rendering vector formats like SVG, const char *.
 *   - **page** -- First page to load, int.
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param buffer Buffer to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage magickload_buffer( VipsBlob *buffer, VOption *options = 0 );

/**
 * Save file with imagemagick.
 *
 * **Optional parameters**
 *   - **format** -- Format to save in, const char *.
 *   - **quality** -- Quality to use, int.
 *   - **optimize_gif_frames** -- Apply GIF frames optimization, bool.
 *   - **optimize_gif_transparency** -- Apply GIF transparency optimization, bool.
 *   - **bitdepth** -- Number of bits per pixel, int.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to save to.
 * @param options Set of options.
 */
void magicksave( const char *filename, VOption *options = 0 ) const;

/**
 * Save image to magick buffer.
 *
 * **Optional parameters**
 *   - **format** -- Format to save in, const char *.
 *   - **quality** -- Quality to use, int.
 *   - **optimize_gif_frames** -- Apply GIF frames optimization, bool.
 *   - **optimize_gif_transparency** -- Apply GIF transparency optimization, bool.
 *   - **bitdepth** -- Number of bits per pixel, int.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param options Set of options.
 * @return Buffer to save to.
 */
VipsBlob *magicksave_buffer( VOption *options = 0 ) const;

/**
 * Resample with a map image.
 *
 * **Optional parameters**
 *   - **interpolate** -- Interpolate pixels with this, VInterpolate.
 *   - **background** -- Background value, std::vector<double>.
 *   - **premultiplied** -- Images have premultiplied alpha, bool.
 *   - **extend** -- How to generate the extra pixels, VipsExtend.
 *
 * @param index Index pixels with this.
 * @param options Set of options.
 * @return Output image.
 */
VImage mapim( VImage index, VOption *options = 0 ) const;

/**
 * Map an image though a lut.
 *
 * **Optional parameters**
 *   - **band** -- Apply one-band lut to this band of in, int.
 *
 * @param lut Look-up table image.
 * @param options Set of options.
 * @return Output image.
 */
VImage maplut( VImage lut, VOption *options = 0 ) const;

/**
 * Make a butterworth filter.
 *
 * **Optional parameters**
 *   - **uchar** -- Output an unsigned char image, bool.
 *   - **nodc** -- Remove DC component, bool.
 *   - **reject** -- Invert the sense of the filter, bool.
 *   - **optical** -- Rotate quadrants to optical space, bool.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param order Filter order.
 * @param frequency_cutoff Frequency cutoff.
 * @param amplitude_cutoff Amplitude cutoff.
 * @param options Set of options.
 * @return Output image.
 */
static VImage mask_butterworth( int width, int height, double order, double frequency_cutoff, double amplitude_cutoff, VOption *options = 0 );

/**
 * Make a butterworth_band filter.
 *
 * **Optional parameters**
 *   - **uchar** -- Output an unsigned char image, bool.
 *   - **nodc** -- Remove DC component, bool.
 *   - **reject** -- Invert the sense of the filter, bool.
 *   - **optical** -- Rotate quadrants to optical space, bool.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param order Filter order.
 * @param frequency_cutoff_x Frequency cutoff x.
 * @param frequency_cutoff_y Frequency cutoff y.
 * @param radius Radius of circle.
 * @param amplitude_cutoff Amplitude cutoff.
 * @param options Set of options.
 * @return Output image.
 */
static VImage mask_butterworth_band( int width, int height, double order, double frequency_cutoff_x, double frequency_cutoff_y, double radius, double amplitude_cutoff, VOption *options = 0 );

/**
 * Make a butterworth ring filter.
 *
 * **Optional parameters**
 *   - **uchar** -- Output an unsigned char image, bool.
 *   - **nodc** -- Remove DC component, bool.
 *   - **reject** -- Invert the sense of the filter, bool.
 *   - **optical** -- Rotate quadrants to optical space, bool.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param order Filter order.
 * @param frequency_cutoff Frequency cutoff.
 * @param amplitude_cutoff Amplitude cutoff.
 * @param ringwidth Ringwidth.
 * @param options Set of options.
 * @return Output image.
 */
static VImage mask_butterworth_ring( int width, int height, double order, double frequency_cutoff, double amplitude_cutoff, double ringwidth, VOption *options = 0 );

/**
 * Make fractal filter.
 *
 * **Optional parameters**
 *   - **uchar** -- Output an unsigned char image, bool.
 *   - **nodc** -- Remove DC component, bool.
 *   - **reject** -- Invert the sense of the filter, bool.
 *   - **optical** -- Rotate quadrants to optical space, bool.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param fractal_dimension Fractal dimension.
 * @param options Set of options.
 * @return Output image.
 */
static VImage mask_fractal( int width, int height, double fractal_dimension, VOption *options = 0 );

/**
 * Make a gaussian filter.
 *
 * **Optional parameters**
 *   - **uchar** -- Output an unsigned char image, bool.
 *   - **nodc** -- Remove DC component, bool.
 *   - **reject** -- Invert the sense of the filter, bool.
 *   - **optical** -- Rotate quadrants to optical space, bool.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param frequency_cutoff Frequency cutoff.
 * @param amplitude_cutoff Amplitude cutoff.
 * @param options Set of options.
 * @return Output image.
 */
static VImage mask_gaussian( int width, int height, double frequency_cutoff, double amplitude_cutoff, VOption *options = 0 );

/**
 * Make a gaussian filter.
 *
 * **Optional parameters**
 *   - **uchar** -- Output an unsigned char image, bool.
 *   - **nodc** -- Remove DC component, bool.
 *   - **reject** -- Invert the sense of the filter, bool.
 *   - **optical** -- Rotate quadrants to optical space, bool.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param frequency_cutoff_x Frequency cutoff x.
 * @param frequency_cutoff_y Frequency cutoff y.
 * @param radius Radius of circle.
 * @param amplitude_cutoff Amplitude cutoff.
 * @param options Set of options.
 * @return Output image.
 */
static VImage mask_gaussian_band( int width, int height, double frequency_cutoff_x, double frequency_cutoff_y, double radius, double amplitude_cutoff, VOption *options = 0 );

/**
 * Make a gaussian ring filter.
 *
 * **Optional parameters**
 *   - **uchar** -- Output an unsigned char image, bool.
 *   - **nodc** -- Remove DC component, bool.
 *   - **reject** -- Invert the sense of the filter, bool.
 *   - **optical** -- Rotate quadrants to optical space, bool.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param frequency_cutoff Frequency cutoff.
 * @param amplitude_cutoff Amplitude cutoff.
 * @param ringwidth Ringwidth.
 * @param options Set of options.
 * @return Output image.
 */
static VImage mask_gaussian_ring( int width, int height, double frequency_cutoff, double amplitude_cutoff, double ringwidth, VOption *options = 0 );

/**
 * Make an ideal filter.
 *
 * **Optional parameters**
 *   - **uchar** -- Output an unsigned char image, bool.
 *   - **nodc** -- Remove DC component, bool.
 *   - **reject** -- Invert the sense of the filter, bool.
 *   - **optical** -- Rotate quadrants to optical space, bool.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param frequency_cutoff Frequency cutoff.
 * @param options Set of options.
 * @return Output image.
 */
static VImage mask_ideal( int width, int height, double frequency_cutoff, VOption *options = 0 );

/**
 * Make an ideal band filter.
 *
 * **Optional parameters**
 *   - **uchar** -- Output an unsigned char image, bool.
 *   - **nodc** -- Remove DC component, bool.
 *   - **reject** -- Invert the sense of the filter, bool.
 *   - **optical** -- Rotate quadrants to optical space, bool.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param frequency_cutoff_x Frequency cutoff x.
 * @param frequency_cutoff_y Frequency cutoff y.
 * @param radius Radius of circle.
 * @param options Set of options.
 * @return Output image.
 */
static VImage mask_ideal_band( int width, int height, double frequency_cutoff_x, double frequency_cutoff_y, double radius, VOption *options = 0 );

/**
 * Make an ideal ring filter.
 *
 * **Optional parameters**
 *   - **uchar** -- Output an unsigned char image, bool.
 *   - **nodc** -- Remove DC component, bool.
 *   - **reject** -- Invert the sense of the filter, bool.
 *   - **optical** -- Rotate quadrants to optical space, bool.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param frequency_cutoff Frequency cutoff.
 * @param ringwidth Ringwidth.
 * @param options Set of options.
 * @return Output image.
 */
static VImage mask_ideal_ring( int width, int height, double frequency_cutoff, double ringwidth, VOption *options = 0 );

/**
 * First-order match of two images.
 *
 * **Optional parameters**
 *   - **hwindow** -- Half window size, int.
 *   - **harea** -- Half area size, int.
 *   - **search** -- Search to improve tie-points, bool.
 *   - **interpolate** -- Interpolate pixels with this, VInterpolate.
 *
 * @param sec Secondary image.
 * @param xr1 Position of first reference tie-point.
 * @param yr1 Position of first reference tie-point.
 * @param xs1 Position of first secondary tie-point.
 * @param ys1 Position of first secondary tie-point.
 * @param xr2 Position of second reference tie-point.
 * @param yr2 Position of second reference tie-point.
 * @param xs2 Position of second secondary tie-point.
 * @param ys2 Position of second secondary tie-point.
 * @param options Set of options.
 * @return Output image.
 */
VImage match( VImage sec, int xr1, int yr1, int xs1, int ys1, int xr2, int yr2, int xs2, int ys2, VOption *options = 0 ) const;

/**
 * Apply a math operation to an image.
 * @param math Math to perform.
 * @param options Set of options.
 * @return Output image.
 */
VImage math( VipsOperationMath math, VOption *options = 0 ) const;

/**
 * Binary math operations.
 * @param right Right-hand image argument.
 * @param math2 Math to perform.
 * @param options Set of options.
 * @return Output image.
 */
VImage math2( VImage right, VipsOperationMath2 math2, VOption *options = 0 ) const;

/**
 * Binary math operations with a constant.
 * @param math2 Math to perform.
 * @param c Array of constants.
 * @param options Set of options.
 * @return Output image.
 */
VImage math2_const( VipsOperationMath2 math2, std::vector<double> c, VOption *options = 0 ) const;

/**
 * Load mat from file.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage matload( const char *filename, VOption *options = 0 );

/**
 * Invert an matrix.
 * @param options Set of options.
 * @return Output matrix.
 */
VImage matrixinvert( VOption *options = 0 ) const;

/**
 * Load matrix.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage matrixload( const char *filename, VOption *options = 0 );

/**
 * Load matrix.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage matrixload_source( VSource source, VOption *options = 0 );

/**
 * Print matrix.
 *
 * **Optional parameters**
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param options Set of options.
 */
void matrixprint( VOption *options = 0 ) const;

/**
 * Save image to matrix.
 *
 * **Optional parameters**
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to save to.
 * @param options Set of options.
 */
void matrixsave( const char *filename, VOption *options = 0 ) const;

/**
 * Save image to matrix.
 *
 * **Optional parameters**
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param target Target to save to.
 * @param options Set of options.
 */
void matrixsave_target( VTarget target, VOption *options = 0 ) const;

/**
 * Find image maximum.
 *
 * **Optional parameters**
 *   - **size** -- Number of maximum values to find, int.
 *
 * @param options Set of options.
 * @return Output value.
 */
double max( VOption *options = 0 ) const;

/**
 * Measure a set of patches on a color chart.
 *
 * **Optional parameters**
 *   - **left** -- Left edge of extract area, int.
 *   - **top** -- Top edge of extract area, int.
 *   - **width** -- Width of extract area, int.
 *   - **height** -- Height of extract area, int.
 *
 * @param h Number of patches across chart.
 * @param v Number of patches down chart.
 * @param options Set of options.
 * @return Output array of statistics.
 */
VImage measure( int h, int v, VOption *options = 0 ) const;

/**
 * Merge two images.
 *
 * **Optional parameters**
 *   - **mblend** -- Maximum blend size, int.
 *
 * @param sec Secondary image.
 * @param direction Horizontal or vertical merge.
 * @param dx Horizontal displacement from sec to ref.
 * @param dy Vertical displacement from sec to ref.
 * @param options Set of options.
 * @return Output image.
 */
VImage merge( VImage sec, VipsDirection direction, int dx, int dy, VOption *options = 0 ) const;

/**
 * Find image minimum.
 *
 * **Optional parameters**
 *   - **size** -- Number of minimum values to find, int.
 *
 * @param options Set of options.
 * @return Output value.
 */
double min( VOption *options = 0 ) const;

/**
 * Morphology operation.
 * @param mask Input matrix image.
 * @param morph Morphological operation to perform.
 * @param options Set of options.
 * @return Output image.
 */
VImage morph( VImage mask, VipsOperationMorphology morph, VOption *options = 0 ) const;

/**
 * Mosaic two images.
 *
 * **Optional parameters**
 *   - **hwindow** -- Half window size, int.
 *   - **harea** -- Half area size, int.
 *   - **mblend** -- Maximum blend size, int.
 *   - **bandno** -- Band to search for features on, int.
 *
 * @param sec Secondary image.
 * @param direction Horizontal or vertical mosaic.
 * @param xref Position of reference tie-point.
 * @param yref Position of reference tie-point.
 * @param xsec Position of secondary tie-point.
 * @param ysec Position of secondary tie-point.
 * @param options Set of options.
 * @return Output image.
 */
VImage mosaic( VImage sec, VipsDirection direction, int xref, int yref, int xsec, int ysec, VOption *options = 0 ) const;

/**
 * First-order mosaic of two images.
 *
 * **Optional parameters**
 *   - **hwindow** -- Half window size, int.
 *   - **harea** -- Half area size, int.
 *   - **search** -- Search to improve tie-points, bool.
 *   - **interpolate** -- Interpolate pixels with this, VInterpolate.
 *   - **mblend** -- Maximum blend size, int.
 *
 * @param sec Secondary image.
 * @param direction Horizontal or vertical mosaic.
 * @param xr1 Position of first reference tie-point.
 * @param yr1 Position of first reference tie-point.
 * @param xs1 Position of first secondary tie-point.
 * @param ys1 Position of first secondary tie-point.
 * @param xr2 Position of second reference tie-point.
 * @param yr2 Position of second reference tie-point.
 * @param xs2 Position of second secondary tie-point.
 * @param ys2 Position of second secondary tie-point.
 * @param options Set of options.
 * @return Output image.
 */
VImage mosaic1( VImage sec, VipsDirection direction, int xr1, int yr1, int xs1, int ys1, int xr2, int yr2, int xs2, int ys2, VOption *options = 0 ) const;

/**
 * Pick most-significant byte from an image.
 *
 * **Optional parameters**
 *   - **band** -- Band to msb, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage msb( VOption *options = 0 ) const;

/**
 * Multiply two images.
 * @param right Right-hand image argument.
 * @param options Set of options.
 * @return Output image.
 */
VImage multiply( VImage right, VOption *options = 0 ) const;

/**
 * Load nifti volume.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage niftiload( const char *filename, VOption *options = 0 );

/**
 * Load nifti volumes.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage niftiload_source( VSource source, VOption *options = 0 );

/**
 * Save image to nifti file.
 *
 * **Optional parameters**
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to save to.
 * @param options Set of options.
 */
void niftisave( const char *filename, VOption *options = 0 ) const;

/**
 * Load an openexr image.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage openexrload( const char *filename, VOption *options = 0 );

/**
 * Load file with openslide.
 *
 * **Optional parameters**
 *   - **level** -- Load this level from the file, int.
 *   - **autocrop** -- Crop to image bounds, bool.
 *   - **associated** -- Load this associated image, const char *.
 *   - **attach_associated** -- Attach all associated images, bool.
 *   - **rgb** -- Output RGB (not RGBA), bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage openslideload( const char *filename, VOption *options = 0 );

/**
 * Load source with openslide.
 *
 * **Optional parameters**
 *   - **level** -- Load this level from the file, int.
 *   - **autocrop** -- Crop to image bounds, bool.
 *   - **associated** -- Load this associated image, const char *.
 *   - **attach_associated** -- Attach all associated images, bool.
 *   - **rgb** -- Output RGB (not RGBA), bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage openslideload_source( VSource source, VOption *options = 0 );

/**
 * Load pdf from file.
 *
 * **Optional parameters**
 *   - **page** -- First page to load, int.
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **dpi** -- DPI to render at, double.
 *   - **scale** -- Factor to scale by, double.
 *   - **background** -- Background colour, std::vector<double>.
 *   - **password** -- Password to decrypt with, const char *.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage pdfload( const char *filename, VOption *options = 0 );

/**
 * Load pdf from buffer.
 *
 * **Optional parameters**
 *   - **page** -- First page to load, int.
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **dpi** -- DPI to render at, double.
 *   - **scale** -- Factor to scale by, double.
 *   - **background** -- Background colour, std::vector<double>.
 *   - **password** -- Password to decrypt with, const char *.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param buffer Buffer to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage pdfload_buffer( VipsBlob *buffer, VOption *options = 0 );

/**
 * Load pdf from source.
 *
 * **Optional parameters**
 *   - **page** -- First page to load, int.
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **dpi** -- DPI to render at, double.
 *   - **scale** -- Factor to scale by, double.
 *   - **background** -- Background colour, std::vector<double>.
 *   - **password** -- Password to decrypt with, const char *.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage pdfload_source( VSource source, VOption *options = 0 );

/**
 * Find threshold for percent of pixels.
 * @param percent Percent of pixels.
 * @param options Set of options.
 * @return Threshold above which lie percent of pixels.
 */
int percent( double percent, VOption *options = 0 ) const;

/**
 * Make a perlin noise image.
 *
 * **Optional parameters**
 *   - **cell_size** -- Size of Perlin cells, int.
 *   - **uchar** -- Output an unsigned char image, bool.
 *   - **seed** -- Random number seed, int.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param options Set of options.
 * @return Output image.
 */
static VImage perlin( int width, int height, VOption *options = 0 );

/**
 * Calculate phase correlation.
 * @param in2 Second input image.
 * @param options Set of options.
 * @return Output image.
 */
VImage phasecor( VImage in2, VOption *options = 0 ) const;

/**
 * Load png from file.
 *
 * **Optional parameters**
 *   - **unlimited** -- Remove all denial of service limits, bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage pngload( const char *filename, VOption *options = 0 );

/**
 * Load png from buffer.
 *
 * **Optional parameters**
 *   - **unlimited** -- Remove all denial of service limits, bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param buffer Buffer to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage pngload_buffer( VipsBlob *buffer, VOption *options = 0 );

/**
 * Load png from source.
 *
 * **Optional parameters**
 *   - **unlimited** -- Remove all denial of service limits, bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage pngload_source( VSource source, VOption *options = 0 );

/**
 * Save image to file as png.
 *
 * **Optional parameters**
 *   - **compression** -- Compression factor, int.
 *   - **interlace** -- Interlace image, bool.
 *   - **profile** -- ICC profile to embed, const char *.
 *   - **filter** -- libspng row filter flag(s), int.
 *   - **palette** -- Quantise to 8bpp palette, bool.
 *   - **Q** -- Quantisation quality, int.
 *   - **dither** -- Amount of dithering, double.
 *   - **bitdepth** -- Write as a 1, 2, 4, 8 or 16 bit image, int.
 *   - **effort** -- Quantisation CPU effort, int.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to save to.
 * @param options Set of options.
 */
void pngsave( const char *filename, VOption *options = 0 ) const;

/**
 * Save image to buffer as png.
 *
 * **Optional parameters**
 *   - **compression** -- Compression factor, int.
 *   - **interlace** -- Interlace image, bool.
 *   - **profile** -- ICC profile to embed, const char *.
 *   - **filter** -- libspng row filter flag(s), int.
 *   - **palette** -- Quantise to 8bpp palette, bool.
 *   - **Q** -- Quantisation quality, int.
 *   - **dither** -- Amount of dithering, double.
 *   - **bitdepth** -- Write as a 1, 2, 4, 8 or 16 bit image, int.
 *   - **effort** -- Quantisation CPU effort, int.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param options Set of options.
 * @return Buffer to save to.
 */
VipsBlob *pngsave_buffer( VOption *options = 0 ) const;

/**
 * Save image to target as png.
 *
 * **Optional parameters**
 *   - **compression** -- Compression factor, int.
 *   - **interlace** -- Interlace image, bool.
 *   - **profile** -- ICC profile to embed, const char *.
 *   - **filter** -- libspng row filter flag(s), int.
 *   - **palette** -- Quantise to 8bpp palette, bool.
 *   - **Q** -- Quantisation quality, int.
 *   - **dither** -- Amount of dithering, double.
 *   - **bitdepth** -- Write as a 1, 2, 4, 8 or 16 bit image, int.
 *   - **effort** -- Quantisation CPU effort, int.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param target Target to save to.
 * @param options Set of options.
 */
void pngsave_target( VTarget target, VOption *options = 0 ) const;

/**
 * Load ppm from file.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage ppmload( const char *filename, VOption *options = 0 );

/**
 * Load ppm base class.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage ppmload_source( VSource source, VOption *options = 0 );

/**
 * Save image to ppm file.
 *
 * **Optional parameters**
 *   - **format** -- Format to save in, VipsForeignPpmFormat.
 *   - **ascii** -- Save as ascii, bool.
 *   - **bitdepth** -- Set to 1 to write as a 1 bit image, int.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to save to.
 * @param options Set of options.
 */
void ppmsave( const char *filename, VOption *options = 0 ) const;

/**
 * Save to ppm.
 *
 * **Optional parameters**
 *   - **format** -- Format to save in, VipsForeignPpmFormat.
 *   - **ascii** -- Save as ascii, bool.
 *   - **bitdepth** -- Set to 1 to write as a 1 bit image, int.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param target Target to save to.
 * @param options Set of options.
 */
void ppmsave_target( VTarget target, VOption *options = 0 ) const;

/**
 * Premultiply image alpha.
 *
 * **Optional parameters**
 *   - **max_alpha** -- Maximum value of alpha channel, double.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage premultiply( VOption *options = 0 ) const;

/**
 * Find image profiles.
 * @param rows First non-zero pixel in row.
 * @param options Set of options.
 * @return First non-zero pixel in column.
 */
VImage profile( VImage *rows, VOption *options = 0 ) const;

/**
 * Load named icc profile.
 * @param name Profile name.
 * @param options Set of options.
 * @return Loaded profile.
 */
static VipsBlob *profile_load( const char *name, VOption *options = 0 );

/**
 * Find image projections.
 * @param rows Sums of rows.
 * @param options Set of options.
 * @return Sums of columns.
 */
VImage project( VImage *rows, VOption *options = 0 ) const;

/**
 * Resample an image with a quadratic transform.
 *
 * **Optional parameters**
 *   - **interpolate** -- Interpolate values with this, VInterpolate.
 *
 * @param coeff Coefficient matrix.
 * @param options Set of options.
 * @return Output image.
 */
VImage quadratic( VImage coeff, VOption *options = 0 ) const;

/**
 * Unpack radiance coding to float rgb.
 * @param options Set of options.
 * @return Output image.
 */
VImage rad2float( VOption *options = 0 ) const;

/**
 * Load a radiance image from a file.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage radload( const char *filename, VOption *options = 0 );

/**
 * Load rad from buffer.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param buffer Buffer to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage radload_buffer( VipsBlob *buffer, VOption *options = 0 );

/**
 * Load rad from source.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage radload_source( VSource source, VOption *options = 0 );

/**
 * Save image to radiance file.
 *
 * **Optional parameters**
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to save to.
 * @param options Set of options.
 */
void radsave( const char *filename, VOption *options = 0 ) const;

/**
 * Save image to radiance buffer.
 *
 * **Optional parameters**
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param options Set of options.
 * @return Buffer to save to.
 */
VipsBlob *radsave_buffer( VOption *options = 0 ) const;

/**
 * Save image to radiance target.
 *
 * **Optional parameters**
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param target Target to save to.
 * @param options Set of options.
 */
void radsave_target( VTarget target, VOption *options = 0 ) const;

/**
 * Rank filter.
 * @param width Window width in pixels.
 * @param height Window height in pixels.
 * @param index Select pixel at index.
 * @param options Set of options.
 * @return Output image.
 */
VImage rank( int width, int height, int index, VOption *options = 0 ) const;

/**
 * Load raw data from a file.
 *
 * **Optional parameters**
 *   - **offset** -- Offset in bytes from start of file, guint64.
 *   - **format** -- Pixel format in image, VipsBandFormat.
 *   - **interpretation** -- Pixel interpretation, VipsInterpretation.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param bands Number of bands in image.
 * @param options Set of options.
 * @return Output image.
 */
static VImage rawload( const char *filename, int width, int height, int bands, VOption *options = 0 );

/**
 * Save image to raw file.
 *
 * **Optional parameters**
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to save to.
 * @param options Set of options.
 */
void rawsave( const char *filename, VOption *options = 0 ) const;

/**
 * Write raw image to file descriptor.
 *
 * **Optional parameters**
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param fd File descriptor to write to.
 * @param options Set of options.
 */
void rawsave_fd( int fd, VOption *options = 0 ) const;

/**
 * Linear recombination with matrix.
 * @param m Matrix of coefficients.
 * @param options Set of options.
 * @return Output image.
 */
VImage recomb( VImage m, VOption *options = 0 ) const;

/**
 * Reduce an image.
 *
 * **Optional parameters**
 *   - **kernel** -- Resampling kernel, VipsKernel.
 *   - **gap** -- Reducing gap, double.
 *
 * @param hshrink Horizontal shrink factor.
 * @param vshrink Vertical shrink factor.
 * @param options Set of options.
 * @return Output image.
 */
VImage reduce( double hshrink, double vshrink, VOption *options = 0 ) const;

/**
 * Shrink an image horizontally.
 *
 * **Optional parameters**
 *   - **kernel** -- Resampling kernel, VipsKernel.
 *   - **gap** -- Reducing gap, double.
 *
 * @param hshrink Horizontal shrink factor.
 * @param options Set of options.
 * @return Output image.
 */
VImage reduceh( double hshrink, VOption *options = 0 ) const;

/**
 * Shrink an image vertically.
 *
 * **Optional parameters**
 *   - **kernel** -- Resampling kernel, VipsKernel.
 *   - **gap** -- Reducing gap, double.
 *
 * @param vshrink Vertical shrink factor.
 * @param options Set of options.
 * @return Output image.
 */
VImage reducev( double vshrink, VOption *options = 0 ) const;

/**
 * Relational operation on two images.
 * @param right Right-hand image argument.
 * @param relational Relational to perform.
 * @param options Set of options.
 * @return Output image.
 */
VImage relational( VImage right, VipsOperationRelational relational, VOption *options = 0 ) const;

/**
 * Relational operations against a constant.
 * @param relational Relational to perform.
 * @param c Array of constants.
 * @param options Set of options.
 * @return Output image.
 */
VImage relational_const( VipsOperationRelational relational, std::vector<double> c, VOption *options = 0 ) const;

/**
 * Remainder after integer division of two images.
 * @param right Right-hand image argument.
 * @param options Set of options.
 * @return Output image.
 */
VImage remainder( VImage right, VOption *options = 0 ) const;

/**
 * Remainder after integer division of an image and a constant.
 * @param c Array of constants.
 * @param options Set of options.
 * @return Output image.
 */
VImage remainder_const( std::vector<double> c, VOption *options = 0 ) const;

/**
 * Replicate an image.
 * @param across Repeat this many times horizontally.
 * @param down Repeat this many times vertically.
 * @param options Set of options.
 * @return Output image.
 */
VImage replicate( int across, int down, VOption *options = 0 ) const;

/**
 * Resize an image.
 *
 * **Optional parameters**
 *   - **kernel** -- Resampling kernel, VipsKernel.
 *   - **gap** -- Reducing gap, double.
 *   - **vscale** -- Vertical scale image by this factor, double.
 *
 * @param scale Scale image by this factor.
 * @param options Set of options.
 * @return Output image.
 */
VImage resize( double scale, VOption *options = 0 ) const;

/**
 * Rotate an image.
 * @param angle Angle to rotate image.
 * @param options Set of options.
 * @return Output image.
 */
VImage rot( VipsAngle angle, VOption *options = 0 ) const;

/**
 * Rotate an image.
 *
 * **Optional parameters**
 *   - **angle** -- Angle to rotate image, VipsAngle45.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage rot45( VOption *options = 0 ) const;

/**
 * Rotate an image by a number of degrees.
 *
 * **Optional parameters**
 *   - **interpolate** -- Interpolate pixels with this, VInterpolate.
 *   - **background** -- Background value, std::vector<double>.
 *   - **odx** -- Horizontal output displacement, double.
 *   - **ody** -- Vertical output displacement, double.
 *   - **idx** -- Horizontal input displacement, double.
 *   - **idy** -- Vertical input displacement, double.
 *
 * @param angle Rotate anticlockwise by this many degrees.
 * @param options Set of options.
 * @return Output image.
 */
VImage rotate( double angle, VOption *options = 0 ) const;

/**
 * Perform a round function on an image.
 * @param round Rounding operation to perform.
 * @param options Set of options.
 * @return Output image.
 */
VImage round( VipsOperationRound round, VOption *options = 0 ) const;

/**
 * Transform srgb to hsv.
 * @param options Set of options.
 * @return Output image.
 */
VImage sRGB2HSV( VOption *options = 0 ) const;

/**
 * Convert an srgb image to scrgb.
 * @param options Set of options.
 * @return Output image.
 */
VImage sRGB2scRGB( VOption *options = 0 ) const;

/**
 * Convert scrgb to bw.
 *
 * **Optional parameters**
 *   - **depth** -- Output device space depth in bits, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage scRGB2BW( VOption *options = 0 ) const;

/**
 * Transform scrgb to xyz.
 * @param options Set of options.
 * @return Output image.
 */
VImage scRGB2XYZ( VOption *options = 0 ) const;

/**
 * Convert an scrgb image to srgb.
 *
 * **Optional parameters**
 *   - **depth** -- Output device space depth in bits, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage scRGB2sRGB( VOption *options = 0 ) const;

/**
 * Scale an image to uchar.
 *
 * **Optional parameters**
 *   - **exp** -- Exponent for log scale, double.
 *   - **log** -- Log scale, bool.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage scale( VOption *options = 0 ) const;

/**
 * Check sequential access.
 *
 * **Optional parameters**
 *   - **tile_height** -- Tile height in pixels, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage sequential( VOption *options = 0 ) const;

/**
 * Unsharp masking for print.
 *
 * **Optional parameters**
 *   - **sigma** -- Sigma of Gaussian, double.
 *   - **x1** -- Flat/jaggy threshold, double.
 *   - **y2** -- Maximum brightening, double.
 *   - **y3** -- Maximum darkening, double.
 *   - **m1** -- Slope for flat areas, double.
 *   - **m2** -- Slope for jaggy areas, double.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage sharpen( VOption *options = 0 ) const;

/**
 * Shrink an image.
 *
 * **Optional parameters**
 *   - **ceil** -- Round-up output dimensions, bool.
 *
 * @param hshrink Horizontal shrink factor.
 * @param vshrink Vertical shrink factor.
 * @param options Set of options.
 * @return Output image.
 */
VImage shrink( double hshrink, double vshrink, VOption *options = 0 ) const;

/**
 * Shrink an image horizontally.
 *
 * **Optional parameters**
 *   - **ceil** -- Round-up output dimensions, bool.
 *
 * @param hshrink Horizontal shrink factor.
 * @param options Set of options.
 * @return Output image.
 */
VImage shrinkh( int hshrink, VOption *options = 0 ) const;

/**
 * Shrink an image vertically.
 *
 * **Optional parameters**
 *   - **ceil** -- Round-up output dimensions, bool.
 *
 * @param vshrink Vertical shrink factor.
 * @param options Set of options.
 * @return Output image.
 */
VImage shrinkv( int vshrink, VOption *options = 0 ) const;

/**
 * Unit vector of pixel.
 * @param options Set of options.
 * @return Output image.
 */
VImage sign( VOption *options = 0 ) const;

/**
 * Similarity transform of an image.
 *
 * **Optional parameters**
 *   - **scale** -- Scale by this factor, double.
 *   - **angle** -- Rotate anticlockwise by this many degrees, double.
 *   - **interpolate** -- Interpolate pixels with this, VInterpolate.
 *   - **background** -- Background value, std::vector<double>.
 *   - **odx** -- Horizontal output displacement, double.
 *   - **ody** -- Vertical output displacement, double.
 *   - **idx** -- Horizontal input displacement, double.
 *   - **idy** -- Vertical input displacement, double.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage similarity( VOption *options = 0 ) const;

/**
 * Make a 2d sine wave.
 *
 * **Optional parameters**
 *   - **uchar** -- Output an unsigned char image, bool.
 *   - **hfreq** -- Horizontal spatial frequency, double.
 *   - **vfreq** -- Vertical spatial frequency, double.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param options Set of options.
 * @return Output image.
 */
static VImage sines( int width, int height, VOption *options = 0 );

/**
 * Extract an area from an image.
 *
 * **Optional parameters**
 *   - **interesting** -- How to measure interestingness, VipsInteresting.
 *
 * @param width Width of extract area.
 * @param height Height of extract area.
 * @param options Set of options.
 * @return Output image.
 */
VImage smartcrop( int width, int height, VOption *options = 0 ) const;

/**
 * Sobel edge detector.
 * @param options Set of options.
 * @return Output image.
 */
VImage sobel( VOption *options = 0 ) const;

/**
 * Spatial correlation.
 * @param ref Input reference image.
 * @param options Set of options.
 * @return Output image.
 */
VImage spcor( VImage ref, VOption *options = 0 ) const;

/**
 * Make displayable power spectrum.
 * @param options Set of options.
 * @return Output image.
 */
VImage spectrum( VOption *options = 0 ) const;

/**
 * Find many image stats.
 * @param options Set of options.
 * @return Output array of statistics.
 */
VImage stats( VOption *options = 0 ) const;

/**
 * Statistical difference.
 *
 * **Optional parameters**
 *   - **s0** -- New deviation, double.
 *   - **b** -- Weight of new deviation, double.
 *   - **m0** -- New mean, double.
 *   - **a** -- Weight of new mean, double.
 *
 * @param width Window width in pixels.
 * @param height Window height in pixels.
 * @param options Set of options.
 * @return Output image.
 */
VImage stdif( int width, int height, VOption *options = 0 ) const;

/**
 * Subsample an image.
 *
 * **Optional parameters**
 *   - **point** -- Point sample, bool.
 *
 * @param xfac Horizontal subsample factor.
 * @param yfac Vertical subsample factor.
 * @param options Set of options.
 * @return Output image.
 */
VImage subsample( int xfac, int yfac, VOption *options = 0 ) const;

/**
 * Subtract two images.
 * @param right Right-hand image argument.
 * @param options Set of options.
 * @return Output image.
 */
VImage subtract( VImage right, VOption *options = 0 ) const;

/**
 * Sum an array of images.
 * @param in Array of input images.
 * @param options Set of options.
 * @return Output image.
 */
static VImage sum( std::vector<VImage> in, VOption *options = 0 );

/**
 * Load svg with rsvg.
 *
 * **Optional parameters**
 *   - **dpi** -- Render at this DPI, double.
 *   - **scale** -- Scale output by this factor, double.
 *   - **unlimited** -- Allow SVG of any size, bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage svgload( const char *filename, VOption *options = 0 );

/**
 * Load svg with rsvg.
 *
 * **Optional parameters**
 *   - **dpi** -- Render at this DPI, double.
 *   - **scale** -- Scale output by this factor, double.
 *   - **unlimited** -- Allow SVG of any size, bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param buffer Buffer to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage svgload_buffer( VipsBlob *buffer, VOption *options = 0 );

/**
 * Load svg from source.
 *
 * **Optional parameters**
 *   - **dpi** -- Render at this DPI, double.
 *   - **scale** -- Scale output by this factor, double.
 *   - **unlimited** -- Allow SVG of any size, bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage svgload_source( VSource source, VOption *options = 0 );

/**
 * Find the index of the first non-zero pixel in tests.
 * @param tests Table of images to test.
 * @param options Set of options.
 * @return Output image.
 */
static VImage switch_image( std::vector<VImage> tests, VOption *options = 0 );

/**
 * Run an external command.
 *
 * **Optional parameters**
 *   - **in** -- Array of input images, std::vector<VImage>.
 *   - **out_format** -- Format for output filename, const char *.
 *   - **in_format** -- Format for input filename, const char *.
 *
 * @param cmd_format Command to run.
 * @param options Set of options.
 */
static void system( const char *cmd_format, VOption *options = 0 );

/**
 * Make a text image.
 *
 * **Optional parameters**
 *   - **font** -- Font to render with, const char *.
 *   - **width** -- Maximum image width in pixels, int.
 *   - **height** -- Maximum image height in pixels, int.
 *   - **align** -- Align on the low, centre or high edge, VipsAlign.
 *   - **justify** -- Justify lines, bool.
 *   - **dpi** -- DPI to render at, int.
 *   - **spacing** -- Line spacing, int.
 *   - **fontfile** -- Load this font file, const char *.
 *   - **rgba** -- Enable RGBA output, bool.
 *   - **wrap** -- Wrap lines on word or character boundaries, VipsTextWrap.
 *
 * @param text Text to render.
 * @param options Set of options.
 * @return Output image.
 */
static VImage text( const char *text, VOption *options = 0 );

/**
 * Generate thumbnail from file.
 *
 * **Optional parameters**
 *   - **height** -- Size to this height, int.
 *   - **size** -- Only upsize, only downsize, or both, VipsSize.
 *   - **no_rotate** -- Don't use orientation tags to rotate image upright, bool.
 *   - **crop** -- Reduce to fill target rectangle, then crop, VipsInteresting.
 *   - **linear** -- Reduce in linear light, bool.
 *   - **import_profile** -- Fallback import profile, const char *.
 *   - **export_profile** -- Fallback export profile, const char *.
 *   - **intent** -- Rendering intent, VipsIntent.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to read from.
 * @param width Size to this width.
 * @param options Set of options.
 * @return Output image.
 */
static VImage thumbnail( const char *filename, int width, VOption *options = 0 );

/**
 * Generate thumbnail from buffer.
 *
 * **Optional parameters**
 *   - **option_string** -- Options that are passed on to the underlying loader, const char *.
 *   - **height** -- Size to this height, int.
 *   - **size** -- Only upsize, only downsize, or both, VipsSize.
 *   - **no_rotate** -- Don't use orientation tags to rotate image upright, bool.
 *   - **crop** -- Reduce to fill target rectangle, then crop, VipsInteresting.
 *   - **linear** -- Reduce in linear light, bool.
 *   - **import_profile** -- Fallback import profile, const char *.
 *   - **export_profile** -- Fallback export profile, const char *.
 *   - **intent** -- Rendering intent, VipsIntent.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param buffer Buffer to load from.
 * @param width Size to this width.
 * @param options Set of options.
 * @return Output image.
 */
static VImage thumbnail_buffer( VipsBlob *buffer, int width, VOption *options = 0 );

/**
 * Generate thumbnail from image.
 *
 * **Optional parameters**
 *   - **height** -- Size to this height, int.
 *   - **size** -- Only upsize, only downsize, or both, VipsSize.
 *   - **no_rotate** -- Don't use orientation tags to rotate image upright, bool.
 *   - **crop** -- Reduce to fill target rectangle, then crop, VipsInteresting.
 *   - **linear** -- Reduce in linear light, bool.
 *   - **import_profile** -- Fallback import profile, const char *.
 *   - **export_profile** -- Fallback export profile, const char *.
 *   - **intent** -- Rendering intent, VipsIntent.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param width Size to this width.
 * @param options Set of options.
 * @return Output image.
 */
VImage thumbnail_image( int width, VOption *options = 0 ) const;

/**
 * Generate thumbnail from source.
 *
 * **Optional parameters**
 *   - **option_string** -- Options that are passed on to the underlying loader, const char *.
 *   - **height** -- Size to this height, int.
 *   - **size** -- Only upsize, only downsize, or both, VipsSize.
 *   - **no_rotate** -- Don't use orientation tags to rotate image upright, bool.
 *   - **crop** -- Reduce to fill target rectangle, then crop, VipsInteresting.
 *   - **linear** -- Reduce in linear light, bool.
 *   - **import_profile** -- Fallback import profile, const char *.
 *   - **export_profile** -- Fallback export profile, const char *.
 *   - **intent** -- Rendering intent, VipsIntent.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param width Size to this width.
 * @param options Set of options.
 * @return Output image.
 */
static VImage thumbnail_source( VSource source, int width, VOption *options = 0 );

/**
 * Load tiff from file.
 *
 * **Optional parameters**
 *   - **page** -- First page to load, int.
 *   - **subifd** -- Subifd index, int.
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **autorotate** -- Rotate image using orientation tag, bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage tiffload( const char *filename, VOption *options = 0 );

/**
 * Load tiff from buffer.
 *
 * **Optional parameters**
 *   - **page** -- First page to load, int.
 *   - **subifd** -- Subifd index, int.
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **autorotate** -- Rotate image using orientation tag, bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param buffer Buffer to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage tiffload_buffer( VipsBlob *buffer, VOption *options = 0 );

/**
 * Load tiff from source.
 *
 * **Optional parameters**
 *   - **page** -- First page to load, int.
 *   - **subifd** -- Subifd index, int.
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **autorotate** -- Rotate image using orientation tag, bool.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage tiffload_source( VSource source, VOption *options = 0 );

/**
 * Save image to tiff file.
 *
 * **Optional parameters**
 *   - **compression** -- Compression for this file, VipsForeignTiffCompression.
 *   - **Q** -- Q factor, int.
 *   - **predictor** -- Compression prediction, VipsForeignTiffPredictor.
 *   - **profile** -- ICC profile to embed, const char *.
 *   - **tile** -- Write a tiled tiff, bool.
 *   - **tile_width** -- Tile width in pixels, int.
 *   - **tile_height** -- Tile height in pixels, int.
 *   - **pyramid** -- Write a pyramidal tiff, bool.
 *   - **miniswhite** -- Use 0 for white in 1-bit images, bool.
 *   - **bitdepth** -- Write as a 1, 2, 4 or 8 bit image, int.
 *   - **resunit** -- Resolution unit, VipsForeignTiffResunit.
 *   - **xres** -- Horizontal resolution in pixels/mm, double.
 *   - **yres** -- Vertical resolution in pixels/mm, double.
 *   - **bigtiff** -- Write a bigtiff image, bool.
 *   - **properties** -- Write a properties document to IMAGEDESCRIPTION, bool.
 *   - **region_shrink** -- Method to shrink regions, VipsRegionShrink.
 *   - **level** -- ZSTD compression level, int.
 *   - **lossless** -- Enable WEBP lossless mode, bool.
 *   - **depth** -- Pyramid depth, VipsForeignDzDepth.
 *   - **subifd** -- Save pyr layers as sub-IFDs, bool.
 *   - **premultiply** -- Save with premultiplied alpha, bool.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to save to.
 * @param options Set of options.
 */
void tiffsave( const char *filename, VOption *options = 0 ) const;

/**
 * Save image to tiff buffer.
 *
 * **Optional parameters**
 *   - **compression** -- Compression for this file, VipsForeignTiffCompression.
 *   - **Q** -- Q factor, int.
 *   - **predictor** -- Compression prediction, VipsForeignTiffPredictor.
 *   - **profile** -- ICC profile to embed, const char *.
 *   - **tile** -- Write a tiled tiff, bool.
 *   - **tile_width** -- Tile width in pixels, int.
 *   - **tile_height** -- Tile height in pixels, int.
 *   - **pyramid** -- Write a pyramidal tiff, bool.
 *   - **miniswhite** -- Use 0 for white in 1-bit images, bool.
 *   - **bitdepth** -- Write as a 1, 2, 4 or 8 bit image, int.
 *   - **resunit** -- Resolution unit, VipsForeignTiffResunit.
 *   - **xres** -- Horizontal resolution in pixels/mm, double.
 *   - **yres** -- Vertical resolution in pixels/mm, double.
 *   - **bigtiff** -- Write a bigtiff image, bool.
 *   - **properties** -- Write a properties document to IMAGEDESCRIPTION, bool.
 *   - **region_shrink** -- Method to shrink regions, VipsRegionShrink.
 *   - **level** -- ZSTD compression level, int.
 *   - **lossless** -- Enable WEBP lossless mode, bool.
 *   - **depth** -- Pyramid depth, VipsForeignDzDepth.
 *   - **subifd** -- Save pyr layers as sub-IFDs, bool.
 *   - **premultiply** -- Save with premultiplied alpha, bool.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param options Set of options.
 * @return Buffer to save to.
 */
VipsBlob *tiffsave_buffer( VOption *options = 0 ) const;

/**
 * Save image to tiff target.
 *
 * **Optional parameters**
 *   - **compression** -- Compression for this file, VipsForeignTiffCompression.
 *   - **Q** -- Q factor, int.
 *   - **predictor** -- Compression prediction, VipsForeignTiffPredictor.
 *   - **profile** -- ICC profile to embed, const char *.
 *   - **tile** -- Write a tiled tiff, bool.
 *   - **tile_width** -- Tile width in pixels, int.
 *   - **tile_height** -- Tile height in pixels, int.
 *   - **pyramid** -- Write a pyramidal tiff, bool.
 *   - **miniswhite** -- Use 0 for white in 1-bit images, bool.
 *   - **bitdepth** -- Write as a 1, 2, 4 or 8 bit image, int.
 *   - **resunit** -- Resolution unit, VipsForeignTiffResunit.
 *   - **xres** -- Horizontal resolution in pixels/mm, double.
 *   - **yres** -- Vertical resolution in pixels/mm, double.
 *   - **bigtiff** -- Write a bigtiff image, bool.
 *   - **properties** -- Write a properties document to IMAGEDESCRIPTION, bool.
 *   - **region_shrink** -- Method to shrink regions, VipsRegionShrink.
 *   - **level** -- ZSTD compression level, int.
 *   - **lossless** -- Enable WEBP lossless mode, bool.
 *   - **depth** -- Pyramid depth, VipsForeignDzDepth.
 *   - **subifd** -- Save pyr layers as sub-IFDs, bool.
 *   - **premultiply** -- Save with premultiplied alpha, bool.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param target Target to save to.
 * @param options Set of options.
 */
void tiffsave_target( VTarget target, VOption *options = 0 ) const;

/**
 * Cache an image as a set of tiles.
 *
 * **Optional parameters**
 *   - **tile_width** -- Tile width in pixels, int.
 *   - **tile_height** -- Tile height in pixels, int.
 *   - **max_tiles** -- Maximum number of tiles to cache, int.
 *   - **access** -- Expected access pattern, VipsAccess.
 *   - **threaded** -- Allow threaded access, bool.
 *   - **persistent** -- Keep cache between evaluations, bool.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage tilecache( VOption *options = 0 ) const;

/**
 * Build a look-up table.
 *
 * **Optional parameters**
 *   - **in_max** -- Size of LUT to build, int.
 *   - **out_max** -- Maximum value in output LUT, int.
 *   - **Lb** -- Lowest value in output, double.
 *   - **Lw** -- Highest value in output, double.
 *   - **Ps** -- Position of shadow, double.
 *   - **Pm** -- Position of mid-tones, double.
 *   - **Ph** -- Position of highlights, double.
 *   - **S** -- Adjust shadows by this much, double.
 *   - **M** -- Adjust mid-tones by this much, double.
 *   - **H** -- Adjust highlights by this much, double.
 *
 * @param options Set of options.
 * @return Output image.
 */
static VImage tonelut( VOption *options = 0 );

/**
 * Transpose3d an image.
 *
 * **Optional parameters**
 *   - **page_height** -- Height of each input page, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage transpose3d( VOption *options = 0 ) const;

/**
 * Unpremultiply image alpha.
 *
 * **Optional parameters**
 *   - **max_alpha** -- Maximum value of alpha channel, double.
 *   - **alpha_band** -- Unpremultiply with this alpha, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage unpremultiply( VOption *options = 0 ) const;

/**
 * Load vips from file.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage vipsload( const char *filename, VOption *options = 0 );

/**
 * Load vips from source.
 *
 * **Optional parameters**
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage vipsload_source( VSource source, VOption *options = 0 );

/**
 * Save image to file in vips format.
 *
 * **Optional parameters**
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to save to.
 * @param options Set of options.
 */
void vipssave( const char *filename, VOption *options = 0 ) const;

/**
 * Save image to target in vips format.
 *
 * **Optional parameters**
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param target Target to save to.
 * @param options Set of options.
 */
void vipssave_target( VTarget target, VOption *options = 0 ) const;

/**
 * Load webp from file.
 *
 * **Optional parameters**
 *   - **page** -- First page to load, int.
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **scale** -- Factor to scale by, double.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param filename Filename to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage webpload( const char *filename, VOption *options = 0 );

/**
 * Load webp from buffer.
 *
 * **Optional parameters**
 *   - **page** -- First page to load, int.
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **scale** -- Factor to scale by, double.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param buffer Buffer to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage webpload_buffer( VipsBlob *buffer, VOption *options = 0 );

/**
 * Load webp from source.
 *
 * **Optional parameters**
 *   - **page** -- First page to load, int.
 *   - **n** -- Number of pages to load, -1 for all, int.
 *   - **scale** -- Factor to scale by, double.
 *   - **memory** -- Force open via memory, bool.
 *   - **access** -- Required access pattern for this file, VipsAccess.
 *   - **fail_on** -- Error level to fail on, VipsFailOn.
 *
 * @param source Source to load from.
 * @param options Set of options.
 * @return Output image.
 */
static VImage webpload_source( VSource source, VOption *options = 0 );

/**
 * Save as webp.
 *
 * **Optional parameters**
 *   - **Q** -- Q factor, int.
 *   - **lossless** -- Enable lossless compression, bool.
 *   - **preset** -- Preset for lossy compression, VipsForeignWebpPreset.
 *   - **smart_subsample** -- Enable high quality chroma subsampling, bool.
 *   - **near_lossless** -- Enable preprocessing in lossless mode (uses Q), bool.
 *   - **alpha_q** -- Change alpha plane fidelity for lossy compression, int.
 *   - **min_size** -- Optimise for minimum size, bool.
 *   - **kmin** -- Minimum number of frames between key frames, int.
 *   - **kmax** -- Maximum number of frames between key frames, int.
 *   - **effort** -- Level of CPU effort to reduce file size, int.
 *   - **profile** -- ICC profile to embed, const char *.
 *   - **mixed** -- Allow mixed encoding (might reduce file size), bool.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param filename Filename to save to.
 * @param options Set of options.
 */
void webpsave( const char *filename, VOption *options = 0 ) const;

/**
 * Save as webp.
 *
 * **Optional parameters**
 *   - **Q** -- Q factor, int.
 *   - **lossless** -- Enable lossless compression, bool.
 *   - **preset** -- Preset for lossy compression, VipsForeignWebpPreset.
 *   - **smart_subsample** -- Enable high quality chroma subsampling, bool.
 *   - **near_lossless** -- Enable preprocessing in lossless mode (uses Q), bool.
 *   - **alpha_q** -- Change alpha plane fidelity for lossy compression, int.
 *   - **min_size** -- Optimise for minimum size, bool.
 *   - **kmin** -- Minimum number of frames between key frames, int.
 *   - **kmax** -- Maximum number of frames between key frames, int.
 *   - **effort** -- Level of CPU effort to reduce file size, int.
 *   - **profile** -- ICC profile to embed, const char *.
 *   - **mixed** -- Allow mixed encoding (might reduce file size), bool.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param options Set of options.
 * @return Buffer to save to.
 */
VipsBlob *webpsave_buffer( VOption *options = 0 ) const;

/**
 * Save image to webp mime.
 *
 * **Optional parameters**
 *   - **Q** -- Q factor, int.
 *   - **lossless** -- Enable lossless compression, bool.
 *   - **preset** -- Preset for lossy compression, VipsForeignWebpPreset.
 *   - **smart_subsample** -- Enable high quality chroma subsampling, bool.
 *   - **near_lossless** -- Enable preprocessing in lossless mode (uses Q), bool.
 *   - **alpha_q** -- Change alpha plane fidelity for lossy compression, int.
 *   - **min_size** -- Optimise for minimum size, bool.
 *   - **kmin** -- Minimum number of frames between key frames, int.
 *   - **kmax** -- Maximum number of frames between key frames, int.
 *   - **effort** -- Level of CPU effort to reduce file size, int.
 *   - **profile** -- ICC profile to embed, const char *.
 *   - **mixed** -- Allow mixed encoding (might reduce file size), bool.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param options Set of options.
 */
void webpsave_mime( VOption *options = 0 ) const;

/**
 * Save as webp.
 *
 * **Optional parameters**
 *   - **Q** -- Q factor, int.
 *   - **lossless** -- Enable lossless compression, bool.
 *   - **preset** -- Preset for lossy compression, VipsForeignWebpPreset.
 *   - **smart_subsample** -- Enable high quality chroma subsampling, bool.
 *   - **near_lossless** -- Enable preprocessing in lossless mode (uses Q), bool.
 *   - **alpha_q** -- Change alpha plane fidelity for lossy compression, int.
 *   - **min_size** -- Optimise for minimum size, bool.
 *   - **kmin** -- Minimum number of frames between key frames, int.
 *   - **kmax** -- Maximum number of frames between key frames, int.
 *   - **effort** -- Level of CPU effort to reduce file size, int.
 *   - **profile** -- ICC profile to embed, const char *.
 *   - **mixed** -- Allow mixed encoding (might reduce file size), bool.
 *   - **strip** -- Strip all metadata from image, bool.
 *   - **background** -- Background value, std::vector<double>.
 *   - **page_height** -- Set page height for multipage save, int.
 *
 * @param target Target to save to.
 * @param options Set of options.
 */
void webpsave_target( VTarget target, VOption *options = 0 ) const;

/**
 * Make a worley noise image.
 *
 * **Optional parameters**
 *   - **cell_size** -- Size of Worley cells, int.
 *   - **seed** -- Random number seed, int.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param options Set of options.
 * @return Output image.
 */
static VImage worley( int width, int height, VOption *options = 0 );

/**
 * Wrap image origin.
 *
 * **Optional parameters**
 *   - **x** -- Left edge of input in output, int.
 *   - **y** -- Top edge of input in output, int.
 *
 * @param options Set of options.
 * @return Output image.
 */
VImage wrap( VOption *options = 0 ) const;

/**
 * Make an image where pixel values are coordinates.
 *
 * **Optional parameters**
 *   - **csize** -- Size of third dimension, int.
 *   - **dsize** -- Size of fourth dimension, int.
 *   - **esize** -- Size of fifth dimension, int.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param options Set of options.
 * @return Output image.
 */
static VImage xyz( int width, int height, VOption *options = 0 );

/**
 * Make a zone plate.
 *
 * **Optional parameters**
 *   - **uchar** -- Output an unsigned char image, bool.
 *
 * @param width Image width in pixels.
 * @param height Image height in pixels.
 * @param options Set of options.
 * @return Output image.
 */
static VImage zone( int width, int height, VOption *options = 0 );

/**
 * Zoom an image.
 * @param xfac Horizontal zoom factor.
 * @param yfac Vertical zoom factor.
 * @param options Set of options.
 * @return Output image.
 */
VImage zoom( int xfac, int yfac, VOption *options = 0 ) const;
};

VIPS_NAMESPACE_END

#endif /*VIPS_VIMAGE_H*/
