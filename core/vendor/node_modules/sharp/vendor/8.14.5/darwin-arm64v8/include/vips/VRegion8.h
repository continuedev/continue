// VIPS region wrapper

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

#ifndef VIPS_VREGION_H
#define VIPS_VREGION_H

#include <vips/vips.h>

VIPS_NAMESPACE_START

/**
 * A region of an image. Can be used to access raw pixel data.
 * */
class VRegion : public VObject
{
public:
	/**
	 * Create a VRegion that wraps a VipsRegion object. If steal
	 * is STEAL, then this VRegion takes over ownership of the libvips
	 * object and will automatically unref it.
	 */
	VRegion( VipsRegion *region, VSteal steal = STEAL ) :
		VObject( (VipsObject *) region, steal )
	{
	}

	/**
	 * Create a VRegion from an image.
	 */
	static VRegion
	new_from_image( VImage image );

	/**
	 * Get a pointer to the underlying VipsRegion object.
	 */
	VipsRegion *
	get_region() const
	{
		return (VipsRegion *) VObject::get_object();
	}

	/**
	 * Prepare the region from VipsRect.
	 */
	void
	prepare( const VipsRect *rect ) const
	{
		if ( vips_region_prepare( get_region(), rect ) )
			throw VError();
	}

	/**
	 * Prepare the region from rectangle coordinates.
	 */
	void
	prepare( int left, int top, int width, int height ) const
	{
		VipsRect rect = { left, top, width, height };

		prepare( &rect );
	}

	/**
	 * Get valid bounds of the region.
	 */
	VipsRect
	valid() const
	{
		return get_region()->valid;
	}

	/**
	 * Get pointer to the start of the region.
	 */
	VipsPel *
	addr() const
	{
		return addr( 0 );
	}

	/**
	 * Get pointer at the given index of the region.
	 */
	VipsPel *
	addr( size_t i ) const
	{
		return &VIPS_REGION_ADDR_TOPLEFT( get_region() )[i];
	}

	/**
	 * Get pointer at the given coordinates of the region.
	 */
	VipsPel *
	addr( int x, int y ) const
	{
		return VIPS_REGION_ADDR( get_region(), x, y );
	}

	/**
	 * Get the stride (bytes per row, including padding) of the region.
	 */
	size_t
	stride() const
	{
		return VIPS_REGION_LSKIP( get_region() );
	}

	/**
	 * Get VipsPel at the given index of the region.
	 */
	VipsPel
	operator[]( size_t i ) const
	{
		return *addr( i );
	}

	/**
	 * Get VipsPel at the given coordinates of the region.
	 */
	VipsPel
	operator()( int x, int y ) const
	{
		return *addr( x, y );
	}
};

VIPS_NAMESPACE_END

#endif /*VIPS_VREGION_H*/
