/* GLIB - Library of useful routines for C programming
 * Copyright (C) 1995-1997  Peter Mattis, Spencer Kimball and Josh MacDonald
 *
 * SPDX-License-Identifier: LGPL-2.1-or-later
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 2.1 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.	 See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this library; if not, see <http://www.gnu.org/licenses/>.
 */

/*
 * Modified by the GLib Team and others 1997-2000.  See the AUTHORS
 * file for a list of people on the GLib Team.  See the ChangeLog
 * files for a list of changes.  These files are distributed with
 * GLib at ftp://ftp.gtk.org/pub/gtk/.
 */

/* This file must not include any other glib header file and must thus
 * not refer to variables from glibconfig.h
 */

#ifndef __G_MACROS_H__
#define __G_MACROS_H__

#if !defined (__GLIB_H_INSIDE__) && !defined (GLIB_COMPILATION)
#error "Only <glib.h> can be included directly."
#endif

/* We include stddef.h to get the system's definition of NULL
 */
#include <stddef.h>

/*
 * Note: Clang (but not clang-cl) defines __GNUC__ and __GNUC_MINOR__.
 * Both Clang 11.1 on current Arch Linux and Apple's Clang 12.0 define
 * __GNUC__ = 4 and __GNUC_MINOR__ = 2. So G_GNUC_CHECK_VERSION(4, 2) on
 * current Clang will be 1.
 */
#ifdef __GNUC__
#define G_GNUC_CHECK_VERSION(major, minor) \
    ((__GNUC__ > (major)) || \
     ((__GNUC__ == (major)) && \
      (__GNUC_MINOR__ >= (minor))))
#else
#define G_GNUC_CHECK_VERSION(major, minor) 0
#endif

/* Here we provide G_GNUC_EXTENSION as an alias for __extension__,
 * where this is valid. This allows for warningless compilation of
 * "long long" types even in the presence of '-ansi -pedantic'. 
 */
#if G_GNUC_CHECK_VERSION(2, 8)
#define G_GNUC_EXTENSION __extension__
#else
#define G_GNUC_EXTENSION
#endif

#if !defined (__cplusplus)

# undef G_CXX_STD_VERSION
# define G_CXX_STD_CHECK_VERSION(version) (0)

# if defined (__STDC_VERSION__)
#  define G_C_STD_VERSION __STDC_VERSION__
# else
#  define G_C_STD_VERSION 199000L
# endif /* defined (__STDC_VERSION__) */

# define G_C_STD_CHECK_VERSION(version) ( \
  ((version) >= 199000L && (version) <= G_C_STD_VERSION) || \
  ((version) == 89 && G_C_STD_VERSION >= 199000L) || \
  ((version) == 90 && G_C_STD_VERSION >= 199000L) || \
  ((version) == 99 && G_C_STD_VERSION >= 199901L) || \
  ((version) == 11 && G_C_STD_VERSION >= 201112L) || \
  ((version) == 17 && G_C_STD_VERSION >= 201710L) || \
  0)

#else /* defined (__cplusplus) */

# undef G_C_STD_VERSION
# define G_C_STD_CHECK_VERSION(version) (0)

# if defined (_MSVC_LANG)
#  define G_CXX_STD_VERSION (_MSVC_LANG > __cplusplus ? _MSVC_LANG : __cplusplus)
# else
#  define G_CXX_STD_VERSION __cplusplus
# endif /* defined(_MSVC_LANG) */

# define G_CXX_STD_CHECK_VERSION(version) ( \
  ((version) >= 199711L && (version) <= G_CXX_STD_VERSION) || \
  ((version) == 98 && G_CXX_STD_VERSION >= 199711L) || \
  ((version) == 03 && G_CXX_STD_VERSION >= 199711L) || \
  ((version) == 11 && G_CXX_STD_VERSION >= 201103L) || \
  ((version) == 14 && G_CXX_STD_VERSION >= 201402L) || \
  ((version) == 17 && G_CXX_STD_VERSION >= 201703L) || \
  ((version) == 20 && G_CXX_STD_VERSION >= 202002L) || \
  0)

#endif /* !defined (__cplusplus) */

/* Every compiler that we target supports inlining, but some of them may
 * complain about it if we don't say "__inline".  If we have C99, or if
 * we are using C++, then we can use "inline" directly.
 * Otherwise, we say "__inline" to avoid the warning.
 * Unfortunately Visual Studio does not define __STDC_VERSION__ (if not
 * using /std:cXX) so we need to check whether we are on Visual Studio 2013
 * or earlier to see whether we need to say "__inline" in C mode.
 */
#define G_CAN_INLINE
#ifdef G_C_STD_VERSION
# ifdef _MSC_VER
#  if (_MSC_VER < 1900)
#   define G_INLINE_DEFINE_NEEDED
#  endif
# elif !G_C_STD_CHECK_VERSION (99)
#  define G_INLINE_DEFINE_NEEDED
# endif
#endif

#ifdef G_INLINE_DEFINE_NEEDED
# undef inline
# define inline __inline
#endif

#undef G_INLINE_DEFINE_NEEDED

/**
 * G_INLINE_FUNC:
 *
 * This macro used to be used to conditionally define inline functions
 * in a compatible way before this feature was supported in all
 * compilers.  These days, GLib requires inlining support from the
 * compiler, so your GLib-using programs can safely assume that the
 * "inline" keyword works properly.
 *
 * Never use this macro anymore.  Just say "static inline".
 *
 * Deprecated: 2.48: Use "static inline" instead
 */

/* For historical reasons we need to continue to support those who
 * define G_IMPLEMENT_INLINES to mean "don't implement this here".
 */
#ifdef G_IMPLEMENT_INLINES
#  define G_INLINE_FUNC extern GLIB_DEPRECATED_MACRO_IN_2_48_FOR(static inline)
#  undef  G_CAN_INLINE
#else
#  define G_INLINE_FUNC static inline GLIB_DEPRECATED_MACRO_IN_2_48_FOR(static inline)
#endif /* G_IMPLEMENT_INLINES */

/*
 * Attribute support detection. Works on clang and GCC >= 5
 * https://clang.llvm.org/docs/LanguageExtensions.html#has-attribute
 * https://gcc.gnu.org/onlinedocs/cpp/_005f_005fhas_005fattribute.html
 */

#ifdef __has_attribute
#define g_macro__has_attribute __has_attribute
#else

/*
 * Fallback for GCC < 5 and other compilers not supporting __has_attribute.
 */
#define g_macro__has_attribute(x) g_macro__has_attribute_##x

#define g_macro__has_attribute___alloc_size__ G_GNUC_CHECK_VERSION (4, 3)
#define g_macro__has_attribute___always_inline__ G_GNUC_CHECK_VERSION (2, 0)
#define g_macro__has_attribute___const__ G_GNUC_CHECK_VERSION (2, 4)
#define g_macro__has_attribute___deprecated__ G_GNUC_CHECK_VERSION (3, 1)
#define g_macro__has_attribute___format__ G_GNUC_CHECK_VERSION (2, 4)
#define g_macro__has_attribute___format_arg__ G_GNUC_CHECK_VERSION (2, 4)
#define g_macro__has_attribute___malloc__ G_GNUC_CHECK_VERSION (2, 96)
#define g_macro__has_attribute___no_instrument_function__ G_GNUC_CHECK_VERSION (2, 4)
#define g_macro__has_attribute___noinline__ G_GNUC_CHECK_VERSION (2, 96)
#define g_macro__has_attribute___noreturn__ (G_GNUC_CHECK_VERSION (2, 8) || (0x5110 <= __SUNPRO_C))
#define g_macro__has_attribute___pure__ G_GNUC_CHECK_VERSION (2, 96)
#define g_macro__has_attribute___sentinel__ G_GNUC_CHECK_VERSION (4, 0)
#define g_macro__has_attribute___unused__ G_GNUC_CHECK_VERSION (2, 4)
#define g_macro__has_attribute_cleanup G_GNUC_CHECK_VERSION (3, 3)
#define g_macro__has_attribute_fallthrough G_GNUC_CHECK_VERSION (6, 0)
#define g_macro__has_attribute_may_alias G_GNUC_CHECK_VERSION (3, 3)
#define g_macro__has_attribute_warn_unused_result G_GNUC_CHECK_VERSION (3, 4)

#endif

/* Provide macros to feature the GCC function attribute.
 */

/**
 * G_GNUC_PURE:
 *
 * Expands to the GNU C `pure` function attribute if the compiler is gcc.
 * Declaring a function as `pure` enables better optimization of calls to
 * the function. A `pure` function has no effects except its return value
 * and the return value depends only on the parameters and/or global
 * variables.
 *
 * Place the attribute after the declaration, just before the semicolon.
 *
 * |[<!-- language="C" -->
 * gboolean g_type_check_value (const GValue *value) G_GNUC_PURE;
 * ]|
 *
 * See the [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-pure-function-attribute) for more details.
 */

/**
 * G_GNUC_MALLOC:
 *
 * Expands to the
 * [GNU C `malloc` function attribute](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-functions-that-behave-like-malloc)
 * if the compiler is gcc.
 * Declaring a function as `malloc` enables better optimization of the function,
 * but must only be done if the allocation behaviour of the function is fully
 * understood, otherwise miscompilation can result.
 *
 * A function can have the `malloc` attribute if it returns a pointer which is
 * guaranteed to not alias with any other pointer valid when the function
 * returns, and moreover no pointers to valid objects occur in any storage
 * addressed by the returned pointer.
 *
 * In practice, this means that `G_GNUC_MALLOC` can be used with any function
 * which returns unallocated or zeroed-out memory, but not with functions which
 * return initialised structures containing other pointers, or with functions
 * that reallocate memory. This definition changed in GLib 2.58 to match the
 * stricter definition introduced around GCC 5.
 *
 * Place the attribute after the declaration, just before the semicolon.
 *
 * |[<!-- language="C" -->
 * gpointer g_malloc (gsize n_bytes) G_GNUC_MALLOC G_GNUC_ALLOC_SIZE(1);
 * ]|
 *
 * See the
 * [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-functions-that-behave-like-malloc)
 * for more details.
 *
 * Since: 2.6
 */

/**
 * G_GNUC_NO_INLINE:
 *
 * Expands to the GNU C `noinline` function attribute if the compiler is gcc.
 * If the compiler is not gcc, this macro expands to nothing.
 *
 * Declaring a function as `noinline` prevents the function from being
 * considered for inlining.
 *
 * This macro is provided for retro-compatibility and will be eventually
 * deprecated, but %G_NO_INLINE should be used instead.
 *
 * The attribute may be placed before the declaration or definition,
 * right before the `static` keyword.
 *
 * |[<!-- language="C" -->
 * G_GNUC_NO_INLINE
 * static int
 * do_not_inline_this (void)
 * {
 *   ...
 * }
 * ]|
 *
 * See the
 * [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-noinline-function-attribute)
 * for more details.
 *
 * See also: %G_NO_INLINE, %G_ALWAYS_INLINE.
 *
 * Since: 2.58
 */

#if g_macro__has_attribute(__pure__)
#define G_GNUC_PURE __attribute__((__pure__))
#else
#define G_GNUC_PURE
#endif

#if g_macro__has_attribute(__malloc__)
#define G_GNUC_MALLOC __attribute__ ((__malloc__))
#else
#define G_GNUC_MALLOC
#endif

#if g_macro__has_attribute(__noinline__)
#define G_GNUC_NO_INLINE __attribute__ ((__noinline__)) \
  GLIB_AVAILABLE_MACRO_IN_2_58
#else
#define G_GNUC_NO_INLINE \
  GLIB_AVAILABLE_MACRO_IN_2_58
#endif

/**
 * G_GNUC_NULL_TERMINATED:
 *
 * Expands to the GNU C `sentinel` function attribute if the compiler is gcc.
 * This function attribute only applies to variadic functions and instructs
 * the compiler to check that the argument list is terminated with an
 * explicit %NULL.
 *
 * Place the attribute after the declaration, just before the semicolon.
 *
 * |[<!-- language="C" -->
 * gchar *g_strconcat (const gchar *string1,
 *                     ...) G_GNUC_NULL_TERMINATED;
 * ]|
 *
 * See the [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-sentinel-function-attribute) for more details.
 *
 * Since: 2.8
 */
#if g_macro__has_attribute(__sentinel__)
#define G_GNUC_NULL_TERMINATED __attribute__((__sentinel__))
#else
#define G_GNUC_NULL_TERMINATED
#endif

/*
 * Clang feature detection: http://clang.llvm.org/docs/LanguageExtensions.html
 * These are not available on GCC, but since the pre-processor doesn't do
 * operator short-circuiting, we can't use it in a statement or we'll get:
 *
 * error: missing binary operator before token "("
 *
 * So we define it to 0 to satisfy the pre-processor.
 */

#ifdef __has_feature
#define g_macro__has_feature __has_feature
#else
#define g_macro__has_feature(x) 0
#endif

#ifdef __has_builtin
#define g_macro__has_builtin __has_builtin
#else
#define g_macro__has_builtin(x) 0
#endif

#ifdef __has_extension
#define g_macro__has_extension __has_extension
#else
#define g_macro__has_extension(x) 0
#endif

/**
 * G_GNUC_ALLOC_SIZE:
 * @x: the index of the argument specifying the allocation size
 *
 * Expands to the GNU C `alloc_size` function attribute if the compiler
 * is a new enough gcc. This attribute tells the compiler that the
 * function returns a pointer to memory of a size that is specified
 * by the @xth function parameter.
 *
 * Place the attribute after the function declaration, just before the
 * semicolon.
 *
 * |[<!-- language="C" -->
 * gpointer g_malloc (gsize n_bytes) G_GNUC_MALLOC G_GNUC_ALLOC_SIZE(1);
 * ]|
 *
 * See the [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-alloc_005fsize-function-attribute) for more details.
 *
 * Since: 2.18
 */

/**
 * G_GNUC_ALLOC_SIZE2:
 * @x: the index of the argument specifying one factor of the allocation size
 * @y: the index of the argument specifying the second factor of the allocation size
 *
 * Expands to the GNU C `alloc_size` function attribute if the compiler is a
 * new enough gcc. This attribute tells the compiler that the function returns
 * a pointer to memory of a size that is specified by the product of two
 * function parameters.
 *
 * Place the attribute after the function declaration, just before the
 * semicolon.
 *
 * |[<!-- language="C" -->
 * gpointer g_malloc_n (gsize n_blocks,
 *                      gsize n_block_bytes) G_GNUC_MALLOC G_GNUC_ALLOC_SIZE2(1, 2);
 * ]|
 *
 * See the [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-alloc_005fsize-function-attribute) for more details.
 *
 * Since: 2.18
 */
#if g_macro__has_attribute(__alloc_size__)
#define G_GNUC_ALLOC_SIZE(x) __attribute__((__alloc_size__(x)))
#define G_GNUC_ALLOC_SIZE2(x,y) __attribute__((__alloc_size__(x,y)))
#else
#define G_GNUC_ALLOC_SIZE(x)
#define G_GNUC_ALLOC_SIZE2(x,y)
#endif

/**
 * G_GNUC_PRINTF:
 * @format_idx: the index of the argument corresponding to the
 *     format string (the arguments are numbered from 1)
 * @arg_idx: the index of the first of the format arguments, or 0 if
 *     there are no format arguments
 *
 * Expands to the GNU C `format` function attribute if the compiler is gcc.
 * This is used for declaring functions which take a variable number of
 * arguments, with the same syntax as `printf()`. It allows the compiler
 * to type-check the arguments passed to the function.
 *
 * Place the attribute after the function declaration, just before the
 * semicolon.
 *
 * See the
 * [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-Wformat-3288)
 * for more details.
 *
 * |[<!-- language="C" -->
 * gint g_snprintf (gchar  *string,
 *                  gulong       n,
 *                  gchar const *format,
 *                  ...) G_GNUC_PRINTF (3, 4);
 * ]|
 */

/**
 * G_GNUC_SCANF:
 * @format_idx: the index of the argument corresponding to
 *     the format string (the arguments are numbered from 1)
 * @arg_idx: the index of the first of the format arguments, or 0 if
 *     there are no format arguments
 *
 * Expands to the GNU C `format` function attribute if the compiler is gcc.
 * This is used for declaring functions which take a variable number of
 * arguments, with the same syntax as `scanf()`. It allows the compiler
 * to type-check the arguments passed to the function.
 *
 * |[<!-- language="C" -->
 * int my_scanf (MyStream *stream,
 *               const char *format,
 *               ...) G_GNUC_SCANF (2, 3);
 * int my_vscanf (MyStream *stream,
 *                const char *format,
 *                va_list ap) G_GNUC_SCANF (2, 0);
 * ]|
 *
 * See the
 * [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-Wformat-3288)
 * for details.
 */

/**
 * G_GNUC_STRFTIME:
 * @format_idx: the index of the argument corresponding to
 *     the format string (the arguments are numbered from 1)
 *
 * Expands to the GNU C `strftime` format function attribute if the compiler
 * is gcc. This is used for declaring functions which take a format argument
 * which is passed to `strftime()` or an API implementing its formats. It allows
 * the compiler check the format passed to the function.
 *
 * |[<!-- language="C" -->
 * gsize my_strftime (MyBuffer *buffer,
 *                    const char *format,
 *                    const struct tm *tm) G_GNUC_STRFTIME (2);
 * ]|
 *
 * See the
 * [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-Wformat-3288)
 * for details.
 *
 * Since: 2.60
 */

/**
 * G_GNUC_FORMAT:
 * @arg_idx: the index of the argument
 *
 * Expands to the GNU C `format_arg` function attribute if the compiler
 * is gcc. This function attribute specifies that a function takes a
 * format string for a `printf()`, `scanf()`, `strftime()` or `strfmon()` style
 * function and modifies it, so that the result can be passed to a `printf()`,
 * `scanf()`, `strftime()` or `strfmon()` style function (with the remaining
 * arguments to the format function the same as they would have been
 * for the unmodified string).
 *
 * Place the attribute after the function declaration, just before the
 * semicolon.
 *
 * See the [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-Wformat-nonliteral-1) for more details.
 *
 * |[<!-- language="C" -->
 * gchar *g_dgettext (gchar *domain_name, gchar *msgid) G_GNUC_FORMAT (2);
 * ]|
 */

/**
 * G_GNUC_NORETURN:
 *
 * Expands to the GNU C `noreturn` function attribute if the compiler is gcc.
 * It is used for declaring functions which never return. It enables
 * optimization of the function, and avoids possible compiler warnings.
 *
 * Since 2.68, it is recommended that code uses %G_NORETURN instead of
 * %G_GNUC_NORETURN, as that works on more platforms and compilers (in
 * particular, MSVC and C++11) than %G_GNUC_NORETURN, which works with GCC and
 * Clang only. %G_GNUC_NORETURN continues to work, so has not been deprecated
 * yet.
 *
 * Place the attribute after the declaration, just before the semicolon.
 *
 * |[<!-- language="C" -->
 * void g_abort (void) G_GNUC_NORETURN;
 * ]|
 *
 * See the [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-noreturn-function-attribute) for more details.
 */

/**
 * G_GNUC_CONST:
 *
 * Expands to the GNU C `const` function attribute if the compiler is gcc.
 * Declaring a function as `const` enables better optimization of calls to
 * the function. A `const` function doesn't examine any values except its
 * parameters, and has no effects except its return value.
 *
 * Place the attribute after the declaration, just before the semicolon.
 *
 * |[<!-- language="C" -->
 * gchar g_ascii_tolower (gchar c) G_GNUC_CONST;
 * ]|
 *
 * See the [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-const-function-attribute) for more details.
 *
 * A function that has pointer arguments and examines the data pointed to
 * must not be declared `const`. Likewise, a function that calls a non-`const`
 * function usually must not be `const`. It doesn't make sense for a `const`
 * function to return `void`.
 */

/**
 * G_GNUC_UNUSED:
 *
 * Expands to the GNU C `unused` function attribute if the compiler is gcc.
 * It is used for declaring functions and arguments which may never be used.
 * It avoids possible compiler warnings.
 *
 * For functions, place the attribute after the declaration, just before the
 * semicolon. For arguments, place the attribute at the beginning of the
 * argument declaration.
 *
 * |[<!-- language="C" -->
 * void my_unused_function (G_GNUC_UNUSED gint unused_argument,
 *                          gint other_argument) G_GNUC_UNUSED;
 * ]|
 *
 * See the [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-unused-function-attribute) for more details.
 */

/**
 * G_GNUC_NO_INSTRUMENT:
 *
 * Expands to the GNU C `no_instrument_function` function attribute if the
 * compiler is gcc. Functions with this attribute will not be instrumented
 * for profiling, when the compiler is called with the
 * `-finstrument-functions` option.
 *
 * Place the attribute after the declaration, just before the semicolon.
 *
 * |[<!-- language="C" -->
 * int do_uninteresting_things (void) G_GNUC_NO_INSTRUMENT;
 * ]|
 *
 * See the [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-no_005finstrument_005ffunction-function-attribute) for more details.
 */

#if g_macro__has_attribute(__format__)

#if !defined (__clang__) && G_GNUC_CHECK_VERSION (4, 4)
#define G_GNUC_PRINTF( format_idx, arg_idx )    \
  __attribute__((__format__ (gnu_printf, format_idx, arg_idx)))
#define G_GNUC_SCANF( format_idx, arg_idx )     \
  __attribute__((__format__ (gnu_scanf, format_idx, arg_idx)))
#define G_GNUC_STRFTIME( format_idx )    \
  __attribute__((__format__ (gnu_strftime, format_idx, 0))) \
  GLIB_AVAILABLE_MACRO_IN_2_60
#else
#define G_GNUC_PRINTF( format_idx, arg_idx )    \
  __attribute__((__format__ (__printf__, format_idx, arg_idx)))
#define G_GNUC_SCANF( format_idx, arg_idx )     \
  __attribute__((__format__ (__scanf__, format_idx, arg_idx)))
#define G_GNUC_STRFTIME( format_idx )    \
  __attribute__((__format__ (__strftime__, format_idx, 0))) \
  GLIB_AVAILABLE_MACRO_IN_2_60
#endif

#else

#define G_GNUC_PRINTF( format_idx, arg_idx )
#define G_GNUC_SCANF( format_idx, arg_idx )
#define G_GNUC_STRFTIME( format_idx ) \
  GLIB_AVAILABLE_MACRO_IN_2_60

#endif

#if g_macro__has_attribute(__format_arg__)
#define G_GNUC_FORMAT(arg_idx) \
  __attribute__ ((__format_arg__ (arg_idx)))
#else
#define G_GNUC_FORMAT( arg_idx )
#endif

#if g_macro__has_attribute(__noreturn__)
#define G_GNUC_NORETURN \
  __attribute__ ((__noreturn__))
#else
/* NOTE: MSVC has __declspec(noreturn) but unlike GCC __attribute__,
 * __declspec can only be placed at the start of the function prototype
 * and not at the end, so we can't use it without breaking API.
 */
#define G_GNUC_NORETURN
#endif

#if g_macro__has_attribute(__const__)
#define G_GNUC_CONST \
  __attribute__ ((__const__))
#else
#define G_GNUC_CONST
#endif

#if g_macro__has_attribute(__unused__)
#define G_GNUC_UNUSED \
  __attribute__ ((__unused__))
#else
#define G_GNUC_UNUSED
#endif

#if g_macro__has_attribute(__no_instrument_function__)
#define G_GNUC_NO_INSTRUMENT \
  __attribute__ ((__no_instrument_function__))
#else
#define G_GNUC_NO_INSTRUMENT
#endif

/**
 * G_GNUC_FALLTHROUGH:
 *
 * Expands to the GNU C `fallthrough` statement attribute if the compiler supports it.
 * This allows declaring case statement to explicitly fall through in switch
 * statements. To enable this feature, use `-Wimplicit-fallthrough` during
 * compilation.
 *
 * Put the attribute right before the case statement you want to fall through
 * to.
 *
 * |[<!-- language="C" -->
 * switch (foo)
 *   {
 *     case 1:
 *       g_message ("it's 1");
 *       G_GNUC_FALLTHROUGH;
 *     case 2:
 *       g_message ("it's either 1 or 2");
 *       break;
 *   }
 * ]|
 *
 *
 * See the [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Statement-Attributes.html#index-fallthrough-statement-attribute) for more details.
 *
 * Since: 2.60
 */
#if g_macro__has_attribute(fallthrough)
#define G_GNUC_FALLTHROUGH __attribute__((fallthrough)) \
  GLIB_AVAILABLE_MACRO_IN_2_60
#else
#define G_GNUC_FALLTHROUGH \
  GLIB_AVAILABLE_MACRO_IN_2_60
#endif

/**
 * G_GNUC_DEPRECATED:
 *
 * Expands to the GNU C `deprecated` attribute if the compiler is gcc.
 * It can be used to mark `typedef`s, variables and functions as deprecated.
 * When called with the `-Wdeprecated-declarations` option,
 * gcc will generate warnings when deprecated interfaces are used.
 *
 * Place the attribute after the declaration, just before the semicolon.
 *
 * |[<!-- language="C" -->
 * int my_mistake (void) G_GNUC_DEPRECATED;
 * ]|
 *
 * See the [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-deprecated-function-attribute) for more details.
 *
 * Since: 2.2
 */
#if g_macro__has_attribute(__deprecated__)
#define G_GNUC_DEPRECATED __attribute__((__deprecated__))
#else
#define G_GNUC_DEPRECATED
#endif /* __GNUC__ */

/**
 * G_GNUC_DEPRECATED_FOR:
 * @f: the intended replacement for the deprecated symbol,
 *     such as the name of a function
 *
 * Like %G_GNUC_DEPRECATED, but names the intended replacement for the
 * deprecated symbol if the version of gcc in use is new enough to support
 * custom deprecation messages.
 *
 * Place the attribute after the declaration, just before the semicolon.
 *
 * |[<!-- language="C" -->
 * int my_mistake (void) G_GNUC_DEPRECATED_FOR(my_replacement);
 * ]|
 *
 * See the [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-deprecated-function-attribute) for more details.
 *
 * Note that if @f is a macro, it will be expanded in the warning message.
 * You can enclose it in quotes to prevent this. (The quotes will show up
 * in the warning, but it's better than showing the macro expansion.)
 *
 * Since: 2.26
 */
#if G_GNUC_CHECK_VERSION(4, 5) || defined(__clang__)
#define G_GNUC_DEPRECATED_FOR(f)                        \
  __attribute__((deprecated("Use " #f " instead")))     \
  GLIB_AVAILABLE_MACRO_IN_2_26
#else
#define G_GNUC_DEPRECATED_FOR(f)      G_GNUC_DEPRECATED \
  GLIB_AVAILABLE_MACRO_IN_2_26
#endif /* __GNUC__ */

#ifdef __ICC
#define G_GNUC_BEGIN_IGNORE_DEPRECATIONS                \
  _Pragma ("warning (push)")                            \
  _Pragma ("warning (disable:1478)")
#define G_GNUC_END_IGNORE_DEPRECATIONS			\
  _Pragma ("warning (pop)")
#elif G_GNUC_CHECK_VERSION(4, 6)
#define G_GNUC_BEGIN_IGNORE_DEPRECATIONS		\
  _Pragma ("GCC diagnostic push")			\
  _Pragma ("GCC diagnostic ignored \"-Wdeprecated-declarations\"")
#define G_GNUC_END_IGNORE_DEPRECATIONS			\
  _Pragma ("GCC diagnostic pop")
#elif defined (_MSC_VER) && (_MSC_VER >= 1500) && !defined (__clang__)
#define G_GNUC_BEGIN_IGNORE_DEPRECATIONS		\
  __pragma (warning (push))  \
  __pragma (warning (disable : 4996))
#define G_GNUC_END_IGNORE_DEPRECATIONS			\
  __pragma (warning (pop))
#elif defined (__clang__)
#define G_GNUC_BEGIN_IGNORE_DEPRECATIONS \
  _Pragma("clang diagnostic push") \
  _Pragma("clang diagnostic ignored \"-Wdeprecated-declarations\"")
#define G_GNUC_END_IGNORE_DEPRECATIONS \
  _Pragma("clang diagnostic pop")
#else
#define G_GNUC_BEGIN_IGNORE_DEPRECATIONS
#define G_GNUC_END_IGNORE_DEPRECATIONS
#define GLIB_CANNOT_IGNORE_DEPRECATIONS
#endif

/**
 * G_GNUC_MAY_ALIAS:
 *
 * Expands to the GNU C `may_alias` type attribute if the compiler is gcc.
 * Types with this attribute will not be subjected to type-based alias
 * analysis, but are assumed to alias with any other type, just like `char`.
 *
 * See the [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Type-Attributes.html#index-may_005falias-type-attribute) for details.
 *
 * Since: 2.14
 */
#if g_macro__has_attribute(may_alias)
#define G_GNUC_MAY_ALIAS __attribute__((may_alias))
#else
#define G_GNUC_MAY_ALIAS
#endif

/**
 * G_GNUC_WARN_UNUSED_RESULT:
 *
 * Expands to the GNU C `warn_unused_result` function attribute if the compiler
 * is gcc. This function attribute makes the compiler emit a warning if the
 * result of a function call is ignored.
 *
 * Place the attribute after the declaration, just before the semicolon.
 *
 * |[<!-- language="C" -->
 * GList *g_list_append (GList *list,
 *                       gpointer data) G_GNUC_WARN_UNUSED_RESULT;
 * ]|
 *
 * See the [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-warn_005funused_005fresult-function-attribute) for more details.
 *
 * Since: 2.10
 */
#if g_macro__has_attribute(warn_unused_result)
#define G_GNUC_WARN_UNUSED_RESULT __attribute__((warn_unused_result))
#else
#define G_GNUC_WARN_UNUSED_RESULT
#endif /* __GNUC__ */

/**
 * G_GNUC_FUNCTION:
 *
 * Expands to "" on all modern compilers, and to  __FUNCTION__ on gcc
 * version 2.x. Don't use it.
 *
 * Deprecated: 2.16: Use G_STRFUNC() instead
 */

/**
 * G_GNUC_PRETTY_FUNCTION:
 *
 * Expands to "" on all modern compilers, and to __PRETTY_FUNCTION__
 * on gcc version 2.x. Don't use it.
 *
 * Deprecated: 2.16: Use G_STRFUNC() instead
 */

/* Wrap the gcc __PRETTY_FUNCTION__ and __FUNCTION__ variables with
 * macros, so we can refer to them as strings unconditionally.
 * usage not-recommended since gcc-3.0
 *
 * Mark them as deprecated since 2.26, since that’s when version macros were
 * introduced.
 */
#if defined (__GNUC__) && (__GNUC__ < 3)
#define G_GNUC_FUNCTION         __FUNCTION__ GLIB_DEPRECATED_MACRO_IN_2_26_FOR(G_STRFUNC)
#define G_GNUC_PRETTY_FUNCTION  __PRETTY_FUNCTION__ GLIB_DEPRECATED_MACRO_IN_2_26_FOR(G_STRFUNC)
#else   /* !__GNUC__ */
#define G_GNUC_FUNCTION         "" GLIB_DEPRECATED_MACRO_IN_2_26_FOR(G_STRFUNC)
#define G_GNUC_PRETTY_FUNCTION  "" GLIB_DEPRECATED_MACRO_IN_2_26_FOR(G_STRFUNC)
#endif  /* !__GNUC__ */

#if g_macro__has_feature(attribute_analyzer_noreturn) && defined(__clang_analyzer__)
#define G_ANALYZER_ANALYZING 1
#define G_ANALYZER_NORETURN __attribute__((analyzer_noreturn))
#elif defined(__COVERITY__)
#define G_ANALYZER_ANALYZING 1
#define G_ANALYZER_NORETURN __attribute__((noreturn))
#else
#define G_ANALYZER_ANALYZING 0
#define G_ANALYZER_NORETURN
#endif

#define G_STRINGIFY(macro_or_string)	G_STRINGIFY_ARG (macro_or_string)
#define	G_STRINGIFY_ARG(contents)	#contents

#ifndef __GI_SCANNER__ /* The static assert macro really confuses the introspection parser */
#define G_PASTE_ARGS(identifier1,identifier2) identifier1 ## identifier2
#define G_PASTE(identifier1,identifier2)      G_PASTE_ARGS (identifier1, identifier2)
#if G_CXX_STD_CHECK_VERSION (11)
#define G_STATIC_ASSERT(expr) static_assert (expr, "Expression evaluates to false")
#elif (G_C_STD_CHECK_VERSION (11) || \
     g_macro__has_feature(c_static_assert) || g_macro__has_extension(c_static_assert))
#define G_STATIC_ASSERT(expr) _Static_assert (expr, "Expression evaluates to false")
#else
#ifdef __COUNTER__
#define G_STATIC_ASSERT(expr) typedef char G_PASTE (_GStaticAssertCompileTimeAssertion_, __COUNTER__)[(expr) ? 1 : -1] G_GNUC_UNUSED
#else
#define G_STATIC_ASSERT(expr) typedef char G_PASTE (_GStaticAssertCompileTimeAssertion_, __LINE__)[(expr) ? 1 : -1] G_GNUC_UNUSED
#endif
#endif /* G_CXX_STD_CHECK_VERSION (11) */
#define G_STATIC_ASSERT_EXPR(expr) ((void) sizeof (char[(expr) ? 1 : -1]))
#endif /* !__GI_SCANNER__ */

/* Provide a string identifying the current code position */
#if defined (__GNUC__) && (__GNUC__ < 3) && !defined (G_CXX_STD_VERSION)
#define G_STRLOC	__FILE__ ":" G_STRINGIFY (__LINE__) ":" __PRETTY_FUNCTION__ "()"
#else
#define G_STRLOC	__FILE__ ":" G_STRINGIFY (__LINE__)
#endif

/* Provide a string identifying the current function, non-concatenatable */
#if defined (__GNUC__) && defined (G_CXX_STD_VERSION)
#define G_STRFUNC     ((const char*) (__PRETTY_FUNCTION__))
#elif G_C_STD_CHECK_VERSION (99)
#define G_STRFUNC     ((const char*) (__func__))
#elif defined (__GNUC__) || (defined(_MSC_VER) && (_MSC_VER > 1300))
#define G_STRFUNC     ((const char*) (__FUNCTION__))
#else
#define G_STRFUNC     ((const char*) ("???"))
#endif

/* Guard C code in headers, while including them from C++ */
#ifdef  G_CXX_STD_VERSION
#define G_BEGIN_DECLS  extern "C" {
#define G_END_DECLS    }
#else
#define G_BEGIN_DECLS
#define G_END_DECLS
#endif

/* Provide definitions for some commonly used macros.
 *  Some of them are only provided if they haven't already
 *  been defined. It is assumed that if they are already
 *  defined then the current definition is correct.
 */
#ifndef NULL
#  if G_CXX_STD_CHECK_VERSION (11)
#    define NULL (nullptr)
#  elif defined (G_CXX_STD_VERSION)
#    define NULL (0L)
#  else
#    define NULL ((void*) 0)
#  endif /* G_CXX_STD_CHECK_VERSION (11) */
#endif

#ifndef	FALSE
#define	FALSE	(0)
#endif

#ifndef	TRUE
#define	TRUE	(!FALSE)
#endif

#undef	MAX
#define MAX(a, b)  (((a) > (b)) ? (a) : (b))

#undef	MIN
#define MIN(a, b)  (((a) < (b)) ? (a) : (b))

#undef	ABS
#define ABS(a)	   (((a) < 0) ? -(a) : (a))

#undef	CLAMP
#define CLAMP(x, low, high)  (((x) > (high)) ? (high) : (((x) < (low)) ? (low) : (x)))

#define G_APPROX_VALUE(a, b, epsilon) \
  (((a) > (b) ? (a) - (b) : (b) - (a)) < (epsilon))

/* Count the number of elements in an array. The array must be defined
 * as such; using this with a dynamically allocated array will give
 * incorrect results.
 */
#define G_N_ELEMENTS(arr)		(sizeof (arr) / sizeof ((arr)[0]))

/* Macros by analogy to GINT_TO_POINTER, GPOINTER_TO_INT
 */
#define GPOINTER_TO_SIZE(p)	((gsize) (p))
#define GSIZE_TO_POINTER(s)	((gpointer) (gsize) (s))

/* Provide convenience macros for handling structure
 * fields through their offsets.
 */

#if G_GNUC_CHECK_VERSION(4, 0) || defined(_MSC_VER)
#define G_STRUCT_OFFSET(struct_type, member) \
      ((glong) offsetof (struct_type, member))
#else
#define G_STRUCT_OFFSET(struct_type, member)	\
      ((glong) ((guint8*) &((struct_type*) 0)->member))
#endif

#define G_STRUCT_MEMBER_P(struct_p, struct_offset)   \
    ((gpointer) ((guint8*) (struct_p) + (glong) (struct_offset)))
#define G_STRUCT_MEMBER(member_type, struct_p, struct_offset)   \
    (*(member_type*) G_STRUCT_MEMBER_P ((struct_p), (struct_offset)))

/* Provide simple macro statement wrappers:
 *   G_STMT_START { statements; } G_STMT_END;
 * This can be used as a single statement, like:
 *   if (x) G_STMT_START { ... } G_STMT_END; else ...
 * This intentionally does not use compiler extensions like GCC's '({...})' to
 * avoid portability issue or side effects when compiled with different compilers.
 * MSVC complains about "while(0)": C4127: "Conditional expression is constant",
 * so we use __pragma to avoid the warning since the use here is intentional.
 */
#if !(defined (G_STMT_START) && defined (G_STMT_END))
#define G_STMT_START  do
#if defined (_MSC_VER) && (_MSC_VER >= 1500)
#define G_STMT_END \
    __pragma(warning(push)) \
    __pragma(warning(disable:4127)) \
    while(0) \
    __pragma(warning(pop))
#else
#define G_STMT_END    while (0)
#endif
#endif

/* Provide G_ALIGNOF alignment macro.
 *
 * Note we cannot use the gcc __alignof__ operator here, as that returns the
 * preferred alignment rather than the minimal alignment. See
 * https://gitlab.gnome.org/GNOME/glib/merge_requests/538/diffs#note_390790.
 */

/**
 * G_ALIGNOF
 * @type: a type-name
 *
 * Return the minimal alignment required by the platform ABI for values of the given
 * type. The address of a variable or struct member of the given type must always be
 * a multiple of this alignment. For example, most platforms require int variables
 * to be aligned at a 4-byte boundary, so `G_ALIGNOF (int)` is 4 on most platforms.
 *
 * Note this is not necessarily the same as the value returned by GCC’s
 * `__alignof__` operator, which returns the preferred alignment for a type.
 * The preferred alignment may be a stricter alignment than the minimal
 * alignment.
 *
 * Since: 2.60
 */
#if G_C_STD_CHECK_VERSION (11)
#define G_ALIGNOF(type) _Alignof (type) \
  GLIB_AVAILABLE_MACRO_IN_2_60
#else
#define G_ALIGNOF(type) (G_STRUCT_OFFSET (struct { char a; type b; }, b)) \
  GLIB_AVAILABLE_MACRO_IN_2_60
#endif

/**
 * G_CONST_RETURN:
 *
 * If %G_DISABLE_CONST_RETURNS is defined, this macro expands
 * to nothing. By default, the macro expands to const. The macro
 * can be used in place of const for functions that return a value
 * that should not be modified. The purpose of this macro is to allow
 * us to turn on const for returned constant strings by default, while
 * allowing programmers who find that annoying to turn it off. This macro
 * should only be used for return values and for "out" parameters, it
 * doesn't make sense for "in" parameters.
 *
 * Deprecated: 2.30: API providers should replace all existing uses with
 * const and API consumers should adjust their code accordingly
 */
#ifdef G_DISABLE_CONST_RETURNS
#define G_CONST_RETURN GLIB_DEPRECATED_MACRO_IN_2_30_FOR(const)
#else
#define G_CONST_RETURN const GLIB_DEPRECATED_MACRO_IN_2_30_FOR(const)
#endif

/**
 * G_NORETURN:
 *
 * Expands to the GNU C or MSVC `noreturn` function attribute depending on
 * the compiler. It is used for declaring functions which never return.
 * Enables optimization of the function, and avoids possible compiler warnings.
 *
 * Note that %G_NORETURN supersedes the previous %G_GNUC_NORETURN macro, which
 * will eventually be deprecated. %G_NORETURN supports more platforms.
 *
 * Place the attribute before the function declaration as follows:
 *
 * |[<!-- language="C" -->
 * G_NORETURN void g_abort (void);
 * ]|
 *
 * Since: 2.68
 */
/* Note: We can’t annotate this with GLIB_AVAILABLE_MACRO_IN_2_68 because it’s
 * used within the GLib headers in function declarations which are always
 * evaluated when a header is included. This results in warnings in third party
 * code which includes glib.h, even if the third party code doesn’t use the new
 * macro itself. */
#if G_CXX_STD_CHECK_VERSION (11)
  /* Use ISO C++11 syntax when the compiler supports it.  */
# define G_NORETURN [[noreturn]]
#elif g_macro__has_attribute(__noreturn__)
  /* For compatibility with G_NORETURN_FUNCPTR on clang, use
     __attribute__((__noreturn__)), not _Noreturn.  */
# define G_NORETURN __attribute__ ((__noreturn__))
#elif defined (_MSC_VER) && (1200 <= _MSC_VER)
  /* Use MSVC specific syntax.  */
# define G_NORETURN __declspec (noreturn)
  /* Use ISO C11 syntax when the compiler supports it.  */
#elif G_C_STD_CHECK_VERSION (11)
# define G_NORETURN _Noreturn
#else
# define G_NORETURN /* empty */
#endif

/**
 * G_NORETURN_FUNCPTR:
 *
 * Expands to the GNU C or MSVC `noreturn` function attribute depending on
 * the compiler. It is used for declaring function pointers which never return.
 * Enables optimization of the function, and avoids possible compiler warnings.
 *
 * Place the attribute before the function declaration as follows:
 *
 * |[<!-- language="C" -->
 * G_NORETURN_FUNCPTR void (*funcptr) (void);
 * ]|
 *
 * Note that if the function is not a function pointer, you can simply use
 * the %G_NORETURN macro as follows:
 *
 * |[<!-- language="C" -->
 * G_NORETURN void g_abort (void);
 * ]|
 *
 * Since: 2.68
 */
#if g_macro__has_attribute(__noreturn__)
# define G_NORETURN_FUNCPTR __attribute__ ((__noreturn__))      \
  GLIB_AVAILABLE_MACRO_IN_2_68
#else
# define G_NORETURN_FUNCPTR /* empty */         \
  GLIB_AVAILABLE_MACRO_IN_2_68
#endif

/**
 * G_ALWAYS_INLINE:
 *
 * Expands to the GNU C `always_inline` or MSVC `__forceinline` function
 * attribute depending on the compiler. It is used for declaring functions
 * as always inlined, ignoring the compiler optimization levels.
 *
 * The attribute may be placed before the declaration or definition,
 * right before the `static` keyword.
 *
 * |[<!-- language="C" -->
 * G_ALWAYS_INLINE
 * static int
 * do_inline_this (void)
 * {
 *   ...
 * }
 * ]|
 *
 * See the
 * [GNU C documentation](https://gcc.gnu.org/onlinedocs/gcc/Common-Function-Attributes.html#index-always_005finline-function-attribute)
 * and the
 * [MSVC documentation](https://docs.microsoft.com/en-us/visualstudio/misc/inline-inline-forceinline)
 *
 * Since: 2.74
 */
/* Note: We can’t annotate this with GLIB_AVAILABLE_MACRO_IN_2_74 because it’s
 * used within the GLib headers in function declarations which are always
 * evaluated when a header is included. This results in warnings in third party
 * code which includes glib.h, even if the third party code doesn’t use the new
 * macro itself. */
#if g_macro__has_attribute(__always_inline__)
# if G_CXX_STD_CHECK_VERSION (11)
    /* Use ISO C++11 syntax when the compiler supports it. */
#   define G_ALWAYS_INLINE [[gnu::always_inline]]
# else
#   define G_ALWAYS_INLINE __attribute__ ((__always_inline__))
# endif
#elif defined (_MSC_VER)
  /* Use MSVC specific syntax.  */
# if G_CXX_STD_CHECK_VERSION (20) && _MSC_VER >= 1927
#  define G_ALWAYS_INLINE [[msvc::forceinline]]
# else
#  define G_ALWAYS_INLINE __forceinline
# endif
#else
# define G_ALWAYS_INLINE /* empty */
#endif

/**
 * G_NO_INLINE:
 *
 * Expands to the GNU C or MSVC `noinline` function attribute
 * depending on the compiler. It is used for declaring functions
 * preventing from being considered for inlining.
 *
 * Note that %G_NO_INLINE supersedes the previous %G_GNUC_NO_INLINE
 * macro, which will eventually be deprecated.
 * %G_NO_INLINE supports more platforms.
 *
 * The attribute may be placed before the declaration or definition,
 * right before the `static` keyword.
 *
 * |[<!-- language="C" -->
 * G_NO_INLINE
 * static int
 * do_not_inline_this (void)
 * {
 *   ...
 * }
 * ]|
 *
 * Since: 2.74
 */
/* Note: We can’t annotate this with GLIB_AVAILABLE_MACRO_IN_2_74 because it’s
 * used within the GLib headers in function declarations which are always
 * evaluated when a header is included. This results in warnings in third party
 * code which includes glib.h, even if the third party code doesn’t use the new
 * macro itself. */
#if g_macro__has_attribute(__noinline__)
# if G_CXX_STD_CHECK_VERSION (11)
    /* Use ISO C++11 syntax when the compiler supports it. */
#   if defined (__GNUC__)
#      define G_NO_INLINE [[gnu::noinline]]
#   elif defined (_MSC_VER)
#      if G_CXX_STD_CHECK_VERSION (20) && _MSC_VER >= 1927
#        define G_NO_INLINE [[msvc::noinline]]
#      else
#        define G_NO_INLINE __declspec (noinline)
#      endif
#   endif
# else
#   define G_NO_INLINE __attribute__ ((__noinline__))
# endif
#elif defined (_MSC_VER) && (1200 <= _MSC_VER)
  /* Use MSVC specific syntax.  */
    /* Use ISO C++11 syntax when the compiler supports it. */
# if G_CXX_STD_CHECK_VERSION (20) && _MSC_VER >= 1927
#   define G_NO_INLINE [[msvc::noinline]]
# else
#   define G_NO_INLINE __declspec (noinline)
# endif
#else
# define G_NO_INLINE /* empty */
#endif

/*
 * The G_LIKELY and G_UNLIKELY macros let the programmer give hints to 
 * the compiler about the expected result of an expression. Some compilers
 * can use this information for optimizations.
 *
 * The _G_BOOLEAN_EXPR macro is intended to trigger a gcc warning when
 * putting assignments in g_return_if_fail ().  
 */
#if G_GNUC_CHECK_VERSION(2, 0) && defined(__OPTIMIZE__)
#define _G_BOOLEAN_EXPR_IMPL(uniq, expr)        \
 G_GNUC_EXTENSION ({                            \
   int G_PASTE (_g_boolean_var_, uniq);         \
   if (expr)                                    \
      G_PASTE (_g_boolean_var_, uniq) = 1;      \
   else                                         \
      G_PASTE (_g_boolean_var_, uniq) = 0;      \
   G_PASTE (_g_boolean_var_, uniq);             \
})
#define _G_BOOLEAN_EXPR(expr) _G_BOOLEAN_EXPR_IMPL (__COUNTER__, expr)
#define G_LIKELY(expr) (__builtin_expect (_G_BOOLEAN_EXPR(expr), 1))
#define G_UNLIKELY(expr) (__builtin_expect (_G_BOOLEAN_EXPR(expr), 0))
#else
#define G_LIKELY(expr) (expr)
#define G_UNLIKELY(expr) (expr)
#endif

#if __GNUC__ >= 4 && !defined(_WIN32) && !defined(__CYGWIN__)
#define G_HAVE_GNUC_VISIBILITY 1
#endif

/* GLIB_CANNOT_IGNORE_DEPRECATIONS is defined above for compilers that do not
 * have a way to temporarily suppress deprecation warnings. In these cases,
 * suppress the deprecated attribute altogether (otherwise a simple #include
 * <glib.h> will emit a barrage of warnings).
 */
#if defined(GLIB_CANNOT_IGNORE_DEPRECATIONS)
#define G_DEPRECATED
#elif G_GNUC_CHECK_VERSION(3, 1) || defined(__clang__)
#define G_DEPRECATED __attribute__((__deprecated__))
#elif defined(_MSC_VER) && (_MSC_VER >= 1300)
#define G_DEPRECATED __declspec(deprecated)
#else
#define G_DEPRECATED
#endif

#if defined(GLIB_CANNOT_IGNORE_DEPRECATIONS)
#define G_DEPRECATED_FOR(f) G_DEPRECATED
#elif G_GNUC_CHECK_VERSION(4, 5) || defined(__clang__)
#define G_DEPRECATED_FOR(f) __attribute__((__deprecated__("Use '" #f "' instead")))
#elif defined(_MSC_FULL_VER) && (_MSC_FULL_VER > 140050320)
#define G_DEPRECATED_FOR(f) __declspec(deprecated("is deprecated. Use '" #f "' instead"))
#else
#define G_DEPRECATED_FOR(f) G_DEPRECATED
#endif

#if G_GNUC_CHECK_VERSION(4, 5) || defined(__clang__)
#define G_UNAVAILABLE(maj,min) __attribute__((deprecated("Not available before " #maj "." #min)))
#elif defined(_MSC_FULL_VER) && (_MSC_FULL_VER > 140050320)
#define G_UNAVAILABLE(maj,min) __declspec(deprecated("is not available before " #maj "." #min))
#else
#define G_UNAVAILABLE(maj,min) G_DEPRECATED
#endif

/* These macros are used to mark deprecated symbols in GLib headers,
 * and thus have to be exposed in installed headers. But please
 * do *not* use them in other projects. Instead, use G_DEPRECATED
 * or define your own wrappers around it.
 */

#if !defined(GLIB_DISABLE_DEPRECATION_WARNINGS) && \
    (G_GNUC_CHECK_VERSION(4, 6) ||                 \
     __clang_major__ > 3 || (__clang_major__ == 3 && __clang_minor__ >= 4))
#define _GLIB_GNUC_DO_PRAGMA(x) _Pragma(G_STRINGIFY (x))
#define GLIB_DEPRECATED_MACRO _GLIB_GNUC_DO_PRAGMA(GCC warning "Deprecated pre-processor symbol")
#define GLIB_DEPRECATED_MACRO_FOR(f) \
  _GLIB_GNUC_DO_PRAGMA(GCC warning G_STRINGIFY (Deprecated pre-processor symbol: replace with #f))
#define GLIB_UNAVAILABLE_MACRO(maj,min) \
  _GLIB_GNUC_DO_PRAGMA(GCC warning G_STRINGIFY (Not available before maj.min))
#else
#define GLIB_DEPRECATED_MACRO
#define GLIB_DEPRECATED_MACRO_FOR(f)
#define GLIB_UNAVAILABLE_MACRO(maj,min)
#endif

#if !defined(GLIB_DISABLE_DEPRECATION_WARNINGS) && \
    (G_GNUC_CHECK_VERSION(6, 1) ||                 \
     (defined (__clang_major__) && (__clang_major__ > 3 || (__clang_major__ == 3 && __clang_minor__ >= 0))))
#define GLIB_DEPRECATED_ENUMERATOR G_DEPRECATED
#define GLIB_DEPRECATED_ENUMERATOR_FOR(f) G_DEPRECATED_FOR(f)
#define GLIB_UNAVAILABLE_ENUMERATOR(maj,min) G_UNAVAILABLE(maj,min)
#else
#define GLIB_DEPRECATED_ENUMERATOR
#define GLIB_DEPRECATED_ENUMERATOR_FOR(f)
#define GLIB_UNAVAILABLE_ENUMERATOR(maj,min)
#endif

#if !defined(GLIB_DISABLE_DEPRECATION_WARNINGS) && \
    (G_GNUC_CHECK_VERSION(3, 1) ||                 \
     (defined (__clang_major__) && (__clang_major__ > 3 || (__clang_major__ == 3 && __clang_minor__ >= 0))))
#define GLIB_DEPRECATED_TYPE G_DEPRECATED
#define GLIB_DEPRECATED_TYPE_FOR(f) G_DEPRECATED_FOR(f)
#define GLIB_UNAVAILABLE_TYPE(maj,min) G_UNAVAILABLE(maj,min)
#else
#define GLIB_DEPRECATED_TYPE
#define GLIB_DEPRECATED_TYPE_FOR(f)
#define GLIB_UNAVAILABLE_TYPE(maj,min)
#endif

#ifndef __GI_SCANNER__

#if g_macro__has_attribute(cleanup)

/* these macros are private; note that gstdio.h also uses _GLIB_CLEANUP */
#define _GLIB_AUTOPTR_FUNC_NAME(TypeName) glib_autoptr_cleanup_##TypeName
#define _GLIB_AUTOPTR_CLEAR_FUNC_NAME(TypeName) glib_autoptr_clear_##TypeName
#define _GLIB_AUTOPTR_TYPENAME(TypeName)  TypeName##_autoptr
#define _GLIB_AUTOPTR_LIST_FUNC_NAME(TypeName) glib_listautoptr_cleanup_##TypeName
#define _GLIB_AUTOPTR_LIST_TYPENAME(TypeName)  TypeName##_listautoptr
#define _GLIB_AUTOPTR_SLIST_FUNC_NAME(TypeName) glib_slistautoptr_cleanup_##TypeName
#define _GLIB_AUTOPTR_SLIST_TYPENAME(TypeName)  TypeName##_slistautoptr
#define _GLIB_AUTOPTR_QUEUE_FUNC_NAME(TypeName) glib_queueautoptr_cleanup_##TypeName
#define _GLIB_AUTOPTR_QUEUE_TYPENAME(TypeName)  TypeName##_queueautoptr
#define _GLIB_AUTO_FUNC_NAME(TypeName)    glib_auto_cleanup_##TypeName
#define _GLIB_CLEANUP(func)               __attribute__((cleanup(func)))
#define _GLIB_DEFINE_AUTOPTR_CLEANUP_FUNCS(TypeName, ParentName, cleanup) \
  typedef TypeName *_GLIB_AUTOPTR_TYPENAME(TypeName);                                                           \
  typedef GList *_GLIB_AUTOPTR_LIST_TYPENAME(TypeName);                                                         \
  typedef GSList *_GLIB_AUTOPTR_SLIST_TYPENAME(TypeName);                                                       \
  typedef GQueue *_GLIB_AUTOPTR_QUEUE_TYPENAME(TypeName);                                                       \
  G_GNUC_BEGIN_IGNORE_DEPRECATIONS                                                                              \
  static G_GNUC_UNUSED inline void _GLIB_AUTOPTR_CLEAR_FUNC_NAME(TypeName) (TypeName *_ptr)                     \
    { if (_ptr) (cleanup) ((ParentName *) _ptr); }                                                              \
  static G_GNUC_UNUSED inline void _GLIB_AUTOPTR_FUNC_NAME(TypeName) (TypeName **_ptr)                          \
    { _GLIB_AUTOPTR_CLEAR_FUNC_NAME(TypeName) (*_ptr); }                                                        \
  static G_GNUC_UNUSED inline void _GLIB_AUTOPTR_LIST_FUNC_NAME(TypeName) (GList **_l)                          \
    { g_list_free_full (*_l, (GDestroyNotify) (void(*)(void)) cleanup); }                                       \
  static G_GNUC_UNUSED inline void _GLIB_AUTOPTR_SLIST_FUNC_NAME(TypeName) (GSList **_l)                        \
    { g_slist_free_full (*_l, (GDestroyNotify) (void(*)(void)) cleanup); }                                      \
  static G_GNUC_UNUSED inline void _GLIB_AUTOPTR_QUEUE_FUNC_NAME(TypeName) (GQueue **_q)                        \
    { if (*_q) g_queue_free_full (*_q, (GDestroyNotify) (void(*)(void)) cleanup); }                             \
  G_GNUC_END_IGNORE_DEPRECATIONS
#define _GLIB_DEFINE_AUTOPTR_CHAINUP(ModuleObjName, ParentName) \
  _GLIB_DEFINE_AUTOPTR_CLEANUP_FUNCS(ModuleObjName, ParentName, _GLIB_AUTOPTR_CLEAR_FUNC_NAME(ParentName))


/* these macros are API */
#define G_DEFINE_AUTOPTR_CLEANUP_FUNC(TypeName, func) \
  _GLIB_DEFINE_AUTOPTR_CLEANUP_FUNCS(TypeName, TypeName, func)
#define G_DEFINE_AUTO_CLEANUP_CLEAR_FUNC(TypeName, func) \
  G_GNUC_BEGIN_IGNORE_DEPRECATIONS                                                                              \
  static G_GNUC_UNUSED inline void _GLIB_AUTO_FUNC_NAME(TypeName) (TypeName *_ptr) { (func) (_ptr); }                         \
  G_GNUC_END_IGNORE_DEPRECATIONS
#define G_DEFINE_AUTO_CLEANUP_FREE_FUNC(TypeName, func, none) \
  G_GNUC_BEGIN_IGNORE_DEPRECATIONS                                                                              \
  static G_GNUC_UNUSED inline void _GLIB_AUTO_FUNC_NAME(TypeName) (TypeName *_ptr) { if (*_ptr != none) (func) (*_ptr); }     \
  G_GNUC_END_IGNORE_DEPRECATIONS
#define g_autoptr(TypeName) _GLIB_CLEANUP(_GLIB_AUTOPTR_FUNC_NAME(TypeName)) _GLIB_AUTOPTR_TYPENAME(TypeName)
#define g_autolist(TypeName) _GLIB_CLEANUP(_GLIB_AUTOPTR_LIST_FUNC_NAME(TypeName)) _GLIB_AUTOPTR_LIST_TYPENAME(TypeName)
#define g_autoslist(TypeName) _GLIB_CLEANUP(_GLIB_AUTOPTR_SLIST_FUNC_NAME(TypeName)) _GLIB_AUTOPTR_SLIST_TYPENAME(TypeName)
#define g_autoqueue(TypeName) _GLIB_CLEANUP(_GLIB_AUTOPTR_QUEUE_FUNC_NAME(TypeName)) _GLIB_AUTOPTR_QUEUE_TYPENAME(TypeName)
#define g_auto(TypeName) _GLIB_CLEANUP(_GLIB_AUTO_FUNC_NAME(TypeName)) TypeName
#define g_autofree _GLIB_CLEANUP(g_autoptr_cleanup_generic_gfree)

#else /* not GNU C */
/* this (dummy) macro is private */
#define _GLIB_DEFINE_AUTOPTR_CHAINUP(ModuleObjName, ParentName)

/* these (dummy) macros are API */
#define G_DEFINE_AUTOPTR_CLEANUP_FUNC(TypeName, func)
#define G_DEFINE_AUTO_CLEANUP_CLEAR_FUNC(TypeName, func)
#define G_DEFINE_AUTO_CLEANUP_FREE_FUNC(TypeName, func, none)

/* no declaration of g_auto() or g_autoptr() here */
#endif /* __GNUC__ */

#else

#define _GLIB_DEFINE_AUTOPTR_CHAINUP(ModuleObjName, ParentName)

#define G_DEFINE_AUTOPTR_CLEANUP_FUNC(TypeName, func)
#define G_DEFINE_AUTO_CLEANUP_CLEAR_FUNC(TypeName, func)
#define G_DEFINE_AUTO_CLEANUP_FREE_FUNC(TypeName, func, none)

#endif /* __GI_SCANNER__ */

/**
 * G_SIZEOF_MEMBER:
 * @struct_type: a structure type, e.g. #GOutputVector
 * @member: a field in the structure, e.g. `size`
 *
 * Returns the size of @member in the struct definition without having a
 * declared instance of @struct_type.
 *
 * Returns: the size of @member in bytes.
 *
 * Since: 2.64
 */
#define G_SIZEOF_MEMBER(struct_type, member) \
    GLIB_AVAILABLE_MACRO_IN_2_64 \
    sizeof (((struct_type *) 0)->member)

#endif /* __G_MACROS_H__ */
