/* morphology.h
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

#ifndef VIPS_MORPHOLOGY_H
#define VIPS_MORPHOLOGY_H

#ifdef __cplusplus
extern "C" {
#endif /*__cplusplus*/

typedef enum {
	VIPS_OPERATION_MORPHOLOGY_ERODE,
	VIPS_OPERATION_MORPHOLOGY_DILATE,
	VIPS_OPERATION_MORPHOLOGY_LAST
} VipsOperationMorphology;

VIPS_API
int vips_morph( VipsImage *in, VipsImage **out, VipsImage *mask, 
	VipsOperationMorphology morph, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_rank( VipsImage *in, VipsImage **out, 
	int width, int height, int index, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_median( VipsImage *in, VipsImage **out, int size, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_countlines( VipsImage *in, double *nolines, 
	VipsDirection direction, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_labelregions( VipsImage *in, VipsImage **mask, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_fill_nearest( VipsImage *in, VipsImage **out, ... ) 
	G_GNUC_NULL_TERMINATED;

#ifdef __cplusplus
}
#endif /*__cplusplus*/

#endif /*VIPS_MORPHOLOGY_H*/
