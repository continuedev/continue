/*
 * C++ interface to libheif
 * Copyright (c) 2018 struktur AG, Dirk Farin <farin@struktur.de>
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

#ifndef LIBHEIF_HEIF_CXX_H
#define LIBHEIF_HEIF_CXX_H

#include <memory>
#include <string>
#include <vector>

extern "C" {
#include <libheif/heif.h>
}


namespace heif {

  class Error
  {
  public:
    Error()
    {
      m_code = heif_error_Ok;
      m_subcode = heif_suberror_Unspecified;
      m_message = "Ok";
    }

    Error(const heif_error& err)
    {
      m_code = err.code;
      m_subcode = err.subcode;
      m_message = err.message;
    }

    Error(heif_error_code code, heif_suberror_code subcode, const std::string& msg)
    {
      m_code = code;
      m_subcode = subcode;
      m_message = msg;
    }

    const std::string& get_message() const
    { return m_message; }

    heif_error_code get_code() const
    { return m_code; }

    heif_suberror_code get_subcode() const
    { return m_subcode; }

    operator bool() const
    { return m_code != heif_error_Ok; }

  private:
    heif_error_code m_code;
    heif_suberror_code m_subcode;
    std::string m_message;
  };


  class ImageHandle;

  class Image;

  class Encoder;

  class EncoderParameter;

  class EncoderDescriptor;


  class Context
  {
  public:
    Context();

    class ReadingOptions
    {
    };

    // throws Error
    void read_from_file(const std::string& filename, const ReadingOptions& opts = ReadingOptions());

    // DEPRECATED. Use read_from_memory_without_copy() instead.
    // throws Error
    void read_from_memory(const void* mem, size_t size, const ReadingOptions& opts = ReadingOptions());

    // throws Error
    void read_from_memory_without_copy(const void* mem, size_t size, const ReadingOptions& opts = ReadingOptions());

    class Reader
    {
    public:
      virtual ~Reader() = default;

      virtual int64_t get_position() const = 0;

      virtual int read(void* data, size_t size) = 0;

      virtual int seek(int64_t position) = 0;

      virtual heif_reader_grow_status wait_for_file_size(int64_t target_size) = 0;
    };

    // throws Error
    void read_from_reader(Reader&, const ReadingOptions& opts = ReadingOptions());

    int get_number_of_top_level_images() const noexcept;

    bool is_top_level_image_ID(heif_item_id id) const noexcept;

    std::vector<heif_item_id> get_list_of_top_level_image_IDs() const noexcept;

    // throws Error
    heif_item_id get_primary_image_ID() const;

    // throws Error
    ImageHandle get_primary_image_handle() const;

    ImageHandle get_image_handle(heif_item_id id) const;


    class EncodingOptions : public heif_encoding_options
    {
    public:
      EncodingOptions();
    };

    // throws Error
    ImageHandle encode_image(const Image& img, Encoder& encoder,
                             const EncodingOptions& options = EncodingOptions());

    // throws Error
    void set_primary_image(ImageHandle& new_primary_image_handle);

    // throws Error
    ImageHandle encode_thumbnail(const Image& image,
                                 const ImageHandle& master_image,
                                 Encoder& encoder,
                                 const EncodingOptions&,
                                 int bbox_size);

    // throws Error
    void assign_thumbnail(const ImageHandle& thumbnail_image,
                          const ImageHandle& master_image);

    // throws Error
    void add_exif_metadata(const ImageHandle& master_image,
                           const void* data, int size);

    // throws Error
    void add_XMP_metadata(const ImageHandle& master_image,
                          const void* data, int size);

    class Writer
    {
    public:
      virtual ~Writer() = default;

      virtual heif_error write(const void* data, size_t size) = 0;
    };

    // throws Error
    void write(Writer&);

    // throws Error
    void write_to_file(const std::string& filename) const;

  private:
    std::shared_ptr<heif_context> m_context;

    friend struct ::heif_error heif_writer_trampoline_write(struct heif_context* ctx,
                                                            const void* data,
                                                            size_t size,
                                                            void* userdata);

    //static Context wrap_without_releasing(heif_context*); // internal use in friend function only
  };


  class ImageHandle
  {
  public:
    ImageHandle() = default;

    ImageHandle(heif_image_handle* handle);

    bool empty() const noexcept
    { return !m_image_handle; }

    bool is_primary_image() const noexcept;

    int get_width() const noexcept;

    int get_height() const noexcept;

    bool has_alpha_channel() const noexcept;

    bool is_premultiplied_alpha() const noexcept;

    int get_luma_bits_per_pixel() const noexcept;

    int get_chroma_bits_per_pixel() const noexcept;

    int get_ispe_width() const noexcept;

    int get_ispe_height() const noexcept;

    // ------------------------- depth images -------------------------

    // TODO

    // ------------------------- thumbnails -------------------------

    int get_number_of_thumbnails() const noexcept;

    std::vector<heif_item_id> get_list_of_thumbnail_IDs() const noexcept;

    // throws Error
    ImageHandle get_thumbnail(heif_item_id id);

    // ------------------------- metadata (Exif / XMP) -------------------------

    // Can optionally be filtered by type ("Exif" / "XMP")
    std::vector<heif_item_id> get_list_of_metadata_block_IDs(const char* type_filter = nullptr) const noexcept;

    std::string get_metadata_type(heif_item_id metadata_id) const noexcept;

    std::string get_metadata_content_type(heif_item_id metadata_id) const noexcept;

    // throws error
    std::vector<uint8_t> get_metadata(heif_item_id) const;


    class DecodingOptions
    {
    };

    // throws Error
    Image decode_image(heif_colorspace colorspace, heif_chroma chroma,
                       const DecodingOptions& options = DecodingOptions());


    heif_image_handle* get_raw_image_handle() noexcept
    { return m_image_handle.get(); }

    const heif_image_handle* get_raw_image_handle() const noexcept
    { return m_image_handle.get(); }

  private:
    std::shared_ptr<heif_image_handle> m_image_handle;
  };


  class ColorProfile_nclx
  {
  public:
    ColorProfile_nclx();

    ~ColorProfile_nclx();

    heif_color_primaries get_color_primaries() const;

    heif_transfer_characteristics get_transfer_characteristics() const;

    heif_matrix_coefficients get_matrix_coefficients() const;

    bool is_full_range() const;

    void set_color_primaries(heif_color_primaries cp);

    // DEPRECATED: typo in function name. Use set_color_primaries() instead.
    void set_color_primaties(heif_color_primaries cp);

    void set_transfer_characteristics(heif_transfer_characteristics tc);

    void set_matrix_coefficients(heif_matrix_coefficients mc);

    void set_full_range_flag(bool is_full_range);

  private:
    ColorProfile_nclx(heif_color_profile_nclx* nclx)
    { mProfile = nclx; }

    heif_color_profile_nclx* mProfile;

    friend class Image;
  };


  class Image
  {
  public:
    Image() = default;

    Image(heif_image* image);


    // throws Error
    void create(int width, int height,
                enum heif_colorspace colorspace,
                enum heif_chroma chroma);

    // throws Error
    void add_plane(enum heif_channel channel,
                   int width, int height, int bit_depth);

    heif_colorspace get_colorspace() const noexcept;

    heif_chroma get_chroma_format() const noexcept;

    int get_width(enum heif_channel channel) const noexcept;

    int get_height(enum heif_channel channel) const noexcept;

    int get_bits_per_pixel(enum heif_channel channel) const noexcept;

    int get_bits_per_pixel_range(enum heif_channel channel) const noexcept;

    bool has_channel(enum heif_channel channel) const noexcept;

    const uint8_t* get_plane(enum heif_channel channel, int* out_stride) const noexcept;

    uint8_t* get_plane(enum heif_channel channel, int* out_stride) noexcept;

    // throws Error
    void set_nclx_color_profile(const ColorProfile_nclx&);

    // throws Error
    ColorProfile_nclx get_nclx_color_profile() const;

    heif_color_profile_type get_color_profile_type() const;

    // throws Error
    std::vector<uint8_t> get_raw_color_profile() const;

    void set_raw_color_profile(heif_color_profile_type type,
                               const std::vector<uint8_t>& data);

    bool is_premultiplied_alpha() const noexcept;

    void set_premultiplied_alpha(bool is_premultiplied_alpha) noexcept;

    class ScalingOptions
    {
    };

    // throws Error
    Image scale_image(int width, int height,
                      const ScalingOptions& options = ScalingOptions()) const;

  private:
    std::shared_ptr<heif_image> m_image;

    friend class Context;
  };


  class EncoderDescriptor
  {
  public:
    static std::vector<EncoderDescriptor>
    get_encoder_descriptors(enum heif_compression_format format_filter,
                            const char* name_filter) noexcept;

    std::string get_name() const noexcept;

    std::string get_id_name() const noexcept;

    enum heif_compression_format get_compression_format() const noexcept;

    // DEPRECATED: typo in function name
    bool supportes_lossy_compression() const noexcept;

    // DEPRECATED: typo in function name
    bool supportes_lossless_compression() const noexcept;


    // throws Error
    Encoder get_encoder() const;

    bool supports_lossy_compression() const noexcept;

    bool supports_lossless_compression() const noexcept;

  private:
    EncoderDescriptor(const struct heif_encoder_descriptor* descr) : m_descriptor(descr)
    {}

    const struct heif_encoder_descriptor* m_descriptor = nullptr;
  };


  class EncoderParameter
  {
  public:
    std::string get_name() const noexcept;

    enum heif_encoder_parameter_type get_type() const noexcept;

    bool is_integer() const noexcept;

    // Returns 'true' if the integer range is limited.
    bool get_valid_integer_range(int& out_minimum, int& out_maximum);

    bool is_boolean() const noexcept;

    bool is_string() const noexcept;

    std::vector<std::string> get_valid_string_values() const;

  private:
    EncoderParameter(const heif_encoder_parameter*);

    const struct heif_encoder_parameter* m_parameter;

    friend class Encoder;
  };


  class Encoder
  {
  public:
    // throws Error
    Encoder(enum heif_compression_format format);

    // throws Error
    void set_lossy_quality(int quality);

    // throws Error
    void set_lossless(bool enable_lossless);

    std::vector<EncoderParameter> list_parameters() const noexcept;

    void set_integer_parameter(const std::string& parameter_name, int value);

    int get_integer_parameter(const std::string& parameter_name) const;

    void set_boolean_parameter(const std::string& parameter_name, bool value);

    bool get_boolean_parameter(const std::string& parameter_name) const;

    void set_string_parameter(const std::string& parameter_name, const std::string& value);

    std::string get_string_parameter(const std::string& parameter_name) const;

    void set_parameter(const std::string& parameter_name, const std::string& parameter_value);

    std::string get_parameter(const std::string& parameter_name) const;

  private:
    Encoder(struct heif_encoder*) noexcept;

    std::shared_ptr<heif_encoder> m_encoder;

    friend class EncoderDescriptor;

    friend class Context;
  };


  // ==========================================================================================
  //                                     IMPLEMENTATION
  // ==========================================================================================

  inline Context::Context()
  {
    heif_context* ctx = heif_context_alloc();
    m_context = std::shared_ptr<heif_context>(ctx,
                                              [](heif_context* c) { heif_context_free(c); });
  }

  inline void Context::read_from_file(const std::string& filename, const ReadingOptions& /*opts*/)
  {
    Error err = Error(heif_context_read_from_file(m_context.get(), filename.c_str(), NULL));
    if (err) {
      throw err;
    }
  }

  inline void Context::read_from_memory(const void* mem, size_t size, const ReadingOptions& /*opts*/)
  {
    Error err = Error(heif_context_read_from_memory(m_context.get(), mem, size, NULL));
    if (err) {
      throw err;
    }
  }

  inline void Context::read_from_memory_without_copy(const void* mem, size_t size, const ReadingOptions& /*opts*/)
  {
    Error err = Error(heif_context_read_from_memory_without_copy(m_context.get(), mem, size, NULL));
    if (err) {
      throw err;
    }
  }


  inline int64_t heif_reader_trampoline_get_position(void* userdata)
  {
    Context::Reader* reader = (Context::Reader*) userdata;
    return reader->get_position();
  }

  inline int heif_reader_trampoline_read(void* data, size_t size, void* userdata)
  {
    Context::Reader* reader = (Context::Reader*) userdata;
    return reader->read(data, size);
  }

  inline int heif_reader_trampoline_seek(int64_t position, void* userdata)
  {
    Context::Reader* reader = (Context::Reader*) userdata;
    return reader->seek(position);
  }

  inline heif_reader_grow_status heif_reader_trampoline_wait_for_file_size(int64_t target_size, void* userdata)
  {
    Context::Reader* reader = (Context::Reader*) userdata;
    return reader->wait_for_file_size(target_size);
  }


  static struct heif_reader heif_reader_trampoline =
      {
          1,
          heif_reader_trampoline_get_position,
          heif_reader_trampoline_read,
          heif_reader_trampoline_seek,
          heif_reader_trampoline_wait_for_file_size
      };

  inline void Context::read_from_reader(Reader& reader, const ReadingOptions& /*opts*/)
  {
    Error err = Error(heif_context_read_from_reader(m_context.get(), &heif_reader_trampoline,
                                                    &reader, NULL));
    if (err) {
      throw err;
    }
  }


  inline int Context::get_number_of_top_level_images() const noexcept
  {
    return heif_context_get_number_of_top_level_images(m_context.get());
  }

  inline bool Context::is_top_level_image_ID(heif_item_id id) const noexcept
  {
    return heif_context_is_top_level_image_ID(m_context.get(), id);
  }

  inline std::vector<heif_item_id> Context::get_list_of_top_level_image_IDs() const noexcept
  {
    int num = get_number_of_top_level_images();
    std::vector<heif_item_id> IDs(num);
    heif_context_get_list_of_top_level_image_IDs(m_context.get(), IDs.data(), num);
    return IDs;
  }

  inline heif_item_id Context::get_primary_image_ID() const
  {
    heif_item_id id;
    Error err = Error(heif_context_get_primary_image_ID(m_context.get(), &id));
    if (err) {
      throw err;
    }
    return id;
  }

  inline ImageHandle Context::get_primary_image_handle() const
  {
    heif_image_handle* handle;
    Error err = Error(heif_context_get_primary_image_handle(m_context.get(), &handle));
    if (err) {
      throw err;
    }

    return ImageHandle(handle);
  }

  inline ImageHandle Context::get_image_handle(heif_item_id id) const
  {
    struct heif_image_handle* handle;
    Error err = Error(heif_context_get_image_handle(m_context.get(), id, &handle));
    if (err) {
      throw err;
    }
    return ImageHandle(handle);
  }

#if 0
  inline Context Context::wrap_without_releasing(heif_context* ctx) {
    Context context;
    context.m_context = std::shared_ptr<heif_context>(ctx,
                                                      [] (heif_context*) { /* NOP */ });
    return context;
  }
#endif

  inline struct ::heif_error heif_writer_trampoline_write(struct heif_context* ctx,
                                                          const void* data,
                                                          size_t size,
                                                          void* userdata)
  {
    Context::Writer* writer = (Context::Writer*) userdata;

    (void) ctx;

    //Context context = Context::wrap_without_releasing(ctx);
    //return writer->write(context, data, size);
    return writer->write(data, size);
  }

  static struct heif_writer heif_writer_trampoline =
      {
          1,
          &heif_writer_trampoline_write
      };

  inline void Context::write(Writer& writer)
  {
    Error err = Error(heif_context_write(m_context.get(), &heif_writer_trampoline, &writer));
    if (err) {
      throw err;
    }
  }

  inline void Context::write_to_file(const std::string& filename) const
  {
    Error err = Error(heif_context_write_to_file(m_context.get(), filename.c_str()));
    if (err) {
      throw err;
    }
  }


  inline ImageHandle::ImageHandle(heif_image_handle* handle)
  {
    if (handle != nullptr) {
      m_image_handle = std::shared_ptr<heif_image_handle>(handle,
                                                          [](heif_image_handle* h) { heif_image_handle_release(h); });
    }
  }

  inline bool ImageHandle::is_primary_image() const noexcept
  {
    return heif_image_handle_is_primary_image(m_image_handle.get()) != 0;
  }

  inline int ImageHandle::get_width() const noexcept
  {
    return heif_image_handle_get_width(m_image_handle.get());
  }

  inline int ImageHandle::get_height() const noexcept
  {
    return heif_image_handle_get_height(m_image_handle.get());
  }

  inline bool ImageHandle::has_alpha_channel() const noexcept
  {
    return heif_image_handle_has_alpha_channel(m_image_handle.get()) != 0;
  }

  inline bool ImageHandle::is_premultiplied_alpha() const noexcept
  {
    return heif_image_handle_is_premultiplied_alpha(m_image_handle.get()) != 0;
  }

  inline int ImageHandle::get_luma_bits_per_pixel() const noexcept
  {
    return heif_image_handle_get_luma_bits_per_pixel(m_image_handle.get());
  }

  inline int ImageHandle::get_chroma_bits_per_pixel() const noexcept
  {
    return heif_image_handle_get_chroma_bits_per_pixel(m_image_handle.get());
  }

  inline int ImageHandle::get_ispe_width() const noexcept
  {
    return heif_image_handle_get_ispe_width(m_image_handle.get());
  }

  inline int ImageHandle::get_ispe_height() const noexcept
  {
    return heif_image_handle_get_ispe_height(m_image_handle.get());
  }

  // ------------------------- depth images -------------------------

  // TODO

  // ------------------------- thumbnails -------------------------

  inline int ImageHandle::get_number_of_thumbnails() const noexcept
  {
    return heif_image_handle_get_number_of_thumbnails(m_image_handle.get());
  }

  inline std::vector<heif_item_id> ImageHandle::get_list_of_thumbnail_IDs() const noexcept
  {
    int num = get_number_of_thumbnails();
    std::vector<heif_item_id> IDs(num);
    heif_image_handle_get_list_of_thumbnail_IDs(m_image_handle.get(), IDs.data(), num);
    return IDs;
  }

  inline ImageHandle ImageHandle::get_thumbnail(heif_item_id id)
  {
    heif_image_handle* handle;
    Error err = Error(heif_image_handle_get_thumbnail(m_image_handle.get(), id, &handle));
    if (err) {
      throw err;
    }

    return ImageHandle(handle);
  }

  inline Image ImageHandle::decode_image(heif_colorspace colorspace, heif_chroma chroma,
                                         const DecodingOptions& /*options*/)
  {
    heif_image* out_img;
    Error err = Error(heif_decode_image(m_image_handle.get(),
                                        &out_img,
                                        colorspace,
                                        chroma,
                                        nullptr)); //const struct heif_decoding_options* options);
    if (err) {
      throw err;
    }

    return Image(out_img);
  }


  inline std::vector<heif_item_id> ImageHandle::get_list_of_metadata_block_IDs(const char* type_filter) const noexcept
  {
    int nBlocks = heif_image_handle_get_number_of_metadata_blocks(m_image_handle.get(),
                                                                  type_filter);
    std::vector<heif_item_id> ids(nBlocks);
    int n = heif_image_handle_get_list_of_metadata_block_IDs(m_image_handle.get(),
                                                             type_filter,
                                                             ids.data(), nBlocks);
    (void) n;
    //assert(n==nBlocks);
    return ids;
  }

  inline std::string ImageHandle::get_metadata_type(heif_item_id metadata_id) const noexcept
  {
    return heif_image_handle_get_metadata_type(m_image_handle.get(), metadata_id);
  }

  inline std::string ImageHandle::get_metadata_content_type(heif_item_id metadata_id) const noexcept
  {
    return heif_image_handle_get_metadata_content_type(m_image_handle.get(), metadata_id);
  }

  inline std::vector<uint8_t> ImageHandle::get_metadata(heif_item_id metadata_id) const
  {
    size_t data_size = heif_image_handle_get_metadata_size(m_image_handle.get(),
                                                           metadata_id);

    std::vector<uint8_t> data(data_size);

    Error err = Error(heif_image_handle_get_metadata(m_image_handle.get(),
                                                     metadata_id,
                                                     data.data()));
    if (err) {
      throw err;
    }

    return data;
  }


  inline ColorProfile_nclx::ColorProfile_nclx()
  {
    mProfile = heif_nclx_color_profile_alloc();
  }

  inline ColorProfile_nclx::~ColorProfile_nclx()
  {
    heif_nclx_color_profile_free(mProfile);
  }

  inline heif_color_primaries ColorProfile_nclx::get_color_primaries() const
  { return mProfile->color_primaries; }

  inline heif_transfer_characteristics ColorProfile_nclx::get_transfer_characteristics() const
  { return mProfile->transfer_characteristics; }

  inline heif_matrix_coefficients ColorProfile_nclx::get_matrix_coefficients() const
  { return mProfile->matrix_coefficients; }

  inline bool ColorProfile_nclx::is_full_range() const
  { return mProfile->full_range_flag; }

  inline void ColorProfile_nclx::set_color_primaries(heif_color_primaries cp)
  { mProfile->color_primaries = cp; }

  inline void ColorProfile_nclx::set_color_primaties(heif_color_primaries cp)
  { set_color_primaries(cp); }

  inline void ColorProfile_nclx::set_transfer_characteristics(heif_transfer_characteristics tc)
  { mProfile->transfer_characteristics = tc; }

  inline void ColorProfile_nclx::set_matrix_coefficients(heif_matrix_coefficients mc)
  { mProfile->matrix_coefficients = mc; }

  inline void ColorProfile_nclx::set_full_range_flag(bool is_full_range)
  { mProfile->full_range_flag = is_full_range; }


  inline Image::Image(heif_image* image)
  {
    m_image = std::shared_ptr<heif_image>(image,
                                          [](heif_image* h) { heif_image_release(h); });
  }


  inline void Image::create(int width, int height,
                            enum heif_colorspace colorspace,
                            enum heif_chroma chroma)
  {
    heif_image* image;
    Error err = Error(heif_image_create(width, height, colorspace, chroma, &image));
    if (err) {
      m_image.reset();
      throw err;
    }
    else {
      m_image = std::shared_ptr<heif_image>(image,
                                            [](heif_image* h) { heif_image_release(h); });
    }
  }

  inline void Image::add_plane(enum heif_channel channel,
                               int width, int height, int bit_depth)
  {
    Error err = Error(heif_image_add_plane(m_image.get(), channel, width, height, bit_depth));
    if (err) {
      throw err;
    }
  }

  inline heif_colorspace Image::get_colorspace() const noexcept
  {
    return heif_image_get_colorspace(m_image.get());
  }

  inline heif_chroma Image::get_chroma_format() const noexcept
  {
    return heif_image_get_chroma_format(m_image.get());
  }

  inline int Image::get_width(enum heif_channel channel) const noexcept
  {
    return heif_image_get_width(m_image.get(), channel);
  }

  inline int Image::get_height(enum heif_channel channel) const noexcept
  {
    return heif_image_get_height(m_image.get(), channel);
  }

  inline int Image::get_bits_per_pixel(enum heif_channel channel) const noexcept
  {
    return heif_image_get_bits_per_pixel(m_image.get(), channel);
  }

  inline int Image::get_bits_per_pixel_range(enum heif_channel channel) const noexcept
  {
    return heif_image_get_bits_per_pixel_range(m_image.get(), channel);
  }

  inline bool Image::has_channel(enum heif_channel channel) const noexcept
  {
    return heif_image_has_channel(m_image.get(), channel);
  }

  inline const uint8_t* Image::get_plane(enum heif_channel channel, int* out_stride) const noexcept
  {
    return heif_image_get_plane_readonly(m_image.get(), channel, out_stride);
  }

  inline uint8_t* Image::get_plane(enum heif_channel channel, int* out_stride) noexcept
  {
    return heif_image_get_plane(m_image.get(), channel, out_stride);
  }

  inline void Image::set_nclx_color_profile(const ColorProfile_nclx& nclx)
  {
    Error err = Error(heif_image_set_nclx_color_profile(m_image.get(), nclx.mProfile));
    if (err) {
      throw err;
    }
  }

  // throws Error
  inline ColorProfile_nclx Image::get_nclx_color_profile() const
  {
    heif_color_profile_nclx* nclx = nullptr;
    Error err = Error(heif_image_get_nclx_color_profile(m_image.get(), &nclx));
    if (err) {
      throw err;
    }

    return ColorProfile_nclx(nclx);
  }


  inline heif_color_profile_type Image::get_color_profile_type() const
  {
    return heif_image_get_color_profile_type(m_image.get());
  }

  // throws Error
  inline std::vector<uint8_t> Image::get_raw_color_profile() const
  {
    auto size = heif_image_get_raw_color_profile_size(m_image.get());
    std::vector<uint8_t> profile(size);
    heif_image_get_raw_color_profile(m_image.get(), profile.data());
    return profile;
  }

  inline void Image::set_raw_color_profile(heif_color_profile_type type,
                                    const std::vector<uint8_t>& data)
  {
    const char* profile_type = nullptr;
    switch (type) {
      case heif_color_profile_type_prof:
        profile_type = "prof";
        break;
      case heif_color_profile_type_rICC:
        profile_type = "rICC";
        break;
      default:
        throw Error(heif_error_code::heif_error_Usage_error,
                    heif_suberror_Unspecified,
                    "invalid raw color profile type");
        break;
    }

    Error err = Error(heif_image_set_raw_color_profile(m_image.get(), profile_type,
                                                       data.data(), data.size()));
    if (err) {
      throw err;
    }
  }

  inline bool Image::is_premultiplied_alpha() const noexcept
  {
    return heif_image_is_premultiplied_alpha(m_image.get()) != 0;
  }

  inline void Image::set_premultiplied_alpha(bool is_premultiplied_alpha) noexcept
  {
    heif_image_set_premultiplied_alpha(m_image.get(), is_premultiplied_alpha);
  }

  inline Image Image::scale_image(int width, int height,
                                  const ScalingOptions&) const
  {
    heif_image* img;
    Error err = Error(heif_image_scale_image(m_image.get(), &img, width, height,
                                             nullptr)); // TODO: scaling options not defined yet
    if (err) {
      throw err;
    }

    return Image(img);
  }


  inline std::vector<EncoderDescriptor>
  EncoderDescriptor::get_encoder_descriptors(enum heif_compression_format format_filter,
                                             const char* name_filter) noexcept
  {
    int maxDescriptors = 10;
    int nDescriptors;
    for (;;) {
      const struct heif_encoder_descriptor** descriptors;
      descriptors = new const heif_encoder_descriptor* [maxDescriptors];

      nDescriptors = heif_context_get_encoder_descriptors(nullptr,
                                                          format_filter,
                                                          name_filter,
                                                          descriptors,
                                                          maxDescriptors);
      if (nDescriptors < maxDescriptors) {
        std::vector<EncoderDescriptor> outDescriptors;
        outDescriptors.reserve(nDescriptors);
        for (int i = 0; i < nDescriptors; i++) {
          outDescriptors.push_back(EncoderDescriptor(descriptors[i]));
        }

        delete[] descriptors;

        return outDescriptors;
      }
      else {
        delete[] descriptors;
        maxDescriptors *= 2;
      }
    }
  }


  inline std::string EncoderDescriptor::get_name() const noexcept
  {
    return heif_encoder_descriptor_get_name(m_descriptor);
  }

  inline std::string EncoderDescriptor::get_id_name() const noexcept
  {
    return heif_encoder_descriptor_get_id_name(m_descriptor);
  }

  inline enum heif_compression_format EncoderDescriptor::get_compression_format() const noexcept
  {
    return heif_encoder_descriptor_get_compression_format(m_descriptor);
  }

  inline bool EncoderDescriptor::supportes_lossy_compression() const noexcept
  {
    return heif_encoder_descriptor_supports_lossy_compression(m_descriptor);
  }

  inline bool EncoderDescriptor::supports_lossy_compression() const noexcept
  {
    return heif_encoder_descriptor_supports_lossy_compression(m_descriptor);
  }

  inline bool EncoderDescriptor::supportes_lossless_compression() const noexcept
  {
    return heif_encoder_descriptor_supports_lossless_compression(m_descriptor);
  }

  inline bool EncoderDescriptor::supports_lossless_compression() const noexcept
  {
    return heif_encoder_descriptor_supports_lossless_compression(m_descriptor);
  }

  inline Encoder EncoderDescriptor::get_encoder() const
  {
    heif_encoder* encoder;
    Error err = Error(heif_context_get_encoder(nullptr, m_descriptor, &encoder));
    if (err) {
      throw err;
    }

    return Encoder(encoder);
  }


  inline Encoder::Encoder(enum heif_compression_format format)
  {
    heif_encoder* encoder;
    Error err = Error(heif_context_get_encoder_for_format(nullptr, format, &encoder));
    if (err) {
      throw err;
    }

    m_encoder = std::shared_ptr<heif_encoder>(encoder,
                                              [](heif_encoder* e) { heif_encoder_release(e); });
  }

  inline Encoder::Encoder(struct heif_encoder* encoder) noexcept
  {
    m_encoder = std::shared_ptr<heif_encoder>(encoder,
                                              [](heif_encoder* e) { heif_encoder_release(e); });
  }


  inline EncoderParameter::EncoderParameter(const heif_encoder_parameter* param)
      : m_parameter(param)
  {
  }

  inline std::string EncoderParameter::get_name() const noexcept
  {
    return heif_encoder_parameter_get_name(m_parameter);
  }

  inline enum heif_encoder_parameter_type EncoderParameter::get_type() const noexcept
  {
    return heif_encoder_parameter_get_type(m_parameter);
  }

  inline bool EncoderParameter::is_integer() const noexcept
  {
    return get_type() == heif_encoder_parameter_type_integer;
  }

  inline bool EncoderParameter::get_valid_integer_range(int& out_minimum, int& out_maximum)
  {
    int have_minimum_maximum;
    Error err = Error(heif_encoder_parameter_get_valid_integer_range(m_parameter,
                                                                     &have_minimum_maximum,
                                                                     &out_minimum, &out_maximum));
    if (err) {
      throw err;
    }

    return have_minimum_maximum;
  }

  inline bool EncoderParameter::is_boolean() const noexcept
  {
    return get_type() == heif_encoder_parameter_type_boolean;
  }

  inline bool EncoderParameter::is_string() const noexcept
  {
    return get_type() == heif_encoder_parameter_type_string;
  }

  inline std::vector<std::string> EncoderParameter::get_valid_string_values() const
  {
    const char* const* stringarray;
    Error err = Error(heif_encoder_parameter_get_valid_string_values(m_parameter,
                                                                     &stringarray));
    if (err) {
      throw err;
    }

    std::vector<std::string> values;
    for (int i = 0; stringarray[i]; i++) {
      values.push_back(stringarray[i]);
    }

    return values;
  }

  inline std::vector<EncoderParameter> Encoder::list_parameters() const noexcept
  {
    std::vector<EncoderParameter> parameters;

    for (const struct heif_encoder_parameter* const* params = heif_encoder_list_parameters(m_encoder.get());
         *params;
         params++) {
      parameters.push_back(EncoderParameter(*params));
    }

    return parameters;
  }


  inline void Encoder::set_lossy_quality(int quality)
  {
    Error err = Error(heif_encoder_set_lossy_quality(m_encoder.get(), quality));
    if (err) {
      throw err;
    }
  }

  inline void Encoder::set_lossless(bool enable_lossless)
  {
    Error err = Error(heif_encoder_set_lossless(m_encoder.get(), enable_lossless));
    if (err) {
      throw err;
    }
  }

  inline void Encoder::set_integer_parameter(const std::string& parameter_name, int value)
  {
    Error err = Error(heif_encoder_set_parameter_integer(m_encoder.get(), parameter_name.c_str(), value));
    if (err) {
      throw err;
    }
  }

  inline int Encoder::get_integer_parameter(const std::string& parameter_name) const
  {
    int value;
    Error err = Error(heif_encoder_get_parameter_integer(m_encoder.get(), parameter_name.c_str(), &value));
    if (err) {
      throw err;
    }
    return value;
  }

  inline void Encoder::set_boolean_parameter(const std::string& parameter_name, bool value)
  {
    Error err = Error(heif_encoder_set_parameter_boolean(m_encoder.get(), parameter_name.c_str(), value));
    if (err) {
      throw err;
    }
  }

  inline bool Encoder::get_boolean_parameter(const std::string& parameter_name) const
  {
    int value;
    Error err = Error(heif_encoder_get_parameter_boolean(m_encoder.get(), parameter_name.c_str(), &value));
    if (err) {
      throw err;
    }
    return value;
  }

  inline void Encoder::set_string_parameter(const std::string& parameter_name, const std::string& value)
  {
    Error err = Error(heif_encoder_set_parameter_string(m_encoder.get(), parameter_name.c_str(), value.c_str()));
    if (err) {
      throw err;
    }
  }

  inline std::string Encoder::get_string_parameter(const std::string& parameter_name) const
  {
    const int max_size = 250;
    char value[max_size];
    Error err = Error(heif_encoder_get_parameter_string(m_encoder.get(), parameter_name.c_str(),
                                                        value, max_size));
    if (err) {
      throw err;
    }
    return value;
  }

  inline void Encoder::set_parameter(const std::string& parameter_name, const std::string& parameter_value)
  {
    Error err = Error(heif_encoder_set_parameter(m_encoder.get(), parameter_name.c_str(),
                                                 parameter_value.c_str()));
    if (err) {
      throw err;
    }
  }

  inline std::string Encoder::get_parameter(const std::string& parameter_name) const
  {
    const int max_size = 250;
    char value[max_size];
    Error err = Error(heif_encoder_get_parameter(m_encoder.get(), parameter_name.c_str(),
                                                 value, max_size));
    if (err) {
      throw err;
    }
    return value;
  }

  inline void Context::set_primary_image(ImageHandle& new_primary_image_handle)
  {
    Error err = Error(heif_context_set_primary_image(m_context.get(),
                                                     new_primary_image_handle.get_raw_image_handle()));
    if (err) {
      throw err;
    }
  }


  inline Context::EncodingOptions::EncodingOptions()
  {
    // TODO: this is a bit hacky. It would be better to have an API function to set
    // the options to default values. But I do not see any reason for that apart from
    // this use-case.

    struct heif_encoding_options* default_options = heif_encoding_options_alloc();
    *static_cast<heif_encoding_options*>(this) = *default_options; // copy over all options
    heif_encoding_options_free(default_options);
  }


  inline ImageHandle Context::encode_image(const Image& img, Encoder& encoder,
                                           const EncodingOptions& options)
  {
    struct heif_image_handle* image_handle;

    Error err = Error(heif_context_encode_image(m_context.get(),
                                                img.m_image.get(),
                                                encoder.m_encoder.get(),
                                                &options,
                                                &image_handle));
    if (err) {
      throw err;
    }

    return ImageHandle(image_handle);
  }


  inline ImageHandle Context::encode_thumbnail(const Image& image,
                                               const ImageHandle& master_image_handle,
                                               Encoder& encoder,
                                               const EncodingOptions& options,
                                               int bbox_size)
  {
    struct heif_image_handle* thumb_image_handle;

    Error err = Error(heif_context_encode_thumbnail(m_context.get(),
                                                    image.m_image.get(),
                                                    master_image_handle.get_raw_image_handle(),
                                                    encoder.m_encoder.get(),
                                                    &options,
                                                    bbox_size,
                                                    &thumb_image_handle));
    if (err) {
      throw err;
    }

    return ImageHandle(thumb_image_handle);
  }


  inline void Context::assign_thumbnail(const ImageHandle& thumbnail_image,
                                        const ImageHandle& master_image)
  {
    Error err = Error(heif_context_assign_thumbnail(m_context.get(),
                                                    thumbnail_image.get_raw_image_handle(),
                                                    master_image.get_raw_image_handle()));
    if (err) {
      throw err;
    }
  }

  inline void Context::add_exif_metadata(const ImageHandle& master_image,
                                         const void* data, int size)
  {
    Error err = Error(heif_context_add_exif_metadata(m_context.get(),
                                                     master_image.get_raw_image_handle(),
                                                     data, size));
    if (err) {
      throw err;
    }
  }

  inline void Context::add_XMP_metadata(const ImageHandle& master_image,
                                        const void* data, int size)
  {
    Error err = Error(heif_context_add_XMP_metadata(m_context.get(),
                                                    master_image.get_raw_image_handle(),
                                                    data, size));
    if (err) {
      throw err;
    }
  }
}


#endif
