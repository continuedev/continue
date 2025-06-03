/**
 * Helper function to read audio from a path/URL.
 * @param {string|URL} url The path/URL to load the audio from.
 * @param {number} sampling_rate The sampling rate to use when decoding the audio.
 * @returns {Promise<Float32Array>} The decoded audio as a `Float32Array`.
 */
export function read_audio(
  url: string | URL,
  sampling_rate: number,
): Promise<Float32Array>;
/**
 * Generates a Hanning window of length M.
 *
 * @param {number} M The length of the Hanning window to generate.
 * @returns {Float64Array} The generated Hanning window.
 */
export function hanning(M: number): Float64Array;
/**
 * Creates a frequency bin conversion matrix used to obtain a mel spectrogram. This is called a *mel filter bank*, and
 * various implementation exist, which differ in the number of filters, the shape of the filters, the way the filters
 * are spaced, the bandwidth of the filters, and the manner in which the spectrum is warped. The goal of these
 * features is to approximate the non-linear human perception of the variation in pitch with respect to the frequency.
 * @param {number} num_frequency_bins Number of frequencies used to compute the spectrogram (should be the same as in `stft`).
 * @param {number} num_mel_filters Number of mel filters to generate.
 * @param {number} min_frequency Lowest frequency of interest in Hz.
 * @param {number} max_frequency Highest frequency of interest in Hz. This should not exceed `sampling_rate / 2`.
 * @param {number} sampling_rate Sample rate of the audio waveform.
 * @param {string} [norm] If `"slaney"`, divide the triangular mel weights by the width of the mel band (area normalization).
 * @param {string} [mel_scale] The mel frequency scale to use, `"htk"` or `"slaney"`.
 * @param {boolean} [triangularize_in_mel_space] If this option is enabled, the triangular filter is applied in mel space rather than frequency space.
 * This should be set to `true` in order to get the same results as `torchaudio` when computing mel filters.
 * @returns {number[][]} Triangular filter bank matrix, which is a 2D array of shape (`num_frequency_bins`, `num_mel_filters`).
 * This is a projection matrix to go from a spectrogram to a mel spectrogram.
 */
export function mel_filter_bank(
  num_frequency_bins: number,
  num_mel_filters: number,
  min_frequency: number,
  max_frequency: number,
  sampling_rate: number,
  norm?: string,
  mel_scale?: string,
  triangularize_in_mel_space?: boolean,
): number[][];
/**
 * Calculates a spectrogram over one waveform using the Short-Time Fourier Transform.
 *
 * This function can create the following kinds of spectrograms:
 *   - amplitude spectrogram (`power = 1.0`)
 *   - power spectrogram (`power = 2.0`)
 *   - complex-valued spectrogram (`power = None`)
 *   - log spectrogram (use `log_mel` argument)
 *   - mel spectrogram (provide `mel_filters`)
 *   - log-mel spectrogram (provide `mel_filters` and `log_mel`)
 *
 * In this implementation, the window is assumed to be zero-padded to have the same size as the analysis frame.
 * A padded window can be obtained from `window_function()`. The FFT input buffer may be larger than the analysis frame,
 * typically the next power of two.
 *
 * @param {Float32Array|Float64Array} waveform The input waveform of shape `(length,)`. This must be a single real-valued, mono waveform.
 * @param {Float32Array|Float64Array} window The windowing function to apply of shape `(frame_length,)`, including zero-padding if necessary. The actual window length may be
 * shorter than `frame_length`, but we're assuming the array has already been zero-padded.
 * @param {number} frame_length The length of the analysis frames in samples (a.k.a., `fft_length`).
 * @param {number} hop_length The stride between successive analysis frames in samples.
 * @param {Object} options
 * @param {number} [options.fft_length=null] The size of the FFT buffer in samples. This determines how many frequency bins the spectrogram will have.
 * For optimal speed, this should be a power of two. If `null`, uses `frame_length`.
 * @param {number} [options.power=1.0] If 1.0, returns the amplitude spectrogram. If 2.0, returns the power spectrogram. If `null`, returns complex numbers.
 * @param {boolean} [options.center=true] Whether to pad the waveform so that frame `t` is centered around time `t * hop_length`. If `false`, frame
 * `t` will start at time `t * hop_length`.
 * @param {string} [options.pad_mode="reflect"] Padding mode used when `center` is `true`. Possible values are: `"constant"` (pad with zeros),
 * `"edge"` (pad with edge values), `"reflect"` (pads with mirrored values).
 * @param {boolean} [options.onesided=true] If `true`, only computes the positive frequencies and returns a spectrogram containing `fft_length // 2 + 1`
 * frequency bins. If `false`, also computes the negative frequencies and returns `fft_length` frequency bins.
 * @param {number} [options.preemphasis=null] Coefficient for a low-pass filter that applies pre-emphasis before the DFT.
 * @param {number[][]} [options.mel_filters=null] The mel filter bank of shape `(num_freq_bins, num_mel_filters)`.
 * If supplied, applies this filter bank to create a mel spectrogram.
 * @param {number} [options.mel_floor=1e-10] Minimum value of mel frequency banks.
 * @param {string} [options.log_mel=null] How to convert the spectrogram to log scale. Possible options are:
 * `null` (don't convert), `"log"` (take the natural logarithm) `"log10"` (take the base-10 logarithm), `"dB"` (convert to decibels).
 * Can only be used when `power` is not `null`.
 * @param {number} [options.reference=1.0] Sets the input spectrogram value that corresponds to 0 dB. For example, use `max(spectrogram)[0]` to set
 * the loudest part to 0 dB. Must be greater than zero.
 * @param {number} [options.min_value=1e-10] The spectrogram will be clipped to this minimum value before conversion to decibels, to avoid taking `log(0)`.
 * For a power spectrogram, the default of `1e-10` corresponds to a minimum of -100 dB. For an amplitude spectrogram, the value `1e-5` corresponds to -100 dB.
 * Must be greater than zero.
 * @param {number} [options.db_range=null] Sets the maximum dynamic range in decibels. For example, if `db_range = 80`, the difference between the
 * peak value and the smallest value will never be more than 80 dB. Must be greater than zero.
 * @param {boolean} [options.remove_dc_offset=null] Subtract mean from waveform on each frame, applied before pre-emphasis. This should be set to `true` in
 * order to get the same results as `torchaudio.compliance.kaldi.fbank` when computing mel filters.
 * @param {number} [options.max_num_frames=null] If provided, limits the number of frames to compute to this value.
 * @param {boolean} [options.do_pad=true] If `true`, pads the output spectrogram to have `max_num_frames` frames.
 * @param {boolean} [options.transpose=false] If `true`, the returned spectrogram will have shape `(num_frames, num_frequency_bins/num_mel_filters)`. If `false`, the returned spectrogram will have shape `(num_frequency_bins/num_mel_filters, num_frames)`.
 * @returns {{data: Float32Array, dims: number[]}} Spectrogram of shape `(num_frequency_bins, length)` (regular spectrogram) or shape `(num_mel_filters, length)` (mel spectrogram).
 */
export function spectrogram(
  waveform: Float32Array | Float64Array,
  window: Float32Array | Float64Array,
  frame_length: number,
  hop_length: number,
  {
    fft_length,
    power,
    center,
    pad_mode,
    onesided,
    preemphasis,
    mel_filters,
    mel_floor,
    log_mel,
    reference,
    min_value,
    db_range,
    remove_dc_offset,
    max_num_frames,
    do_pad,
    transpose,
  }?: {
    fft_length?: number;
    power?: number;
    center?: boolean;
    pad_mode?: string;
    onesided?: boolean;
    preemphasis?: number;
    mel_filters?: number[][];
    mel_floor?: number;
    log_mel?: string;
    reference?: number;
    min_value?: number;
    db_range?: number;
    remove_dc_offset?: boolean;
    max_num_frames?: number;
    do_pad?: boolean;
    transpose?: boolean;
  },
): {
  data: Float32Array;
  dims: number[];
};
/**
 * Returns an array containing the specified window.
 * @param {number} window_length The length of the window in samples.
 * @param {string} name The name of the window function.
 * @param {Object} options Additional options.
 * @param {boolean} [options.periodic=true] Whether the window is periodic or symmetric.
 * @param {number} [options.frame_length=null] The length of the analysis frames in samples.
 * Provide a value for `frame_length` if the window is smaller than the frame length, so that it will be zero-padded.
 * @param {boolean} [options.center=true] Whether to center the window inside the FFT buffer. Only used when `frame_length` is provided.
 * @returns {Float64Array} The window of shape `(window_length,)` or `(frame_length,)`.
 */
export function window_function(
  window_length: number,
  name: string,
  {
    periodic,
    frame_length,
    center,
  }?: {
    periodic?: boolean;
    frame_length?: number;
    center?: boolean;
  },
): Float64Array;
//# sourceMappingURL=audio.d.ts.map
