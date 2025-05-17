/*
 * HEIF codec.
 * Copyright (c) 2017 struktur AG, Dirk Farin <farin@struktur.de>
 *
 * This file is part of libheif.
 *
 * libheif is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, either version 3 of
 * the License, or (at your option) any later version.
 *
 * libheif is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with libheif.  If not, see <http://www.gnu.org/licenses/>.
 */

#ifndef LIBHEIF_HEIF_H
#define LIBHEIF_HEIF_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stddef.h>
#include <stdint.h>

#include <libheif/heif_version.h>


// API versions table
//
// release    dec.options   enc.options   heif_reader   heif_writer   depth.rep   col.profile
// ------------------------------------------------------------------------------------------
//  1.0            1           N/A           N/A           N/A           1           N/A
//  1.1            1           N/A           N/A            1            1           N/A
//  1.3            1            1             1             1            1           N/A
//  1.4            1            1             1             1            1            1
//  1.7            2            1             1             1            1            1
//  1.9.2          2            2             1             1            1            1
//  1.10           2            3             1             1            1            1
//  1.11           2            4             1             1            1            1
//  1.13           3            4             1             1            1            1
//  1.14           3            5             1             1            1            1
//  1.15           4            5             1             1            1            1
//  1.16           5            6             1             1            1            1

#if defined(_MSC_VER) && !defined(LIBHEIF_STATIC_BUILD)
#ifdef LIBHEIF_EXPORTS
#define LIBHEIF_API __declspec(dllexport)
#else
#define LIBHEIF_API __declspec(dllimport)
#endif
#elif defined(HAVE_VISIBILITY) && HAVE_VISIBILITY
#ifdef LIBHEIF_EXPORTS
#define LIBHEIF_API __attribute__((__visibility__("default")))
#else
#define LIBHEIF_API
#endif
#else
#define LIBHEIF_API
#endif

#define heif_fourcc(a, b, c, d) ((uint32_t)((a<<24) | (b<<16) | (c<<8) | d))


/* === version numbers === */

// Version string of linked libheif library.
LIBHEIF_API const char* heif_get_version(void);

// Numeric version of linked libheif library, encoded as BCD 0xHHMMLL00 = HH.MM.LL.
// For example: 0x02143000 is version 2.14.30
LIBHEIF_API uint32_t heif_get_version_number(void);

// Numeric part "HH" from above. Returned as a decimal number (not BCD).
LIBHEIF_API int heif_get_version_number_major(void);
// Numeric part "MM" from above. Returned as a decimal number (not BCD).
LIBHEIF_API int heif_get_version_number_minor(void);
// Numeric part "LL" from above. Returned as a decimal number (not BCD).
LIBHEIF_API int heif_get_version_number_maintenance(void);

// Helper macros to check for given versions of libheif at compile time.
// Note: h, m, l should be 2-digit BCD numbers. I.e., decimal 17 = 0x17 (BCD)
#define LIBHEIF_MAKE_VERSION(h, m, l) ((h) << 24 | (m) << 16 | (l) << 8)
#define LIBHEIF_HAVE_VERSION(h, m, l) (LIBHEIF_NUMERIC_VERSION >= LIBHEIF_MAKE_VERSION(h, m, l))

struct heif_context;
struct heif_image_handle;
struct heif_image;


enum heif_error_code
{
  // Everything ok, no error occurred.
  heif_error_Ok = 0,

  // Input file does not exist.
  heif_error_Input_does_not_exist = 1,

  // Error in input file. Corrupted or invalid content.
  heif_error_Invalid_input = 2,

  // Input file type is not supported.
  heif_error_Unsupported_filetype = 3,

  // Image requires an unsupported decoder feature.
  heif_error_Unsupported_feature = 4,

  // Library API has been used in an invalid way.
  heif_error_Usage_error = 5,

  // Could not allocate enough memory.
  heif_error_Memory_allocation_error = 6,

  // The decoder plugin generated an error
  heif_error_Decoder_plugin_error = 7,

  // The encoder plugin generated an error
  heif_error_Encoder_plugin_error = 8,

  // Error during encoding or when writing to the output
  heif_error_Encoding_error = 9,

  // Application has asked for a color profile type that does not exist
  heif_error_Color_profile_does_not_exist = 10,

  // Error loading a dynamic plugin
  heif_error_Plugin_loading_error = 11
};


enum heif_suberror_code
{
  // no further information available
  heif_suberror_Unspecified = 0,

  // --- Invalid_input ---

  // End of data reached unexpectedly.
  heif_suberror_End_of_data = 100,

  // Size of box (defined in header) is wrong
  heif_suberror_Invalid_box_size = 101,

  // Mandatory 'ftyp' box is missing
  heif_suberror_No_ftyp_box = 102,

  heif_suberror_No_idat_box = 103,

  heif_suberror_No_meta_box = 104,

  heif_suberror_No_hdlr_box = 105,

  heif_suberror_No_hvcC_box = 106,

  heif_suberror_No_pitm_box = 107,

  heif_suberror_No_ipco_box = 108,

  heif_suberror_No_ipma_box = 109,

  heif_suberror_No_iloc_box = 110,

  heif_suberror_No_iinf_box = 111,

  heif_suberror_No_iprp_box = 112,

  heif_suberror_No_iref_box = 113,

  heif_suberror_No_pict_handler = 114,

  // An item property referenced in the 'ipma' box is not existing in the 'ipco' container.
  heif_suberror_Ipma_box_references_nonexisting_property = 115,

  // No properties have been assigned to an item.
  heif_suberror_No_properties_assigned_to_item = 116,

  // Image has no (compressed) data
  heif_suberror_No_item_data = 117,

  // Invalid specification of image grid (tiled image)
  heif_suberror_Invalid_grid_data = 118,

  // Tile-images in a grid image are missing
  heif_suberror_Missing_grid_images = 119,

  heif_suberror_Invalid_clean_aperture = 120,

  // Invalid specification of overlay image
  heif_suberror_Invalid_overlay_data = 121,

  // Overlay image completely outside of visible canvas area
  heif_suberror_Overlay_image_outside_of_canvas = 122,

  heif_suberror_Auxiliary_image_type_unspecified = 123,

  heif_suberror_No_or_invalid_primary_item = 124,

  heif_suberror_No_infe_box = 125,

  heif_suberror_Unknown_color_profile_type = 126,

  heif_suberror_Wrong_tile_image_chroma_format = 127,

  heif_suberror_Invalid_fractional_number = 128,

  heif_suberror_Invalid_image_size = 129,

  heif_suberror_Invalid_pixi_box = 130,

  heif_suberror_No_av1C_box = 131,

  heif_suberror_Wrong_tile_image_pixel_depth = 132,

  heif_suberror_Unknown_NCLX_color_primaries = 133,

  heif_suberror_Unknown_NCLX_transfer_characteristics = 134,

  heif_suberror_Unknown_NCLX_matrix_coefficients = 135,

  // Invalid specification of region item
  heif_suberror_Invalid_region_data = 136,


  // --- Memory_allocation_error ---

  // A security limit preventing unreasonable memory allocations was exceeded by the input file.
  // Please check whether the file is valid. If it is, contact us so that we could increase the
  // security limits further.
  heif_suberror_Security_limit_exceeded = 1000,


  // --- Usage_error ---

  // An item ID was used that is not present in the file.
  heif_suberror_Nonexisting_item_referenced = 2000, // also used for Invalid_input

  // An API argument was given a NULL pointer, which is not allowed for that function.
  heif_suberror_Null_pointer_argument = 2001,

  // Image channel referenced that does not exist in the image
  heif_suberror_Nonexisting_image_channel_referenced = 2002,

  // The version of the passed plugin is not supported.
  heif_suberror_Unsupported_plugin_version = 2003,

  // The version of the passed writer is not supported.
  heif_suberror_Unsupported_writer_version = 2004,

  // The given (encoder) parameter name does not exist.
  heif_suberror_Unsupported_parameter = 2005,

  // The value for the given parameter is not in the valid range.
  heif_suberror_Invalid_parameter_value = 2006,

  // Error in property specification
  heif_suberror_Invalid_property = 2007,

  // Image reference cycle found in iref
  heif_suberror_Item_reference_cycle = 2008,


  // --- Unsupported_feature ---

  // Image was coded with an unsupported compression method.
  heif_suberror_Unsupported_codec = 3000,

  // Image is specified in an unknown way, e.g. as tiled grid image (which is supported)
  heif_suberror_Unsupported_image_type = 3001,

  heif_suberror_Unsupported_data_version = 3002,

  // The conversion of the source image to the requested chroma / colorspace is not supported.
  heif_suberror_Unsupported_color_conversion = 3003,

  heif_suberror_Unsupported_item_construction_method = 3004,

  heif_suberror_Unsupported_header_compression_method = 3005,


  // --- Encoder_plugin_error ---

  heif_suberror_Unsupported_bit_depth = 4000,


  // --- Encoding_error ---

  heif_suberror_Cannot_write_output_data = 5000,

  heif_suberror_Encoder_initialization = 5001,
  heif_suberror_Encoder_encoding = 5002,
  heif_suberror_Encoder_cleanup = 5003,

  heif_suberror_Too_many_regions = 5004,


  // --- Plugin loading error ---

  heif_suberror_Plugin_loading_error = 6000,        // a specific plugin file cannot be loaded
  heif_suberror_Plugin_is_not_loaded = 6001,        // trying to remove a plugin that is not loaded
  heif_suberror_Cannot_read_plugin_directory = 6002 // error while scanning the directory for plugins
};


struct heif_error
{
  // main error category
  enum heif_error_code code;

  // more detailed error code
  enum heif_suberror_code subcode;

  // textual error message (is always defined, you do not have to check for NULL)
  const char* message;
};


typedef uint32_t heif_item_id;
typedef uint32_t heif_property_id;



// ========================= library initialization ======================

// You should call heif_init() when you start using libheif and heif_deinit() when you are finished.
// These calls are reference counted. Each call to heif_init() should be matched by one call to heif_deinit().
// For backwards compatibility, it is not really necessary to call heif_init(), but if you don't, the plugins
// registered by default may not be freed correctly.
// However, this should not be mixed, i.e. one part of your program does use heif_init()/heif_deinit() and another doesn't.
// If in doubt, enclose everything with init/deinit.

struct heif_init_params
{
  int version;

  // currently no parameters
};


// You may pass nullptr to get default parameters. Currently, no parameters are supported.
LIBHEIF_API
struct heif_error heif_init(struct heif_init_params*);

LIBHEIF_API
void heif_deinit();


// --- Plugins are currently only supported on Unix platforms.

enum heif_plugin_type
{
  heif_plugin_type_encoder,
  heif_plugin_type_decoder
};

struct heif_plugin_info
{
  int version; // version of this info struct
  enum heif_plugin_type type;
  const void* plugin;
  void* internal_handle; // for internal use only
};

LIBHEIF_API
struct heif_error heif_load_plugin(const char* filename, struct heif_plugin_info const** out_plugin);

LIBHEIF_API
struct heif_error heif_load_plugins(const char* directory,
                                    const struct heif_plugin_info** out_plugins,
                                    int* out_nPluginsLoaded,
                                    int output_array_size);

LIBHEIF_API
struct heif_error heif_unload_plugin(const struct heif_plugin_info* plugin);


// ========================= file type check ======================

enum heif_filetype_result
{
  heif_filetype_no,
  heif_filetype_yes_supported,   // it is heif and can be read by libheif
  heif_filetype_yes_unsupported, // it is heif, but cannot be read by libheif
  heif_filetype_maybe // not sure whether it is an heif, try detection with more input data
};

// input data should be at least 12 bytes
LIBHEIF_API
enum heif_filetype_result heif_check_filetype(const uint8_t* data, int len);

LIBHEIF_API
int heif_check_jpeg_filetype(const uint8_t* data, int len);


// DEPRECATED, use heif_brand2 and the heif_brand2_* constants below instead
enum heif_brand
{
  heif_unknown_brand,
  heif_heic, // HEIF image with h265
  heif_heix, // 10bit images, or anything that uses h265 with range extension
  heif_hevc, heif_hevx, // brands for image sequences
  heif_heim, // multiview
  heif_heis, // scalable
  heif_hevm, // multiview sequence
  heif_hevs, // scalable sequence
  heif_mif1, // image, any coding algorithm
  heif_msf1, // sequence, any coding algorithm
  heif_avif, // HEIF image with AV1
  heif_avis,
  heif_vvic, // VVC image
  heif_vvis, // VVC sequence
  heif_evbi, // EVC image
  heif_evbs, // EVC sequence
};

// input data should be at least 12 bytes
// DEPRECATED, use heif_read_main_brand() instead
LIBHEIF_API
enum heif_brand heif_main_brand(const uint8_t* data, int len);


typedef uint32_t heif_brand2;

#define heif_brand2_heic   heif_fourcc('h','e','i','c') // HEIF image with h265
#define heif_brand2_heix   heif_fourcc('h','e','i','x') // 10bit images, or anything that uses h265 with range extension
#define heif_brand2_hevc   heif_fourcc('h','e','v','c') // image sequences
#define heif_brand2_hevx   heif_fourcc('h','e','v','x') // HDR image sequence
#define heif_brand2_heim   heif_fourcc('h','e','i','m') // multiview
#define heif_brand2_heis   heif_fourcc('h','e','i','s') // scalable
#define heif_brand2_hevm   heif_fourcc('h','e','v','m') // multiview sequence
#define heif_brand2_hevs   heif_fourcc('h','e','v','s') // scalable sequence
#define heif_brand2_avif   heif_fourcc('a','v','i','f') // AVIF image (AV1)
#define heif_brand2_avis   heif_fourcc('a','v','i','s') // AVIF sequence
#define heif_brand2_mif1   heif_fourcc('m','i','f','1') // image, any coding algorithm
#define heif_brand2_mif2   heif_fourcc('m','i','f','2') // image, any coding algorithm
#define heif_brand2_msf1   heif_fourcc('m','s','f','1') // sequence, any coding algorithm
#define heif_brand2_vvic   heif_fourcc('v','v','i','c') // VVC image
#define heif_brand2_vvis   heif_fourcc('v','v','i','s') // VVC sequence
#define heif_brand2_evbi   heif_fourcc('e','v','b','i') // EVC image
#define heif_brand2_evbs   heif_fourcc('e','v','b','s') // EVC sequence


// input data should be at least 12 bytes
LIBHEIF_API
heif_brand2 heif_read_main_brand(const uint8_t* data, int len);

// 'brand_fourcc' must be 4 character long, but need not be 0-terminated
LIBHEIF_API
heif_brand2 heif_fourcc_to_brand(const char* brand_fourcc);

// the output buffer must be at least 4 bytes long
LIBHEIF_API
void heif_brand_to_fourcc(heif_brand2 brand, char* out_fourcc);

// 'brand_fourcc' must be 4 character long, but need not be 0-terminated
// returns 1 if file includes the brand, and 0 if it does not
// returns -1 if the provided data is not sufficient
//            (you should input at least as many bytes as indicated in the first 4 bytes of the file, usually ~50 bytes will do)
// returns -2 on other errors
LIBHEIF_API
int heif_has_compatible_brand(const uint8_t* data, int len, const char* brand_fourcc);

// Returns an array of compatible brands. The array is allocated by this function and has to be freed with 'heif_free_list_of_compatible_brands()'.
// The number of entries is returned in out_size.
LIBHEIF_API
struct heif_error heif_list_compatible_brands(const uint8_t* data, int len, heif_brand2** out_brands, int* out_size);

LIBHEIF_API
void heif_free_list_of_compatible_brands(heif_brand2* brands_list);


// Returns one of these MIME types:
// - image/heic           HEIF file using h265 compression
// - image/heif           HEIF file using any other compression
// - image/heic-sequence  HEIF image sequence using h265 compression
// - image/heif-sequence  HEIF image sequence using any other compression
// - image/avif           AVIF image
// - image/avif-sequence  AVIF sequence
// - image/jpeg    JPEG image
// - image/png     PNG image
// If the format could not be detected, an empty string is returned.
//
// Provide at least 12 bytes of input. With less input, its format might not
// be detected. You may also provide more input to increase detection accuracy.
//
// Note that JPEG and PNG images cannot be decoded by libheif even though the
// formats are detected by this function.
LIBHEIF_API
const char* heif_get_file_mime_type(const uint8_t* data, int len);



// ========================= heif_context =========================
// A heif_context represents a HEIF file that has been read.
// In the future, you will also be able to add pictures to a heif_context
// and write it into a file again.


// Allocate a new context for reading HEIF files.
// Has to be freed again with heif_context_free().
LIBHEIF_API
struct heif_context* heif_context_alloc(void);

// Free a previously allocated HEIF context. You should not free a context twice.
LIBHEIF_API
void heif_context_free(struct heif_context*);


struct heif_reading_options;

enum heif_reader_grow_status
{
  heif_reader_grow_status_size_reached,   // requested size has been reached, we can read until this point
  heif_reader_grow_status_timeout,        // size has not been reached yet, but it may still grow further
  heif_reader_grow_status_size_beyond_eof // size has not been reached and never will. The file has grown to its full size
};

struct heif_reader
{
  // API version supported by this reader
  int reader_api_version;

  // --- version 1 functions ---
  int64_t (* get_position)(void* userdata);

  // The functions read(), and seek() return 0 on success.
  // Generally, libheif will make sure that we do not read past the file size.
  int (* read)(void* data,
               size_t size,
               void* userdata);

  int (* seek)(int64_t position,
               void* userdata);

  // When calling this function, libheif wants to make sure that it can read the file
  // up to 'target_size'. This is useful when the file is currently downloaded and may
  // grow with time. You may, for example, extract the image sizes even before the actual
  // compressed image data has been completely downloaded.
  //
  // Even if your input files will not grow, you will have to implement at least
  // detection whether the target_size is above the (fixed) file length
  // (in this case, return 'size_beyond_eof').
  enum heif_reader_grow_status (* wait_for_file_size)(int64_t target_size, void* userdata);
};


// Read a HEIF file from a named disk file.
// The heif_reading_options should currently be set to NULL.
LIBHEIF_API
struct heif_error heif_context_read_from_file(struct heif_context*, const char* filename,
                                              const struct heif_reading_options*);

// Read a HEIF file stored completely in memory.
// The heif_reading_options should currently be set to NULL.
// DEPRECATED: use heif_context_read_from_memory_without_copy() instead.
LIBHEIF_API
struct heif_error heif_context_read_from_memory(struct heif_context*,
                                                const void* mem, size_t size,
                                                const struct heif_reading_options*);

// Same as heif_context_read_from_memory() except that the provided memory is not copied.
// That means, you will have to keep the memory area alive as long as you use the heif_context.
LIBHEIF_API
struct heif_error heif_context_read_from_memory_without_copy(struct heif_context*,
                                                             const void* mem, size_t size,
                                                             const struct heif_reading_options*);

LIBHEIF_API
struct heif_error heif_context_read_from_reader(struct heif_context*,
                                                const struct heif_reader* reader,
                                                void* userdata,
                                                const struct heif_reading_options*);

// Number of top-level images in the HEIF file. This does not include the thumbnails or the
// tile images that are composed to an image grid. You can get access to the thumbnails via
// the main image handle.
LIBHEIF_API
int heif_context_get_number_of_top_level_images(struct heif_context* ctx);

LIBHEIF_API
int heif_context_is_top_level_image_ID(struct heif_context* ctx, heif_item_id id);

// Fills in image IDs into the user-supplied int-array 'ID_array', preallocated with 'count' entries.
// Function returns the total number of IDs filled into the array.
LIBHEIF_API
int heif_context_get_list_of_top_level_image_IDs(struct heif_context* ctx,
                                                 heif_item_id* ID_array,
                                                 int count);

LIBHEIF_API
struct heif_error heif_context_get_primary_image_ID(struct heif_context* ctx, heif_item_id* id);

// Get a handle to the primary image of the HEIF file.
// This is the image that should be displayed primarily when there are several images in the file.
LIBHEIF_API
struct heif_error heif_context_get_primary_image_handle(struct heif_context* ctx,
                                                        struct heif_image_handle**);

// Get the handle for a specific top-level image from an image ID.
LIBHEIF_API
struct heif_error heif_context_get_image_handle(struct heif_context* ctx,
                                                heif_item_id id,
                                                struct heif_image_handle**);

// Print information about the boxes of a HEIF file to file descriptor.
// This is for debugging and informational purposes only. You should not rely on
// the output having a specific format. At best, you should not use this at all.
LIBHEIF_API
void heif_context_debug_dump_boxes_to_file(struct heif_context* ctx, int fd);


LIBHEIF_API
void heif_context_set_maximum_image_size_limit(struct heif_context* ctx, int maximum_width);

// If the maximum threads number is set to 0, the image tiles are decoded in the main thread.
// This is different from setting it to 1, which will generate a single background thread to decode the tiles.
// Note that this setting only affects libheif itself. The codecs itself may still use multi-threaded decoding.
// You can use it, for example, in cases where you are decoding several images in parallel anyway you thus want
// to minimize parallelism in each decoder.
LIBHEIF_API
void heif_context_set_max_decoding_threads(struct heif_context* ctx, int max_threads);


// ========================= heif_image_handle =========================

// An heif_image_handle is a handle to a logical image in the HEIF file.
// To get the actual pixel data, you have to decode the handle to an heif_image.
// An heif_image_handle also gives you access to the thumbnails and Exif data
// associated with an image.

// Once you obtained an heif_image_handle, you can already release the heif_context,
// since it is internally ref-counted.

// Release image handle.
LIBHEIF_API
void heif_image_handle_release(const struct heif_image_handle*);

// Check whether the given image_handle is the primary image of the file.
LIBHEIF_API
int heif_image_handle_is_primary_image(const struct heif_image_handle* handle);

LIBHEIF_API
heif_item_id heif_image_handle_get_item_id(const struct heif_image_handle* handle);

// Get the resolution of an image.
LIBHEIF_API
int heif_image_handle_get_width(const struct heif_image_handle* handle);

LIBHEIF_API
int heif_image_handle_get_height(const struct heif_image_handle* handle);

LIBHEIF_API
int heif_image_handle_has_alpha_channel(const struct heif_image_handle*);

LIBHEIF_API
int heif_image_handle_is_premultiplied_alpha(const struct heif_image_handle*);

// Returns -1 on error, e.g. if this information is not present in the image.
LIBHEIF_API
int heif_image_handle_get_luma_bits_per_pixel(const struct heif_image_handle*);

// Returns -1 on error, e.g. if this information is not present in the image.
LIBHEIF_API
int heif_image_handle_get_chroma_bits_per_pixel(const struct heif_image_handle*);

// Get the image width from the 'ispe' box. This is the original image size without
// any transformations applied to it. Do not use this unless you know exactly what
// you are doing.
LIBHEIF_API
int heif_image_handle_get_ispe_width(const struct heif_image_handle* handle);

LIBHEIF_API
int heif_image_handle_get_ispe_height(const struct heif_image_handle* handle);


// ------------------------- depth images -------------------------

LIBHEIF_API
int heif_image_handle_has_depth_image(const struct heif_image_handle*);

LIBHEIF_API
int heif_image_handle_get_number_of_depth_images(const struct heif_image_handle* handle);

LIBHEIF_API
int heif_image_handle_get_list_of_depth_image_IDs(const struct heif_image_handle* handle,
                                                  heif_item_id* ids, int count);

LIBHEIF_API
struct heif_error heif_image_handle_get_depth_image_handle(const struct heif_image_handle* handle,
                                                           heif_item_id depth_image_id,
                                                           struct heif_image_handle** out_depth_handle);


enum heif_depth_representation_type
{
  heif_depth_representation_type_uniform_inverse_Z = 0,
  heif_depth_representation_type_uniform_disparity = 1,
  heif_depth_representation_type_uniform_Z = 2,
  heif_depth_representation_type_nonuniform_disparity = 3
};

struct heif_depth_representation_info
{
  uint8_t version;

  // version 1 fields

  uint8_t has_z_near;
  uint8_t has_z_far;
  uint8_t has_d_min;
  uint8_t has_d_max;

  double z_near;
  double z_far;
  double d_min;
  double d_max;

  enum heif_depth_representation_type depth_representation_type;
  uint32_t disparity_reference_view;

  uint32_t depth_nonlinear_representation_model_size;
  uint8_t* depth_nonlinear_representation_model;

  // version 2 fields below
};


LIBHEIF_API
void heif_depth_representation_info_free(const struct heif_depth_representation_info* info);

// Returns true when there is depth_representation_info available
// Note 1: depth_image_id is currently unused because we support only one depth channel per image, but
// you should still provide the correct ID for future compatibility.
// Note 2: Because of an API bug before v1.11.0, the function also works when 'handle' is the handle of the depth image.
// However, you should pass the handle of the main image. Please adapt your code if needed.
LIBHEIF_API
int heif_image_handle_get_depth_image_representation_info(const struct heif_image_handle* handle,
                                                          heif_item_id depth_image_id,
                                                          const struct heif_depth_representation_info** out);



// ------------------------- thumbnails -------------------------

// List the number of thumbnails assigned to this image handle. Usually 0 or 1.
LIBHEIF_API
int heif_image_handle_get_number_of_thumbnails(const struct heif_image_handle* handle);

LIBHEIF_API
int heif_image_handle_get_list_of_thumbnail_IDs(const struct heif_image_handle* handle,
                                                heif_item_id* ids, int count);

// Get the image handle of a thumbnail image.
LIBHEIF_API
struct heif_error heif_image_handle_get_thumbnail(const struct heif_image_handle* main_image_handle,
                                                  heif_item_id thumbnail_id,
                                                  struct heif_image_handle** out_thumbnail_handle);


// ------------------------- auxiliary images -------------------------

#define LIBHEIF_AUX_IMAGE_FILTER_OMIT_ALPHA (1UL<<1)
#define LIBHEIF_AUX_IMAGE_FILTER_OMIT_DEPTH (2UL<<1)

// List the number of auxiliary images assigned to this image handle.
LIBHEIF_API
int heif_image_handle_get_number_of_auxiliary_images(const struct heif_image_handle* handle,
                                                     int aux_filter);

LIBHEIF_API
int heif_image_handle_get_list_of_auxiliary_image_IDs(const struct heif_image_handle* handle,
                                                      int aux_filter,
                                                      heif_item_id* ids, int count);

// You are responsible to deallocate the returned buffer with heif_image_handle_release_auxiliary_type().
LIBHEIF_API
struct heif_error heif_image_handle_get_auxiliary_type(const struct heif_image_handle* handle,
                                                       const char** out_type);

LIBHEIF_API
void heif_image_handle_release_auxiliary_type(const struct heif_image_handle* handle,
                                              const char** out_type);

// DEPRECATED (because typo in function name). Use heif_image_handle_release_auxiliary_type() instead.
LIBHEIF_API
void heif_image_handle_free_auxiliary_types(const struct heif_image_handle* handle,
                                            const char** out_type);

// Get the image handle of an auxiliary image.
LIBHEIF_API
struct heif_error heif_image_handle_get_auxiliary_image_handle(const struct heif_image_handle* main_image_handle,
                                                               heif_item_id auxiliary_id,
                                                               struct heif_image_handle** out_auxiliary_handle);


// ------------------------- metadata (Exif / XMP) -------------------------

// How many metadata blocks are attached to an image. If you only want to get EXIF data,
// set the type_filter to "Exif". Otherwise, set the type_filter to NULL.
LIBHEIF_API
int heif_image_handle_get_number_of_metadata_blocks(const struct heif_image_handle* handle,
                                                    const char* type_filter);

// 'type_filter' can be used to get only metadata of specific types, like "Exif".
// If 'type_filter' is NULL, it will return all types of metadata IDs.
LIBHEIF_API
int heif_image_handle_get_list_of_metadata_block_IDs(const struct heif_image_handle* handle,
                                                     const char* type_filter,
                                                     heif_item_id* ids, int count);

// Return a string indicating the type of the metadata, as specified in the HEIF file.
// Exif data will have the type string "Exif".
// This string will be valid until the next call to a libheif function.
// You do not have to free this string.
LIBHEIF_API
const char* heif_image_handle_get_metadata_type(const struct heif_image_handle* handle,
                                                heif_item_id metadata_id);

// For EXIF, the content type is empty.
// For XMP, the content type is "application/rdf+xml".
LIBHEIF_API
const char* heif_image_handle_get_metadata_content_type(const struct heif_image_handle* handle,
                                                        heif_item_id metadata_id);

// Get the size of the raw metadata, as stored in the HEIF file.
LIBHEIF_API
size_t heif_image_handle_get_metadata_size(const struct heif_image_handle* handle,
                                           heif_item_id metadata_id);

// 'out_data' must point to a memory area of the size reported by heif_image_handle_get_metadata_size().
// The data is returned exactly as stored in the HEIF file.
// For Exif data, you probably have to skip the first four bytes of the data, since they
// indicate the offset to the start of the TIFF header of the Exif data.
LIBHEIF_API
struct heif_error heif_image_handle_get_metadata(const struct heif_image_handle* handle,
                                                 heif_item_id metadata_id,
                                                 void* out_data);


// ------------------------- color profiles -------------------------

enum heif_color_profile_type
{
  heif_color_profile_type_not_present = 0,
  heif_color_profile_type_nclx = heif_fourcc('n', 'c', 'l', 'x'),
  heif_color_profile_type_rICC = heif_fourcc('r', 'I', 'C', 'C'),
  heif_color_profile_type_prof = heif_fourcc('p', 'r', 'o', 'f')
};


// Returns 'heif_color_profile_type_not_present' if there is no color profile.
// If there is an ICC profile and an NCLX profile, the ICC profile is returned.
// TODO: we need a new API for this function as images can contain both NCLX and ICC at the same time.
//       However, you can still use heif_image_handle_get_raw_color_profile() and
//       heif_image_handle_get_nclx_color_profile() to access both profiles.
LIBHEIF_API
enum heif_color_profile_type heif_image_handle_get_color_profile_type(const struct heif_image_handle* handle);

LIBHEIF_API
size_t heif_image_handle_get_raw_color_profile_size(const struct heif_image_handle* handle);

// Returns 'heif_error_Color_profile_does_not_exist' when there is no ICC profile.
LIBHEIF_API
struct heif_error heif_image_handle_get_raw_color_profile(const struct heif_image_handle* handle,
                                                          void* out_data);


enum heif_color_primaries
{
  heif_color_primaries_ITU_R_BT_709_5 = 1, // g=0.3;0.6, b=0.15;0.06, r=0.64;0.33, w=0.3127,0.3290
  heif_color_primaries_unspecified = 2,
  heif_color_primaries_ITU_R_BT_470_6_System_M = 4,
  heif_color_primaries_ITU_R_BT_470_6_System_B_G = 5,
  heif_color_primaries_ITU_R_BT_601_6 = 6,
  heif_color_primaries_SMPTE_240M = 7,
  heif_color_primaries_generic_film = 8,
  heif_color_primaries_ITU_R_BT_2020_2_and_2100_0 = 9,
  heif_color_primaries_SMPTE_ST_428_1 = 10,
  heif_color_primaries_SMPTE_RP_431_2 = 11,
  heif_color_primaries_SMPTE_EG_432_1 = 12,
  heif_color_primaries_EBU_Tech_3213_E = 22
};

enum heif_transfer_characteristics
{
  heif_transfer_characteristic_ITU_R_BT_709_5 = 1,
  heif_transfer_characteristic_unspecified = 2,
  heif_transfer_characteristic_ITU_R_BT_470_6_System_M = 4,
  heif_transfer_characteristic_ITU_R_BT_470_6_System_B_G = 5,
  heif_transfer_characteristic_ITU_R_BT_601_6 = 6,
  heif_transfer_characteristic_SMPTE_240M = 7,
  heif_transfer_characteristic_linear = 8,
  heif_transfer_characteristic_logarithmic_100 = 9,
  heif_transfer_characteristic_logarithmic_100_sqrt10 = 10,
  heif_transfer_characteristic_IEC_61966_2_4 = 11,
  heif_transfer_characteristic_ITU_R_BT_1361 = 12,
  heif_transfer_characteristic_IEC_61966_2_1 = 13,
  heif_transfer_characteristic_ITU_R_BT_2020_2_10bit = 14,
  heif_transfer_characteristic_ITU_R_BT_2020_2_12bit = 15,
  heif_transfer_characteristic_ITU_R_BT_2100_0_PQ = 16,
  heif_transfer_characteristic_SMPTE_ST_428_1 = 17,
  heif_transfer_characteristic_ITU_R_BT_2100_0_HLG = 18
};

enum heif_matrix_coefficients
{
  heif_matrix_coefficients_RGB_GBR = 0,
  heif_matrix_coefficients_ITU_R_BT_709_5 = 1,  // TODO: or 709-6 according to h.273
  heif_matrix_coefficients_unspecified = 2,
  heif_matrix_coefficients_US_FCC_T47 = 4,
  heif_matrix_coefficients_ITU_R_BT_470_6_System_B_G = 5,
  heif_matrix_coefficients_ITU_R_BT_601_6 = 6,  // TODO: or 601-7 according to h.273
  heif_matrix_coefficients_SMPTE_240M = 7,
  heif_matrix_coefficients_YCgCo = 8,
  heif_matrix_coefficients_ITU_R_BT_2020_2_non_constant_luminance = 9,
  heif_matrix_coefficients_ITU_R_BT_2020_2_constant_luminance = 10,
  heif_matrix_coefficients_SMPTE_ST_2085 = 11,
  heif_matrix_coefficients_chromaticity_derived_non_constant_luminance = 12,
  heif_matrix_coefficients_chromaticity_derived_constant_luminance = 13,
  heif_matrix_coefficients_ICtCp = 14
};

struct heif_color_profile_nclx
{
  // === version 1 fields

  uint8_t version;

  enum heif_color_primaries color_primaries;
  enum heif_transfer_characteristics transfer_characteristics;
  enum heif_matrix_coefficients matrix_coefficients;
  uint8_t full_range_flag;

  // --- decoded values (not used when saving nclx)

  float color_primary_red_x, color_primary_red_y;
  float color_primary_green_x, color_primary_green_y;
  float color_primary_blue_x, color_primary_blue_y;
  float color_primary_white_x, color_primary_white_y;
};

LIBHEIF_API
struct heif_error heif_nclx_color_profile_set_color_primaries(struct heif_color_profile_nclx* nclx, uint16_t cp);

LIBHEIF_API
struct heif_error heif_nclx_color_profile_set_transfer_characteristics(struct heif_color_profile_nclx* nclx, uint16_t transfer_characteristics);

LIBHEIF_API
struct heif_error heif_nclx_color_profile_set_matrix_coefficients(struct heif_color_profile_nclx* nclx, uint16_t matrix_coefficients);

// Returns 'heif_error_Color_profile_does_not_exist' when there is no NCLX profile.
// TODO: This function does currently not return an NCLX profile if it is stored in the image bitstream.
//       Only NCLX profiles stored as colr boxes are returned. This may change in the future.
LIBHEIF_API
struct heif_error heif_image_handle_get_nclx_color_profile(const struct heif_image_handle* handle,
                                                           struct heif_color_profile_nclx** out_data);

// Returned color profile has 'version' field set to the maximum allowed.
// Do not fill values for higher versions as these might be outside the allocated structure size.
// May return NULL.
LIBHEIF_API
struct heif_color_profile_nclx* heif_nclx_color_profile_alloc();

LIBHEIF_API
void heif_nclx_color_profile_free(struct heif_color_profile_nclx* nclx_profile);


LIBHEIF_API
enum heif_color_profile_type heif_image_get_color_profile_type(const struct heif_image* image);

LIBHEIF_API
size_t heif_image_get_raw_color_profile_size(const struct heif_image* image);

LIBHEIF_API
struct heif_error heif_image_get_raw_color_profile(const struct heif_image* image,
                                                   void* out_data);

LIBHEIF_API
struct heif_error heif_image_get_nclx_color_profile(const struct heif_image* image,
                                                    struct heif_color_profile_nclx** out_data);


// ------------------------- item properties -------------------------

enum heif_item_property_type
{
//  heif_item_property_unknown = -1,
  heif_item_property_type_invalid = 0,
  heif_item_property_type_user_description = heif_fourcc('u', 'd', 'e', 's'),
  heif_item_property_type_transform_mirror = heif_fourcc('i', 'm', 'i', 'r'),
  heif_item_property_type_transform_rotation = heif_fourcc('i', 'r', 'o', 't'),
  heif_item_property_type_transform_crop = heif_fourcc('c', 'l', 'a', 'p'),
  heif_item_property_type_image_size = heif_fourcc('i', 's', 'p', 'e')
};

// Get the heif_property_id for a heif_item_id.
// You may specify which property 'type' you want to receive.
// If you specify 'heif_item_property_type_invalid', all properties associated to that item are returned.
// The number of properties is returned, which are not more than 'count' if (out_list != nullptr).
// By setting out_list==nullptr, you can query the number of properties, 'count' is ignored.
LIBHEIF_API
int heif_item_get_properties_of_type(const struct heif_context* context,
                                     heif_item_id id,
                                     enum heif_item_property_type type,
                                     heif_property_id* out_list,
                                     int count);

// Returns all transformative properties in the correct order.
// This includes "irot", "imir", "clap".
// The number of properties is returned, which are not more than 'count' if (out_list != nullptr).
// By setting out_list==nullptr, you can query the number of properties, 'count' is ignored.
LIBHEIF_API
int heif_item_get_transformation_properties(const struct heif_context* context,
                                            heif_item_id id,
                                            heif_property_id* out_list,
                                            int count);

LIBHEIF_API
enum heif_item_property_type heif_item_get_property_type(const struct heif_context* context,
                                                         heif_item_id id,
                                                         heif_property_id property_id);

// The strings are managed by libheif. They will be deleted in heif_property_user_description_release().
struct heif_property_user_description
{
  int version;

  // version 1

  const char* lang;
  const char* name;
  const char* description;
  const char* tags;
};

// Get the "udes" user description property content.
// Undefined strings are returned as empty strings.
LIBHEIF_API
struct heif_error heif_item_get_property_user_description(const struct heif_context* context,
                                                          heif_item_id itemId,
                                                          heif_property_id propertyId,
                                                          struct heif_property_user_description** out);

// Add a "udes" user description property to the item.
// If any string pointers are NULL, an empty string will be used instead.
LIBHEIF_API
struct heif_error heif_item_add_property_user_description(const struct heif_context* context,
                                                          heif_item_id itemId,
                                                          const struct heif_property_user_description* description,
                                                          heif_property_id* out_propertyId);

// Release all strings and the object itself.
// Only call for objects that you received from heif_item_get_property_user_description().
LIBHEIF_API
void heif_property_user_description_release(struct heif_property_user_description*);

enum heif_transform_mirror_direction
{
  heif_transform_mirror_direction_vertical = 0,    // flip image vertically
  heif_transform_mirror_direction_horizontal = 1   // flip image horizontally
};

LIBHEIF_API
enum heif_transform_mirror_direction heif_item_get_property_transform_mirror(const struct heif_context* context,
                                                                             heif_item_id itemId,
                                                                             heif_property_id propertyId);

// Returns only 0, 90, 180, or 270 angle values.
// Returns -1 in case of error (but it will only return an error in case of wrong usage).
LIBHEIF_API
int heif_item_get_property_transform_rotation_ccw(const struct heif_context* context,
                                                  heif_item_id itemId,
                                                  heif_property_id propertyId);

// Returns the number of pixels that should be removed from the four edges.
// Because of the way this data is stored, you have to pass the image size at the moment of the crop operation
// to compute the cropped border sizes.
LIBHEIF_API
void heif_item_get_property_transform_crop_borders(const struct heif_context* context,
                                                   heif_item_id itemId,
                                                   heif_property_id propertyId,
                                                   int image_width, int image_height,
                                                   int* left, int* top, int* right, int* bottom);


// ========================= heif_image =========================

// An heif_image contains a decoded pixel image in various colorspaces, chroma formats,
// and bit depths.

// Note: when converting images to an interleaved chroma format, the resulting
// image contains only a single channel of type channel_interleaved with, e.g., 3 bytes per pixel,
// containing the interleaved R,G,B values.

// Planar RGB images are specified as heif_colorspace_RGB / heif_chroma_444.

enum heif_compression_format
{
  heif_compression_undefined = 0,
  heif_compression_HEVC = 1,
  heif_compression_AVC = 2,
  heif_compression_JPEG = 3,
  heif_compression_AV1 = 4,
  heif_compression_VVC = 5,
  heif_compression_EVC = 6,
  heif_compression_JPEG2000 = 7,  // ISO/IEC 15444-16:2021
  heif_compression_uncompressed = 8 // ISO/IEC 23001-17:2023
};

enum heif_chroma
{
  heif_chroma_undefined = 99,
  heif_chroma_monochrome = 0,
  heif_chroma_420 = 1,
  heif_chroma_422 = 2,
  heif_chroma_444 = 3,
  heif_chroma_interleaved_RGB = 10,
  heif_chroma_interleaved_RGBA = 11,
  heif_chroma_interleaved_RRGGBB_BE = 12,   // HDR, big endian.
  heif_chroma_interleaved_RRGGBBAA_BE = 13, // HDR, big endian.
  heif_chroma_interleaved_RRGGBB_LE = 14,   // HDR, little endian.
  heif_chroma_interleaved_RRGGBBAA_LE = 15  // HDR, little endian.
};

// DEPRECATED ENUM NAMES
#define heif_chroma_interleaved_24bit  heif_chroma_interleaved_RGB
#define heif_chroma_interleaved_32bit  heif_chroma_interleaved_RGBA


enum heif_colorspace
{
  heif_colorspace_undefined = 99,

  // heif_colorspace_YCbCr should be used with one of these heif_chroma values:
  // * heif_chroma_444
  // * heif_chroma_422
  // * heif_chroma_420
  heif_colorspace_YCbCr = 0,

  // heif_colorspace_RGB should be used with one of these heif_chroma values:
  // * heif_chroma_444 (for planar RGB)
  // * heif_chroma_interleaved_RGB
  // * heif_chroma_interleaved_RGBA
  // * heif_chroma_interleaved_RRGGBB_BE
  // * heif_chroma_interleaved_RRGGBBAA_BE
  // * heif_chroma_interleaved_RRGGBB_LE
  // * heif_chroma_interleaved_RRGGBBAA_LE
  heif_colorspace_RGB = 1,

  // heif_colorspace_monochrome should only be used with heif_chroma = heif_chroma_monochrome
  heif_colorspace_monochrome = 2
};

enum heif_channel
{
  heif_channel_Y = 0,
  heif_channel_Cb = 1,
  heif_channel_Cr = 2,
  heif_channel_R = 3,
  heif_channel_G = 4,
  heif_channel_B = 5,
  heif_channel_Alpha = 6,
  heif_channel_interleaved = 10
};


enum heif_progress_step
{
  heif_progress_step_total = 0,
  heif_progress_step_load_tile = 1
};


enum heif_chroma_downsampling_algorithm
{
  heif_chroma_downsampling_nearest_neighbor = 1,
  heif_chroma_downsampling_average = 2,

  // Combine with 'heif_chroma_upsampling_bilinear' for best quality.
  // Makes edges look sharper when using YUV 420 with bilinear chroma upsampling.
  heif_chroma_downsampling_sharp_yuv = 3
};

enum heif_chroma_upsampling_algorithm
{
  heif_chroma_upsampling_nearest_neighbor = 1,
  heif_chroma_upsampling_bilinear = 2
};

struct heif_color_conversion_options
{
  uint8_t version;

  // --- version 1 options

  enum heif_chroma_downsampling_algorithm preferred_chroma_downsampling_algorithm;
  enum heif_chroma_upsampling_algorithm preferred_chroma_upsampling_algorithm;

  // When set to 'false', libheif may also use a different algorithm if the preferred one is not available.
  uint8_t only_use_preferred_chroma_algorithm;
};


struct heif_decoding_options
{
  uint8_t version;

  // version 1 options

  // Ignore geometric transformations like cropping, rotation, mirroring.
  // Default: false (do not ignore).
  uint8_t ignore_transformations;

  void (* start_progress)(enum heif_progress_step step, int max_progress, void* progress_user_data);

  void (* on_progress)(enum heif_progress_step step, int progress, void* progress_user_data);

  void (* end_progress)(enum heif_progress_step step, void* progress_user_data);

  void* progress_user_data;

  // version 2 options

  uint8_t convert_hdr_to_8bit;

  // version 3 options

  // When enabled, an error is returned for invalid input. Otherwise, it will try its best and
  // add decoding warnings to the decoded heif_image. Default is non-strict.
  uint8_t strict_decoding;

  // version 4 options

  // name_id of the decoder to use for the decoding.
  // If set to NULL (default), the highest priority decoder is chosen.
  // The priority is defined in the plugin.
  const char* decoder_id;


  // version 5 options

  struct heif_color_conversion_options color_conversion_options;
};


// Allocate decoding options and fill with default values.
// Note: you should always get the decoding options through this function since the
// option structure may grow in size in future versions.
LIBHEIF_API
struct heif_decoding_options* heif_decoding_options_alloc();

LIBHEIF_API
void heif_decoding_options_free(struct heif_decoding_options*);

// Decode an heif_image_handle into the actual pixel image and also carry out
// all geometric transformations specified in the HEIF file (rotation, cropping, mirroring).
//
// If colorspace or chroma is set to heif_colorspace_undefined or heif_chroma_undefined,
// respectively, the original colorspace is taken.
// Decoding options may be NULL. If you want to supply options, always use
// heif_decoding_options_alloc() to get the structure.
LIBHEIF_API
struct heif_error heif_decode_image(const struct heif_image_handle* in_handle,
                                    struct heif_image** out_img,
                                    enum heif_colorspace colorspace,
                                    enum heif_chroma chroma,
                                    const struct heif_decoding_options* options);

// Get the colorspace format of the image.
LIBHEIF_API
enum heif_colorspace heif_image_get_colorspace(const struct heif_image*);

// Get the chroma format of the image.
LIBHEIF_API
enum heif_chroma heif_image_get_chroma_format(const struct heif_image*);

// Get width of the given image channel in pixels. Returns -1 if a non-existing
// channel was given.
LIBHEIF_API
int heif_image_get_width(const struct heif_image*, enum heif_channel channel);

// Get height of the given image channel in pixels. Returns -1 if a non-existing
// channel was given.
LIBHEIF_API
int heif_image_get_height(const struct heif_image*, enum heif_channel channel);

// Get the width of the main channel (Y in YCbCr, or any in RGB).
LIBHEIF_API
int heif_image_get_primary_width(const struct heif_image*);

LIBHEIF_API
int heif_image_get_primary_height(const struct heif_image*);

LIBHEIF_API
struct heif_error heif_image_crop(struct heif_image* img,
                                  int left, int right, int top, int bottom);

// Get the number of bits per pixel in the given image channel. Returns -1 if
// a non-existing channel was given.
// Note that the number of bits per pixel may be different for each color channel.
// This function returns the number of bits used for storage of each pixel.
// Especially for HDR images, this is probably not what you want. Have a look at
// heif_image_get_bits_per_pixel_range() instead.
LIBHEIF_API
int heif_image_get_bits_per_pixel(const struct heif_image*, enum heif_channel channel);


// Get the number of bits per pixel in the given image channel. This function returns
// the number of bits used for representing the pixel value, which might be smaller
// than the number of bits used in memory.
// For example, in 12bit HDR images, this function returns '12', while still 16 bits
// are reserved for storage. For interleaved RGBA with 12 bit, this function also returns
// '12', not '48' or '64' (heif_image_get_bits_per_pixel returns 64 in this case).
LIBHEIF_API
int heif_image_get_bits_per_pixel_range(const struct heif_image*, enum heif_channel channel);

LIBHEIF_API
int heif_image_has_channel(const struct heif_image*, enum heif_channel channel);

// Get a pointer to the actual pixel data.
// The 'out_stride' is returned as "bytes per line".
// When out_stride is NULL, no value will be written.
// Returns NULL if a non-existing channel was given.
LIBHEIF_API
const uint8_t* heif_image_get_plane_readonly(const struct heif_image*,
                                             enum heif_channel channel,
                                             int* out_stride);

LIBHEIF_API
uint8_t* heif_image_get_plane(struct heif_image*,
                              enum heif_channel channel,
                              int* out_stride);


struct heif_scaling_options;

// Currently, heif_scaling_options is not defined yet. Pass a NULL pointer.
LIBHEIF_API
struct heif_error heif_image_scale_image(const struct heif_image* input,
                                         struct heif_image** output,
                                         int width, int height,
                                         const struct heif_scaling_options* options);

// The color profile is not attached to the image handle because we might need it
// for color space transform and encoding.
LIBHEIF_API
struct heif_error heif_image_set_raw_color_profile(struct heif_image* image,
                                                   const char* profile_type_fourcc_string,
                                                   const void* profile_data,
                                                   const size_t profile_size);

LIBHEIF_API
struct heif_error heif_image_set_nclx_color_profile(struct heif_image* image,
                                                    const struct heif_color_profile_nclx* color_profile);


// TODO: this function does not make any sense yet, since we currently cannot modify existing HEIF files.
//LIBHEIF_API
//void heif_image_remove_color_profile(struct heif_image* image);

// Fills the image decoding warnings into the provided 'out_warnings' array.
// The size of the array has to be provided in max_output_buffer_entries.
// If max_output_buffer_entries==0, the number of decoder warnings is returned.
// The function fills the warnings into the provided buffer, starting with 'first_warning_idx'.
// It returns the number of warnings filled into the buffer.
// Note: you can iterate through all warnings by using 'max_output_buffer_entries=1' and iterate 'first_warning_idx'.
LIBHEIF_API
int heif_image_get_decoding_warnings(struct heif_image* image,
                                     int first_warning_idx,
                                     struct heif_error* out_warnings,
                                     int max_output_buffer_entries);

// This function is only for decoder plugin implementors.
LIBHEIF_API
void heif_image_add_decoding_warning(struct heif_image* image,
                                     struct heif_error err);

// Release heif_image.
LIBHEIF_API
void heif_image_release(const struct heif_image*);


// Note: a value of 0 for any of these values indicates that the value is undefined.
// The unit of these values is Candelas per square meter.
struct heif_content_light_level
{
  uint16_t max_content_light_level;
  uint16_t max_pic_average_light_level;
};

LIBHEIF_API
int heif_image_has_content_light_level(const struct heif_image*);

LIBHEIF_API
void heif_image_get_content_light_level(const struct heif_image*, struct heif_content_light_level* out);

LIBHEIF_API
void heif_image_set_content_light_level(const struct heif_image*, const struct heif_content_light_level* in);


// Note: color coordinates are defined according to the CIE 1931 definition of x as specified in ISO 11664-1 (see also ISO 11664-3 and CIE 15).
struct heif_mastering_display_colour_volume
{
  uint16_t display_primaries_x[3];
  uint16_t display_primaries_y[3];
  uint16_t white_point_x;
  uint16_t white_point_y;
  uint32_t max_display_mastering_luminance;
  uint32_t min_display_mastering_luminance;
};

// The units for max_display_mastering_luminance and min_display_mastering_luminance is Candelas per square meter.
struct heif_decoded_mastering_display_colour_volume
{
  float display_primaries_x[3];
  float display_primaries_y[3];
  float white_point_x;
  float white_point_y;
  double max_display_mastering_luminance;
  double min_display_mastering_luminance;
};

LIBHEIF_API
int heif_image_has_mastering_display_colour_volume(const struct heif_image*);

LIBHEIF_API
void heif_image_get_mastering_display_colour_volume(const struct heif_image*, struct heif_mastering_display_colour_volume* out);

LIBHEIF_API
void heif_image_set_mastering_display_colour_volume(const struct heif_image*, const struct heif_mastering_display_colour_volume* in);

// Converts the internal numeric representation of heif_mastering_display_colour_volume to the
// normalized values, collected in heif_decoded_mastering_display_colour_volume.
// Values that are out-of-range are decoded to 0, indicating an undefined value (as specified in ISO/IEC 23008-2).
LIBHEIF_API
struct heif_error heif_mastering_display_colour_volume_decode(const struct heif_mastering_display_colour_volume* in,
                                                              struct heif_decoded_mastering_display_colour_volume* out);

LIBHEIF_API
void heif_image_get_pixel_aspect_ratio(const struct heif_image*, uint32_t* aspect_h, uint32_t* aspect_v);

LIBHEIF_API
void heif_image_set_pixel_aspect_ratio(struct heif_image*, uint32_t aspect_h, uint32_t aspect_v);

// ====================================================================================================
//  Encoding API

LIBHEIF_API
struct heif_error heif_context_write_to_file(struct heif_context*,
                                             const char* filename);

struct heif_writer
{
  // API version supported by this writer
  int writer_api_version;

  // --- version 1 functions ---
  struct heif_error (* write)(struct heif_context* ctx, // TODO: why do we need this parameter?
                              const void* data,
                              size_t size,
                              void* userdata);
};

LIBHEIF_API
struct heif_error heif_context_write(struct heif_context*,
                                     struct heif_writer* writer,
                                     void* userdata);


// ----- encoder -----

// The encoder used for actually encoding an image.
struct heif_encoder;

// A description of the encoder's capabilities and name.
struct heif_encoder_descriptor;

// A configuration parameter of the encoder. Each encoder implementation may have a different
// set of parameters. For the most common settings (e.q. quality), special functions to set
// the parameters are provided.
struct heif_encoder_parameter;

struct heif_decoder_descriptor;

// Get a list of available decoders. You can filter the encoders by compression format.
// Use format_filter==heif_compression_undefined to get all available decoders.
// The returned list of decoders is sorted by their priority (which is a plugin property).
// The number of decoders is returned, which are not more than 'count' if (out_decoders != nullptr).
// By setting out_decoders==nullptr, you can query the number of decoders, 'count' is ignored.
LIBHEIF_API
int heif_get_decoder_descriptors(enum heif_compression_format format_filter,
                                 const struct heif_decoder_descriptor** out_decoders,
                                 int count);

// Return a long, descriptive name of the decoder (including version information).
LIBHEIF_API
const char* heif_decoder_descriptor_get_name(const struct heif_decoder_descriptor*);

// Return a short, symbolic name for identifying the decoder.
// This name should stay constant over different decoder versions.
// Note: the returned ID may be NULL for old plugins that don't support this yet.
LIBHEIF_API
const char* heif_decoder_descriptor_get_id_name(const struct heif_decoder_descriptor*);

// DEPRECATED: use heif_get_encoder_descriptors() instead.
// Get a list of available encoders. You can filter the encoders by compression format and name.
// Use format_filter==heif_compression_undefined and name_filter==NULL as wildcards.
// The returned list of encoders is sorted by their priority (which is a plugin property).
// The number of encoders is returned, which are not more than 'count' if (out_encoders != nullptr).
// By setting out_encoders==nullptr, you can query the number of encoders, 'count' is ignored.
// Note: to get the actual encoder from the descriptors returned here, use heif_context_get_encoder().
LIBHEIF_API
int heif_context_get_encoder_descriptors(struct heif_context*, // TODO: why do we need this parameter?
                                         enum heif_compression_format format_filter,
                                         const char* name_filter,
                                         const struct heif_encoder_descriptor** out_encoders,
                                         int count);

// Get a list of available encoders. You can filter the encoders by compression format and name.
// Use format_filter==heif_compression_undefined and name_filter==NULL as wildcards.
// The returned list of encoders is sorted by their priority (which is a plugin property).
// The number of encoders is returned, which are not more than 'count' if (out_encoders != nullptr).
// By setting out_encoders==nullptr, you can query the number of encoders, 'count' is ignored.
// Note: to get the actual encoder from the descriptors returned here, use heif_context_get_encoder().
LIBHEIF_API
int heif_get_encoder_descriptors(enum heif_compression_format format_filter,
                                 const char* name_filter,
                                 const struct heif_encoder_descriptor** out_encoders,
                                 int count);

// Return a long, descriptive name of the encoder (including version information).
LIBHEIF_API
const char* heif_encoder_descriptor_get_name(const struct heif_encoder_descriptor*);

// Return a short, symbolic name for identifying the encoder.
// This name should stay constant over different encoder versions.
LIBHEIF_API
const char* heif_encoder_descriptor_get_id_name(const struct heif_encoder_descriptor*);

LIBHEIF_API
enum heif_compression_format
heif_encoder_descriptor_get_compression_format(const struct heif_encoder_descriptor*);

LIBHEIF_API
int heif_encoder_descriptor_supports_lossy_compression(const struct heif_encoder_descriptor*);

LIBHEIF_API
int heif_encoder_descriptor_supports_lossless_compression(const struct heif_encoder_descriptor*);


// Get an encoder instance that can be used to actually encode images from a descriptor.
LIBHEIF_API
struct heif_error heif_context_get_encoder(struct heif_context* context,
                                           const struct heif_encoder_descriptor*,
                                           struct heif_encoder** out_encoder);

// Quick check whether there is a decoder available for the given format.
// Note that the decoder still may not be able to decode all variants of that format.
// You will have to query that further (todo) or just try to decode and check the returned error.
LIBHEIF_API
int heif_have_decoder_for_format(enum heif_compression_format format);

// Quick check whether there is an enoder available for the given format.
// Note that the encoder may be limited to a certain subset of features (e.g. only 8 bit, only lossy).
// You will have to query the specific capabilities further.
LIBHEIF_API
int heif_have_encoder_for_format(enum heif_compression_format format);

// Get an encoder for the given compression format. If there are several encoder plugins
// for this format, the encoder with the highest plugin priority will be returned.
LIBHEIF_API
struct heif_error heif_context_get_encoder_for_format(struct heif_context* context,
                                                      enum heif_compression_format format,
                                                      struct heif_encoder**);

// You have to release the encoder after use.
LIBHEIF_API
void heif_encoder_release(struct heif_encoder*);

// Get the encoder name from the encoder itself.
LIBHEIF_API
const char* heif_encoder_get_name(const struct heif_encoder*);


// --- Encoder Parameters ---

// Libheif supports settings parameters through specialized functions and through
// generic functions by parameter name. Sometimes, the same parameter can be set
// in both ways.
// We consider it best practice to use the generic parameter functions only in
// dynamically generated user interfaces, as no guarantees are made that some specific
// parameter names are supported by all plugins.


// Set a 'quality' factor (0-100). How this is mapped to actual encoding parameters is
// encoder dependent.
LIBHEIF_API
struct heif_error heif_encoder_set_lossy_quality(struct heif_encoder*, int quality);

LIBHEIF_API
struct heif_error heif_encoder_set_lossless(struct heif_encoder*, int enable);

// level should be between 0 (= none) to 4 (= full)
LIBHEIF_API
struct heif_error heif_encoder_set_logging_level(struct heif_encoder*, int level);

// Get a generic list of encoder parameters.
// Each encoder may define its own, additional set of parameters.
// You do not have to free the returned list.
LIBHEIF_API
const struct heif_encoder_parameter* const* heif_encoder_list_parameters(struct heif_encoder*);

// Return the parameter name.
LIBHEIF_API
const char* heif_encoder_parameter_get_name(const struct heif_encoder_parameter*);


enum heif_encoder_parameter_type
{
  heif_encoder_parameter_type_integer = 1,
  heif_encoder_parameter_type_boolean = 2,
  heif_encoder_parameter_type_string = 3
};

// Return the parameter type.
LIBHEIF_API
enum heif_encoder_parameter_type heif_encoder_parameter_get_type(const struct heif_encoder_parameter*);

// DEPRECATED. Use heif_encoder_parameter_get_valid_integer_values() instead.
LIBHEIF_API
struct heif_error heif_encoder_parameter_get_valid_integer_range(const struct heif_encoder_parameter*,
                                                                 int* have_minimum_maximum,
                                                                 int* minimum, int* maximum);

// If integer is limited by a range, have_minimum and/or have_maximum will be != 0 and *minimum, *maximum is set.
// If integer is limited by a fixed set of values, *num_valid_values will be >0 and *out_integer_array is set.
LIBHEIF_API
struct heif_error heif_encoder_parameter_get_valid_integer_values(const struct heif_encoder_parameter*,
                                                                  int* have_minimum, int* have_maximum,
                                                                  int* minimum, int* maximum,
                                                                  int* num_valid_values,
                                                                  const int** out_integer_array);

LIBHEIF_API
struct heif_error heif_encoder_parameter_get_valid_string_values(const struct heif_encoder_parameter*,
                                                                 const char* const** out_stringarray);


LIBHEIF_API
struct heif_error heif_encoder_set_parameter_integer(struct heif_encoder*,
                                                     const char* parameter_name,
                                                     int value);

LIBHEIF_API
struct heif_error heif_encoder_get_parameter_integer(struct heif_encoder*,
                                                     const char* parameter_name,
                                                     int* value);

// TODO: name should be changed to heif_encoder_get_valid_integer_parameter_range
LIBHEIF_API // DEPRECATED.
struct heif_error heif_encoder_parameter_integer_valid_range(struct heif_encoder*,
                                                             const char* parameter_name,
                                                             int* have_minimum_maximum,
                                                             int* minimum, int* maximum);

LIBHEIF_API
struct heif_error heif_encoder_set_parameter_boolean(struct heif_encoder*,
                                                     const char* parameter_name,
                                                     int value);

LIBHEIF_API
struct heif_error heif_encoder_get_parameter_boolean(struct heif_encoder*,
                                                     const char* parameter_name,
                                                     int* value);

LIBHEIF_API
struct heif_error heif_encoder_set_parameter_string(struct heif_encoder*,
                                                    const char* parameter_name,
                                                    const char* value);

LIBHEIF_API
struct heif_error heif_encoder_get_parameter_string(struct heif_encoder*,
                                                    const char* parameter_name,
                                                    char* value, int value_size);

// returns a NULL-terminated list of valid strings or NULL if all values are allowed
LIBHEIF_API
struct heif_error heif_encoder_parameter_string_valid_values(struct heif_encoder*,
                                                             const char* parameter_name,
                                                             const char* const** out_stringarray);

LIBHEIF_API
struct heif_error heif_encoder_parameter_integer_valid_values(struct heif_encoder*,
                                                              const char* parameter_name,
                                                              int* have_minimum, int* have_maximum,
                                                              int* minimum, int* maximum,
                                                              int* num_valid_values,
                                                              const int** out_integer_array);

// Set a parameter of any type to the string value.
// Integer values are parsed from the string.
// Boolean values can be "true"/"false"/"1"/"0"
//
// x265 encoder specific note:
// When using the x265 encoder, you may pass any of its parameters by
// prefixing the parameter name with 'x265:'. Hence, to set the 'ctu' parameter,
// you will have to set 'x265:ctu' in libheif.
// Note that there is no checking for valid parameters when using the prefix.
LIBHEIF_API
struct heif_error heif_encoder_set_parameter(struct heif_encoder*,
                                             const char* parameter_name,
                                             const char* value);

// Get the current value of a parameter of any type as a human readable string.
// The returned string is compatible with heif_encoder_set_parameter().
LIBHEIF_API
struct heif_error heif_encoder_get_parameter(struct heif_encoder*,
                                             const char* parameter_name,
                                             char* value_ptr, int value_size);

// Query whether a specific parameter has a default value.
LIBHEIF_API
int heif_encoder_has_default(struct heif_encoder*,
                             const char* parameter_name);


// The orientation values are defined equal to the EXIF Orientation tag.
enum heif_orientation
{
  heif_orientation_normal = 1,
  heif_orientation_flip_horizontally = 2,
  heif_orientation_rotate_180 = 3,
  heif_orientation_flip_vertically = 4,
  heif_orientation_rotate_90_cw_then_flip_horizontally = 5,
  heif_orientation_rotate_90_cw = 6,
  heif_orientation_rotate_90_cw_then_flip_vertically = 7,
  heif_orientation_rotate_270_cw = 8
};


struct heif_encoding_options
{
  uint8_t version;

  // version 1 options

  uint8_t save_alpha_channel; // default: true

  // version 2 options

  // DEPRECATED. This option is not required anymore. Its value will be ignored.
  uint8_t macOS_compatibility_workaround;

  // version 3 options

  uint8_t save_two_colr_boxes_when_ICC_and_nclx_available; // default: false

  // version 4 options

  // Set this to the NCLX parameters to be used in the output image or set to NULL
  // when the same parameters as in the input image should be used.
  struct heif_color_profile_nclx* output_nclx_profile;

  uint8_t macOS_compatibility_workaround_no_nclx_profile;

  // version 5 options

  // libheif will generate irot/imir boxes to match these orientations
  enum heif_orientation image_orientation;

  // version 6 options

  struct heif_color_conversion_options color_conversion_options;
};

LIBHEIF_API
struct heif_encoding_options* heif_encoding_options_alloc();

LIBHEIF_API
void heif_encoding_options_free(struct heif_encoding_options*);


// Compress the input image.
// Returns a handle to the coded image in 'out_image_handle' unless out_image_handle = NULL.
// 'options' should be NULL for now.
// The first image added to the context is also automatically set the primary image, but
// you can change the primary image later with heif_context_set_primary_image().
LIBHEIF_API
struct heif_error heif_context_encode_image(struct heif_context*,
                                            const struct heif_image* image,
                                            struct heif_encoder* encoder,
                                            const struct heif_encoding_options* options,
                                            struct heif_image_handle** out_image_handle);

LIBHEIF_API
struct heif_error heif_context_set_primary_image(struct heif_context*,
                                                 struct heif_image_handle* image_handle);

// Encode the 'image' as a scaled down thumbnail image.
// The image is scaled down to fit into a square area of width 'bbox_size'.
// If the input image is already so small that it fits into this bounding box, no thumbnail
// image is encoded and NULL is returned in 'out_thumb_image_handle'.
// No error is returned in this case.
// The encoded thumbnail is automatically assigned to the 'master_image_handle'. Hence, you
// do not have to call heif_context_assign_thumbnail().
LIBHEIF_API
struct heif_error heif_context_encode_thumbnail(struct heif_context*,
                                                const struct heif_image* image,
                                                const struct heif_image_handle* master_image_handle,
                                                struct heif_encoder* encoder,
                                                const struct heif_encoding_options* options,
                                                int bbox_size,
                                                struct heif_image_handle** out_thumb_image_handle);

enum heif_metadata_compression
{
  heif_metadata_compression_off,
  heif_metadata_compression_auto,
  heif_metadata_compression_deflate
};

// Assign 'thumbnail_image' as the thumbnail image of 'master_image'.
LIBHEIF_API
struct heif_error heif_context_assign_thumbnail(struct heif_context*,
                                                const struct heif_image_handle* master_image,
                                                const struct heif_image_handle* thumbnail_image);

// Add EXIF metadata to an image.
LIBHEIF_API
struct heif_error heif_context_add_exif_metadata(struct heif_context*,
                                                 const struct heif_image_handle* image_handle,
                                                 const void* data, int size);

// Add XMP metadata to an image.
LIBHEIF_API
struct heif_error heif_context_add_XMP_metadata(struct heif_context*,
                                                const struct heif_image_handle* image_handle,
                                                const void* data, int size);

// New version of heif_context_add_XMP_metadata() with data compression (experimental).
LIBHEIF_API
struct heif_error heif_context_add_XMP_metadata2(struct heif_context*,
                                                 const struct heif_image_handle* image_handle,
                                                 const void* data, int size,
                                                 enum heif_metadata_compression compression);

// Add generic, proprietary metadata to an image. You have to specify an 'item_type' that will
// identify your metadata. 'content_type' can be an additional type, or it can be NULL.
// For example, this function can be used to add IPTC metadata (IIM stream, not XMP) to an image.
// Although not standard, we propose to store IPTC data with item type="iptc", content_type=NULL.
LIBHEIF_API
struct heif_error heif_context_add_generic_metadata(struct heif_context* ctx,
                                                    const struct heif_image_handle* image_handle,
                                                    const void* data, int size,
                                                    const char* item_type, const char* content_type);

// --- heif_image allocation

// Create a new image of the specified resolution and colorspace.
// Note: no memory for the actual image data is reserved yet. You have to use
// heif_image_add_plane() to add the image planes required by your colorspace/chroma.
LIBHEIF_API
struct heif_error heif_image_create(int width, int height,
                                    enum heif_colorspace colorspace,
                                    enum heif_chroma chroma,
                                    struct heif_image** out_image);

// The indicated bit_depth corresponds to the bit depth per channel.
// I.e. for interleaved formats like RRGGBB, the bit_depth would be, e.g., 10 bit instead
// of 30 bits or 3*16=48 bits.
// For backward compatibility, one can also specify 24bits for RGB and 32bits for RGBA,
// instead of the preferred 8 bits.
LIBHEIF_API
struct heif_error heif_image_add_plane(struct heif_image* image,
                                       enum heif_channel channel,
                                       int width, int height, int bit_depth);

// Signal that the image is premultiplied by the alpha pixel values.
LIBHEIF_API
void heif_image_set_premultiplied_alpha(struct heif_image* image,
                                        int is_premultiplied_alpha);

LIBHEIF_API
int heif_image_is_premultiplied_alpha(struct heif_image* image);

// This function extends the padding of the image so that it has at least the given physical size.
// The padding border is filled with the pixels along the right/bottom border.
// This function may be useful if you want to process the image, but have some external padding requirements.
// The image size will not be modified if it is already larger/equal than the given physical size.
// I.e. you cannot assume that after calling this function, the stride will be equal to min_physical_width.
LIBHEIF_API
struct heif_error heif_image_extend_padding_to_size(struct heif_image* image, int min_physical_width, int min_physical_height);



// --- register plugins

struct heif_decoder_plugin;
struct heif_encoder_plugin;

// DEPRECATED. Use heif_register_decoder_plugin(const struct heif_decoder_plugin*) instead.
LIBHEIF_API
struct heif_error heif_register_decoder(struct heif_context* heif, const struct heif_decoder_plugin*);

LIBHEIF_API
struct heif_error heif_register_decoder_plugin(const struct heif_decoder_plugin*);

LIBHEIF_API
struct heif_error heif_register_encoder_plugin(const struct heif_encoder_plugin*);

// DEPRECATED, typo in function name
LIBHEIF_API
int heif_encoder_descriptor_supportes_lossy_compression(const struct heif_encoder_descriptor*);

// DEPRECATED, typo in function name
LIBHEIF_API
int heif_encoder_descriptor_supportes_lossless_compression(const struct heif_encoder_descriptor*);


// --- region items and annotations

// See ISO/IEC 23008-12:2022 Section 6.10 "Region items and region annotations"

struct heif_region_item;

enum heif_region_type
{
  heif_region_type_point = 0,
  heif_region_type_rectangle = 1,
  heif_region_type_ellipse = 2,
  heif_region_type_polygon = 3,
  heif_region_type_referenced_mask = 4, // TODO
  heif_region_type_inline_mask = 5,     // TODO
  heif_region_type_polyline = 6
};

struct heif_region;

// How many region items are attached to an image.
LIBHEIF_API
int heif_image_handle_get_number_of_region_items(const struct heif_image_handle* image_handle);

// Get the region_item IDs assigned to an image.
// Returns the number of region items outputted.
LIBHEIF_API
int heif_image_handle_get_list_of_region_item_ids(const struct heif_image_handle* image_handle,
                                                  heif_item_id* region_item_ids_array,
                                                  int max_count);

// You have to release the output heif_region_item with heif_region_item_release().
LIBHEIF_API
struct heif_error heif_context_get_region_item(const struct heif_context* context,
                                               heif_item_id region_item_id,
                                               struct heif_region_item** out);

LIBHEIF_API
heif_item_id heif_region_item_get_id(struct heif_region_item*);

LIBHEIF_API
void heif_region_item_release(struct heif_region_item*);

// The reference size specifies the coordinate space using for the region items.
// It is the size of the area of the encoded image prior to any transformations.
LIBHEIF_API
void heif_region_item_get_reference_size(struct heif_region_item*, uint32_t* width, uint32_t* height);

LIBHEIF_API
int heif_region_item_get_number_of_regions(const struct heif_region_item* region_item);

// You will have to release all returned heif_region objects with heif_region_release() or heif_region_release_many().
// 'out_regions' should point to an array of size 'max_count'.
// The function returns the number of regions filled into the 'out_regions' array.
LIBHEIF_API
int heif_region_item_get_list_of_regions(const struct heif_region_item* region_item,
                                         struct heif_region** out_regions_array,
                                         int max_count);

LIBHEIF_API
void heif_region_release(const struct heif_region* region);

LIBHEIF_API
void heif_region_release_many(const struct heif_region* const* regions_array, int num);

LIBHEIF_API
enum heif_region_type heif_region_get_type(const struct heif_region* region);

// When querying the region geometry, there is a version without and a version with "_transformed" suffix.
// The version without returns the coordinates in the reference coordinate space.
// The version with "_transformed" suffix give the coordinates in pixels after all transformative properties have been applied.

LIBHEIF_API
struct heif_error heif_region_get_point(const struct heif_region* region, int32_t* x, int32_t* y);

LIBHEIF_API
struct heif_error heif_region_get_point_transformed(const struct heif_region* region, double* x, double* y,
                                                    heif_item_id image_id);

LIBHEIF_API
struct heif_error heif_region_get_rectangle(const struct heif_region* region,
                                            int32_t* x, int32_t* y,
                                            uint32_t* width, uint32_t* height);

LIBHEIF_API
struct heif_error heif_region_get_rectangle_transformed(const struct heif_region* region,
                                                        double* x, double* y,
                                                        double* width, double* height,
                                                        heif_item_id image_id);

LIBHEIF_API
struct heif_error heif_region_get_ellipse(const struct heif_region* region,
                                          int32_t* x, int32_t* y,
                                          uint32_t* radius_x, uint32_t* radius_y);

LIBHEIF_API
struct heif_error heif_region_get_ellipse_transformed(const struct heif_region* region,
                                                      double* x, double* y,
                                                      double* radius_x, double* radius_y,
                                                      heif_item_id image_id);

LIBHEIF_API
int heif_region_get_polygon_num_points(const struct heif_region* region);

// Point coordinates are stored in the output array 'pts'. This must have twice as many entries as there are points.
// Each point is stored as consecutive x and y positions.
LIBHEIF_API
struct heif_error heif_region_get_polygon_points(const struct heif_region* region,
                                                 int32_t* out_pts_array);

LIBHEIF_API
struct heif_error heif_region_get_polygon_points_transformed(const struct heif_region* region,
                                                             double* out_pts_array,
                                                             heif_item_id image_id);

LIBHEIF_API
int heif_region_get_polyline_num_points(const struct heif_region* region);

LIBHEIF_API
struct heif_error heif_region_get_polyline_points(const struct heif_region* region,
                                                  int32_t* out_pts_array);

LIBHEIF_API
struct heif_error heif_region_get_polyline_points_transformed(const struct heif_region* region,
                                                              double* out_pts_array,
                                                              heif_item_id image_id);

// --- adding region items

LIBHEIF_API
struct heif_error heif_image_handle_add_region_item(struct heif_image_handle* image_handle,
                                                    uint32_t reference_width, uint32_t reference_height,
                                                    struct heif_region_item** out_region_item);

// When adding regions, there is an optional 'out_region' parameter.
// This is usually not needed. You may set it to NULL.

LIBHEIF_API
struct heif_error heif_region_item_add_region_point(struct heif_region_item*,
                                                    int32_t x, int32_t y,
                                                    struct heif_region** out_region);

LIBHEIF_API
struct heif_error heif_region_item_add_region_rectangle(struct heif_region_item*,
                                                        int32_t x, int32_t y,
                                                        uint32_t width, uint32_t height,
                                                        struct heif_region** out_region);

LIBHEIF_API
struct heif_error heif_region_item_add_region_ellipse(struct heif_region_item*,
                                                      int32_t x, int32_t y,
                                                      uint32_t radius_x, uint32_t radius_y,
                                                      struct heif_region** out_region);

// pts[] is an array of 2*nPoints, each pair representing x and y.
LIBHEIF_API
struct heif_error heif_region_item_add_region_polygon(struct heif_region_item*,
                                                      const int32_t* pts_array, int nPoints,
                                                      struct heif_region** out_region);

LIBHEIF_API
struct heif_error heif_region_item_add_region_polyline(struct heif_region_item*,
                                                       const int32_t* pts_array, int nPoints,
                                                       struct heif_region** out_region);

#ifdef __cplusplus
}
#endif

#endif
