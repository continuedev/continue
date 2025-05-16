/* create.h
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

#ifndef VIPS_CREATE_H
#define VIPS_CREATE_H

#ifdef __cplusplus
extern "C" {
#endif /*__cplusplus*/

typedef enum {
	VIPS_TEXT_WRAP_WORD = 0,
	VIPS_TEXT_WRAP_CHAR,
	VIPS_TEXT_WRAP_WORD_CHAR,
	VIPS_TEXT_WRAP_NONE,
	VIPS_TEXT_WRAP_LAST
} VipsTextWrap;

VIPS_API
int vips_black( VipsImage **out, int width, int height, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_xyz( VipsImage **out, int width, int height, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_grey( VipsImage **out, int width, int height, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_gaussmat( VipsImage **out, double sigma, double min_ampl, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_logmat( VipsImage **out, double sigma, double min_ampl, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_text( VipsImage **out, const char *text, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_gaussnoise( VipsImage **out, int width, int height, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_eye( VipsImage **out, int width, int height, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_sines( VipsImage **out, int width, int height, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_zone( VipsImage **out, int width, int height, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_identity( VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_buildlut( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_invertlut( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_tonelut( VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_mask_ideal( VipsImage **out, int width, int height, 
	double frequency_cutoff, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_mask_ideal_ring( VipsImage **out, int width, int height, 
	double frequency_cutoff, double ringwidth, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_mask_ideal_band( VipsImage **out, int width, int height, 
	double frequency_cutoff_x, double frequency_cutoff_y, 
	double radius, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_mask_butterworth( VipsImage **out, int width, int height, 
	double order, 
	double frequency_cutoff, double amplitude_cutoff, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_mask_butterworth_ring( VipsImage **out, int width, int height, 
	double order, 
	double frequency_cutoff, double amplitude_cutoff, 
	double ringwidth, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_mask_butterworth_band( VipsImage **out, int width, int height, 
	double order, 
	double frequency_cutoff_x, double frequency_cutoff_y, double radius, 
	double amplitude_cutoff, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_mask_gaussian( VipsImage **out, int width, int height, 
	double frequency_cutoff, double amplitude_cutoff, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_mask_gaussian_ring( VipsImage **out, int width, int height, 
	double frequency_cutoff, double amplitude_cutoff, 
	double ringwidth, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_mask_gaussian_band( VipsImage **out, int width, int height, 
	double frequency_cutoff_x, double frequency_cutoff_y, double radius, 
	double amplitude_cutoff, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_mask_fractal( VipsImage **out, int width, int height, 
	double fractal_dimension, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_fractsurf( VipsImage **out, 
	int width, int height, double fractal_dimension, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_worley( VipsImage **out, int width, int height, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_perlin( VipsImage **out, int width, int height, ... )
	G_GNUC_NULL_TERMINATED;

#ifdef __cplusplus
}
#endif /*__cplusplus*/

#endif /*VIPS_CREATE_H*/
