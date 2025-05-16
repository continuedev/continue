/* A few basic types needed everywhere.
 *
 * 27/10/11
 * 	- from type.h
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

#ifndef VIPS_BASIC_H
#define VIPS_BASIC_H

/* Defined in config.h
 */
#ifdef _VIPS_PUBLIC
#  define VIPS_API _VIPS_PUBLIC extern
#else
#  define VIPS_API extern
#endif

/* VIPS_DISABLE_DEPRECATION_WARNINGS:
 *
 * Disable deprecation warnings from VIPS API.
 *
 * Must be defined before including `vips/vips.h`.
 */
#ifdef VIPS_DISABLE_DEPRECATION_WARNINGS
#  define VIPS_DEPRECATED VIPS_API
#  define VIPS_DEPRECATED_FOR(f) VIPS_API
#else
#  define VIPS_DEPRECATED G_DEPRECATED VIPS_API
#  define VIPS_DEPRECATED_FOR(f) G_DEPRECATED_FOR(f) VIPS_API
#endif

#ifdef __cplusplus
extern "C" {
#endif /*__cplusplus*/

/**
 * VipsPel:
 *
 * A picture element. Cast this to whatever the associated VipsBandFormat says
 * to get the value.
 */
typedef unsigned char VipsPel;

/* Also used for eg. vips_local() and friends.
 */
typedef int (*VipsCallbackFn)( void *a, void *b );

/* Like GFunc, but return a value.
 */
typedef void *(*VipsSListMap2Fn)( void *item, 
	void *a, void *b );
typedef void *(*VipsSListMap4Fn)( void *item, 
	void *a, void *b, void *c, void *d );
typedef void *(*VipsSListFold2Fn)( void *item, 
	void *a, void *b, void *c );

typedef enum {
	VIPS_PRECISION_INTEGER,
	VIPS_PRECISION_FLOAT,
	VIPS_PRECISION_APPROXIMATE,
	VIPS_PRECISION_LAST
} VipsPrecision;

/* Just for testing.
 */
VIPS_API
char *vips_path_filename7( const char *path );
VIPS_API
char *vips_path_mode7( const char *path );

struct _VipsImage; 
typedef struct _VipsImage VipsImage;
struct _VipsRegion; 
typedef struct _VipsRegion VipsRegion;
struct _VipsBuf;
typedef struct _VipsBuf VipsBuf;
struct _VipsSource; 
typedef struct _VipsSource VipsSource;
struct _VipsTarget; 
typedef struct _VipsTarget VipsTarget;

#ifdef __cplusplus
}
#endif /*__cplusplus*/

#endif /*VIPS_BASIC_H*/
