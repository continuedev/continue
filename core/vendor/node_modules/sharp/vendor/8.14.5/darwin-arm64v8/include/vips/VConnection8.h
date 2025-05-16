// VIPS connection wrapper

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

#ifndef VIPS_VCONNECTION_H
#define VIPS_VCONNECTION_H

#include <vips/vips.h>

VIPS_NAMESPACE_START

/**
 * A generic source object. These supply a stream of bytes that loaders can
 * use to fetch image files, see VImage::new_from_source(). 
 *
 * Methods let you can connect a source up to memory, a file or
 * a file descriptor. Use vips::VSourceCustom to implement custom sources
 * using GObject signals.
 */
class VSource : public VObject
{
public:
	/**
	 * Wrap a VSource around an underlying VipsSource object.
	 */
	VSource( VipsSource *input, VSteal steal = STEAL ) : 
		VObject( (VipsObject *) input, steal )
	{
	}

	/**
	 * Make a new VSource from a file descriptor.
	 */
	static VSource 
	new_from_descriptor( int descriptor );

	/**
	 * Make a new VSource from a file on disc.
	 */
	static VSource 
	new_from_file( const char *filename );

	/**
	 * Make a new VSource from a binary object.
	 */
	static VSource 
	new_from_blob( VipsBlob *blob );

	/**
	 * Make a new VSource from an area of memory.
	 */
	static VSource 
	new_from_memory( const void *data, size_t size );

	/**
	 * Make a new VSource from a set of options encoded as a string. See
	 * vips_source_new().
	 */
	static VSource 
	new_from_options( const char *options );

	/**
	 * Get a pointer to the underlying VipsSoure object. 
	 */
	VipsSource *
	get_source() const
	{
		return( (VipsSource *) VObject::get_object() );
	}

};

/**
 * A generic target object. Savers can use these to write a stream of bytes
 * somewhere, see VImage::write_to_target(). 
 *
 * Methods let you can connect a target up to memory, a file or
 * a file descriptor. Use vips::VTargetCustom to implement custom targets
 * using GObject signals.
 */
class VTarget : public VObject
{
public:
	/**
	 * Wrap a VTarget around an underlying VipsTarget object.
	 */
	VTarget( VipsTarget *output, VSteal steal = STEAL ) : 
		VObject( (VipsObject *) output, steal )
	{
	}

	/**
	 * Make a new VTarget which, when written to, will write to a file 
	 * descriptor.
	 */
	static VTarget 
	new_to_descriptor( int descriptor );

	/**
	 * Make a new VTarget which, when written to, will write to a file.
	 */
	static 
	VTarget new_to_file( const char *filename );

	/**
	 * Make a new VTarget which, when written to, will write to a file
	 * descriptor.
	 */
	static 
	VTarget new_to_memory();

	/**
	 * Get a pointer to the underlying VipsTarget object.
	 */
	VipsTarget *
	get_target() const
	{
		return( (VipsTarget *) VObject::get_object() );
	}

};

VIPS_NAMESPACE_END

#endif /*VIPS_VCONNECTION_H*/
