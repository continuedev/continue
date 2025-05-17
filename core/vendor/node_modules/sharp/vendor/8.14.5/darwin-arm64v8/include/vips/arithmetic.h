/* Headers for arithmetic
 *
 * 30/6/09
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

#ifndef VIPS_ARITHMETIC_H
#define VIPS_ARITHMETIC_H

#include <glib.h>
#include <vips/image.h>

#ifdef __cplusplus
extern "C" {
#endif /*__cplusplus*/

/** 
 * VipsOperationMath:
 * @VIPS_OPERATION_MATH_SIN: sin(), angles in degrees
 * @VIPS_OPERATION_MATH_COS: cos(), angles in degrees
 * @VIPS_OPERATION_MATH_TAN: tan(), angles in degrees
 * @VIPS_OPERATION_MATH_ASIN: asin(), angles in degrees
 * @VIPS_OPERATION_MATH_ACOS: acos(), angles in degrees
 * @VIPS_OPERATION_MATH_ATAN: atan(), angles in degrees
 * @VIPS_OPERATION_MATH_LOG: log base e 
 * @VIPS_OPERATION_MATH_LOG10: log base 10 
 * @VIPS_OPERATION_MATH_EXP: e to the something
 * @VIPS_OPERATION_MATH_EXP10: 10 to the something
 * @VIPS_OPERATION_MATH_SINH: sinh(), angles in radians
 * @VIPS_OPERATION_MATH_COSH: cosh(), angles in radians
 * @VIPS_OPERATION_MATH_TANH: tanh(), angles in radians
 * @VIPS_OPERATION_MATH_ASINH: asinh(), angles in radians
 * @VIPS_OPERATION_MATH_ACOSH: acosh(), angles in radians
 * @VIPS_OPERATION_MATH_ATANH: atanh(), angles in radians
 *
 * See also: vips_math().
 */
typedef enum {
	VIPS_OPERATION_MATH_SIN,
	VIPS_OPERATION_MATH_COS,
	VIPS_OPERATION_MATH_TAN,
	VIPS_OPERATION_MATH_ASIN,
	VIPS_OPERATION_MATH_ACOS,
	VIPS_OPERATION_MATH_ATAN,
	VIPS_OPERATION_MATH_LOG,
	VIPS_OPERATION_MATH_LOG10,
	VIPS_OPERATION_MATH_EXP,
	VIPS_OPERATION_MATH_EXP10,
	VIPS_OPERATION_MATH_SINH,
	VIPS_OPERATION_MATH_COSH,
	VIPS_OPERATION_MATH_TANH,
	VIPS_OPERATION_MATH_ASINH,
	VIPS_OPERATION_MATH_ACOSH,
	VIPS_OPERATION_MATH_ATANH,
	VIPS_OPERATION_MATH_LAST
} VipsOperationMath;

/** 
 * VipsOperationMath2:
 * @VIPS_OPERATION_MATH2_POW: pow( left, right )
 * @VIPS_OPERATION_MATH2_WOP: pow( right, left ) 
 * @VIPS_OPERATION_MATH2_ATAN2: atan2( left, right ) 
 *
 * See also: vips_math().
 */
typedef enum {
	VIPS_OPERATION_MATH2_POW,
	VIPS_OPERATION_MATH2_WOP,
	VIPS_OPERATION_MATH2_ATAN2,
	VIPS_OPERATION_MATH2_LAST
} VipsOperationMath2;

/** 
 * VipsOperationRound:
 * @VIPS_OPERATION_ROUND_RINT: round to nearest
 * @VIPS_OPERATION_ROUND_FLOOR: largest integral value not greater than
 * @VIPS_OPERATION_ROUND_CEIL: the smallest integral value not less than
 *
 * See also: vips_round().
 */
typedef enum {
	VIPS_OPERATION_ROUND_RINT,
	VIPS_OPERATION_ROUND_CEIL,
	VIPS_OPERATION_ROUND_FLOOR,
	VIPS_OPERATION_ROUND_LAST
} VipsOperationRound;

/** 
 * VipsOperationRelational:
 * @VIPS_OPERATION_RELATIONAL_EQUAL: ==
 * @VIPS_OPERATION_RELATIONAL_NOTEQ: !=
 * @VIPS_OPERATION_RELATIONAL_LESS: <
 * @VIPS_OPERATION_RELATIONAL_LESSEQ: <=
 * @VIPS_OPERATION_RELATIONAL_MORE: >
 * @VIPS_OPERATION_RELATIONAL_MOREEQ: >=
 *
 * See also: vips_relational().
 */
typedef enum {
	VIPS_OPERATION_RELATIONAL_EQUAL,
	VIPS_OPERATION_RELATIONAL_NOTEQ,
	VIPS_OPERATION_RELATIONAL_LESS,
	VIPS_OPERATION_RELATIONAL_LESSEQ,
	VIPS_OPERATION_RELATIONAL_MORE,
	VIPS_OPERATION_RELATIONAL_MOREEQ,
	VIPS_OPERATION_RELATIONAL_LAST
} VipsOperationRelational;

/** 
 * VipsOperationBoolean:
 * @VIPS_OPERATION_BOOLEAN_AND: &
 * @VIPS_OPERATION_BOOLEAN_OR: |
 * @VIPS_OPERATION_BOOLEAN_EOR: ^
 * @VIPS_OPERATION_BOOLEAN_LSHIFT: >>
 * @VIPS_OPERATION_BOOLEAN_RSHIFT: <<
 *
 * See also: vips_boolean().
 */
typedef enum {
	VIPS_OPERATION_BOOLEAN_AND,
	VIPS_OPERATION_BOOLEAN_OR,
	VIPS_OPERATION_BOOLEAN_EOR,
	VIPS_OPERATION_BOOLEAN_LSHIFT,
	VIPS_OPERATION_BOOLEAN_RSHIFT,
	VIPS_OPERATION_BOOLEAN_LAST
} VipsOperationBoolean;

/** 
 * VipsOperationComplex:
 * @VIPS_OPERATION_COMPLEX_POLAR: convert to polar coordinates
 * @VIPS_OPERATION_COMPLEX_RECT: convert to rectangular coordinates
 * @VIPS_OPERATION_COMPLEX_CONJ: complex conjugate
 *
 * See also: vips_complex().
 */
typedef enum {
	VIPS_OPERATION_COMPLEX_POLAR,
	VIPS_OPERATION_COMPLEX_RECT,
	VIPS_OPERATION_COMPLEX_CONJ,
	VIPS_OPERATION_COMPLEX_LAST
} VipsOperationComplex;

/** 
 * VipsOperationComplex2:
 * @VIPS_OPERATION_COMPLEX2_CROSS_PHASE: convert to polar coordinates
 *
 * See also: vips_complex2().
 */
typedef enum {
	VIPS_OPERATION_COMPLEX2_CROSS_PHASE,
	VIPS_OPERATION_COMPLEX2_LAST
} VipsOperationComplex2;

/** 
 * VipsOperationComplexget:
 * @VIPS_OPERATION_COMPLEXGET_REAL: get real component
 * @VIPS_OPERATION_COMPLEXGET_IMAG: get imaginary component
 *
 * See also: vips_complexget().
 */
typedef enum {
	VIPS_OPERATION_COMPLEXGET_REAL,
	VIPS_OPERATION_COMPLEXGET_IMAG,
	VIPS_OPERATION_COMPLEXGET_LAST
} VipsOperationComplexget;

VIPS_API
int vips_add( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_sum( VipsImage **in, VipsImage **out, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_subtract( VipsImage *in1, VipsImage *in2, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_multiply( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_divide( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_linear( VipsImage *in, VipsImage **out, 
	const double *a, const double *b, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_linear1( VipsImage *in, VipsImage **out, double a, double b, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_remainder( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_remainder_const( VipsImage *in, VipsImage **out, 
	const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_remainder_const1( VipsImage *in, VipsImage **out, 
	double c, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_invert( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_abs( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_sign( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_round( VipsImage *in, VipsImage **out, VipsOperationRound round, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_floor( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_ceil( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_rint( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_math( VipsImage *in, VipsImage **out, 
	VipsOperationMath math, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_sin( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_cos( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_tan( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_asin( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_acos( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_atan( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_exp( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_exp10( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_log( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_log10( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_sinh( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_cosh( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_tanh( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_asinh( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_acosh( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_atanh( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_complex( VipsImage *in, VipsImage **out, 
	VipsOperationComplex cmplx, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_polar( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_rect( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_conj( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_complex2( VipsImage *left, VipsImage *right, VipsImage **out, 
	VipsOperationComplex2 cmplx, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_cross_phase( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_complexget( VipsImage *in, VipsImage **out, 
	VipsOperationComplexget get, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_real( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_imag( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_complexform( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_relational( VipsImage *left, VipsImage *right, VipsImage **out, 
	VipsOperationRelational relational, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_equal( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_notequal( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_less( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_lesseq( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_more( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_moreeq( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_relational_const( VipsImage *in, VipsImage **out, 
	VipsOperationRelational relational, const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_equal_const( VipsImage *in, VipsImage **out, 
	const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_notequal_const( VipsImage *in, VipsImage **out, 
	const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_less_const( VipsImage *in, VipsImage **out, 
	const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_lesseq_const( VipsImage *in, VipsImage **out, 
	const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_more_const( VipsImage *in, VipsImage **out, 
	const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_moreeq_const( VipsImage *in, VipsImage **out, 
	const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_relational_const1( VipsImage *in, VipsImage **out, 
	VipsOperationRelational relational, double c, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_equal_const1( VipsImage *in, VipsImage **out, double c, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_notequal_const1( VipsImage *in, VipsImage **out, double c, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_less_const1( VipsImage *in, VipsImage **out, double c, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_lesseq_const1( VipsImage *in, VipsImage **out, double c, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_more_const1( VipsImage *in, VipsImage **out, double c, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_moreeq_const1( VipsImage *in, VipsImage **out, double c, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_boolean( VipsImage *left, VipsImage *right, VipsImage **out, 
	VipsOperationBoolean boolean, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_andimage( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_orimage( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_eorimage( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_lshift( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_rshift( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_boolean_const( VipsImage *in, VipsImage **out, 
	VipsOperationBoolean boolean, const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_andimage_const( VipsImage *in, VipsImage **out, 
	const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_orimage_const( VipsImage *in, VipsImage **out, 
	const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_eorimage_const( VipsImage *in, VipsImage **out, 
	const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_lshift_const( VipsImage *in, VipsImage **out, 
	const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_rshift_const( VipsImage *in, VipsImage **out, 
	const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_boolean_const1( VipsImage *in, VipsImage **out, 
	VipsOperationBoolean boolean, double c, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_andimage_const1( VipsImage *in, VipsImage **out, double c, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_orimage_const1( VipsImage *in, VipsImage **out, double c, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_eorimage_const1( VipsImage *in, VipsImage **out, double c, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_lshift_const1( VipsImage *in, VipsImage **out, double c, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_rshift_const1( VipsImage *in, VipsImage **out, double c, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_math2( VipsImage *left, VipsImage *right, VipsImage **out, 
	VipsOperationMath2 math2, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_pow( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_wop( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_atan2( VipsImage *left, VipsImage *right, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_math2_const( VipsImage *in, VipsImage **out, 
	VipsOperationMath2 math2, const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_pow_const( VipsImage *in, VipsImage **out, 
	const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_wop_const( VipsImage *in, VipsImage **out, 
	const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_atan2_const( VipsImage *in, VipsImage **out, 
	const double *c, int n, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_math2_const1( VipsImage *in, VipsImage **out, 
	VipsOperationMath2 math2, double c, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_pow_const1( VipsImage *in, VipsImage **out, double c, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_wop_const1( VipsImage *in, VipsImage **out, double c, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_atan2_const1( VipsImage *in, VipsImage **out, double c, ... )
	G_GNUC_NULL_TERMINATED;

VIPS_API
int vips_avg( VipsImage *in, double *out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_deviate( VipsImage *in, double *out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_min( VipsImage *in, double *out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_max( VipsImage *in, double *out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_stats( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_measure( VipsImage *in, VipsImage **out, int h, int v, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_find_trim( VipsImage *in, 
	int *left, int *top, int *width, int *height, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_getpoint( VipsImage *in, double **vector, int *n, int x, int y, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_hist_find( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_hist_find_ndim( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_hist_find_indexed( VipsImage *in, VipsImage *index, 
	VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_hough_line( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_hough_circle( VipsImage *in, VipsImage **out, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_project( VipsImage *in, VipsImage **columns, VipsImage **rows, ... )
	G_GNUC_NULL_TERMINATED;
VIPS_API
int vips_profile( VipsImage *in, VipsImage **columns, VipsImage **rows, ... )
	G_GNUC_NULL_TERMINATED;

#ifdef __cplusplus
}
#endif /*__cplusplus*/

#endif /*VIPS_ARITHMETIC_H*/
