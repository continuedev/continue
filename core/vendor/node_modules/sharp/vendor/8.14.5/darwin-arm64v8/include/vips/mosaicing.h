/* mosaicing.h
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

#ifndef VIPS_MOSAICING_H
#define VIPS_MOSAICING_H

#ifdef __cplusplus
extern "C" {
#endif /*__cplusplus*/

VIPS_API
int vips_merge( VipsImage *ref, VipsImage *sec, VipsImage **out, 
	VipsDirection direction, int dx, int dy, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_mosaic( VipsImage *ref, VipsImage *sec, VipsImage **out, 
	VipsDirection direction, int xref, int yref, int xsec, int ysec, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_mosaic1( VipsImage *ref, VipsImage *sec, VipsImage **out, 
	VipsDirection direction, 
	int xr1, int yr1, int xs1, int ys1, 
	int xr2, int yr2, int xs2, int ys2, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_match( VipsImage *ref, VipsImage *sec, VipsImage **out, 
	int xr1, int yr1, int xs1, int ys1, 
	int xr2, int yr2, int xs2, int ys2, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_globalbalance( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_remosaic( VipsImage *in, VipsImage **out, 
	const char *old_str, const char *new_str, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_matrixinvert( VipsImage *m, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;


#ifdef __cplusplus
}
#endif /*__cplusplus*/

#endif /*VIPS_MOSAICING_H*/
