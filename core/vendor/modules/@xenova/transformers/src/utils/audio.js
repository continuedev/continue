/**
 * @file Helper module for audio processing. 
 * 
 * These functions and classes are only used internally, 
 * meaning an end-user shouldn't need to access anything here.
 * 
 * @module utils/audio
 */

import {
    getFile,
} from './hub.js';
import { FFT, max } from './maths.js';
import {
    calculateReflectOffset,
} from './core.js';


/**
 * Helper function to read audio from a path/URL.
 * @param {string|URL} url The path/URL to load the audio from.
 * @param {number} sampling_rate The sampling rate to use when decoding the audio.
 * @returns {Promise<Float32Array>} The decoded audio as a `Float32Array`.
 */
export async function read_audio(url, sampling_rate) {
    if (typeof AudioContext === 'undefined') {
        // Running in node or an environment without AudioContext
        throw Error(
            "Unable to load audio from path/URL since `AudioContext` is not available in your environment. " +
            "Instead, audio data should be passed directly to the pipeline/processor. " +
            "For more information and some example code, see https://huggingface.co/docs/transformers.js/guides/node-audio-processing."
        )
    }

    const response = await (await getFile(url)).arrayBuffer();
    const audioCTX = new AudioContext({ sampleRate: sampling_rate });
    if (typeof sampling_rate === 'undefined') {
        console.warn(`No sampling rate provided, using default of ${audioCTX.sampleRate}Hz.`)
    }
    const decoded = await audioCTX.decodeAudioData(response);

    /** @type {Float32Array} */
    let audio;

    // We now replicate HuggingFace's `ffmpeg_read` method:
    if (decoded.numberOfChannels === 2) {
        // When downmixing a stereo audio file to mono using the -ac 1 option in FFmpeg,
        // the audio signal is summed across both channels to create a single mono channel.
        // However, if the audio is at full scale (i.e. the highest possible volume level),
        // the summing of the two channels can cause the audio signal to clip or distort.

        // To prevent this clipping, FFmpeg applies a scaling factor of 1/sqrt(2) (~ 0.707)
        // to the audio signal before summing the two channels. This scaling factor ensures
        // that the combined audio signal will not exceed the maximum possible level, even
        // if both channels are at full scale.

        // After applying this scaling factor, the audio signal from both channels is summed
        // to create a single mono channel. It's worth noting that this scaling factor is
        // only applied when downmixing stereo audio to mono using the -ac 1 option in FFmpeg.
        // If you're using a different downmixing method, or if you're not downmixing the
        // audio at all, this scaling factor may not be needed.
        const SCALING_FACTOR = Math.sqrt(2);

        const left = decoded.getChannelData(0);
        const right = decoded.getChannelData(1);

        audio = new Float32Array(left.length);
        for (let i = 0; i < decoded.length; ++i) {
            audio[i] = SCALING_FACTOR * (left[i] + right[i]) / 2;
        }

    } else {
        // If the audio is not stereo, we can just use the first channel:
        audio = decoded.getChannelData(0);
    }

    return audio;
}

/**
 * Generates a Hanning window of length M.
 *
 * @param {number} M The length of the Hanning window to generate.
 * @returns {Float64Array} The generated Hanning window.
 */
export function hanning(M) {
    if (M < 1) {
        return new Float64Array();
    }
    if (M === 1) {
        return new Float64Array([1]);
    }
    const denom = M - 1;
    const factor = Math.PI / denom;
    const cos_vals = new Float64Array(M);
    for (let i = 0; i < M; ++i) {
        const n = 2 * i - denom;
        cos_vals[i] = 0.5 + 0.5 * Math.cos(factor * n);
    }
    return cos_vals;
}

const HERTZ_TO_MEL_MAPPING = {
    "htk": (/** @type {number} */ freq) => 2595.0 * Math.log10(1.0 + (freq / 700.0)),
    "kaldi": (/** @type {number} */ freq) => 1127.0 * Math.log(1.0 + (freq / 700.0)),
    "slaney": (/** @type {number} */ freq, min_log_hertz = 1000.0, min_log_mel = 15.0, logstep = 27.0 / Math.log(6.4)) =>
        freq >= min_log_hertz
            ? min_log_mel + Math.log(freq / min_log_hertz) * logstep
            : 3.0 * freq / 200.0,
}

/**
 * @template {Float32Array|Float64Array|number} T 
 * @param {T} freq 
 * @param {string} [mel_scale]
 * @returns {T}
 */
function hertz_to_mel(freq, mel_scale = "htk") {
    const fn = HERTZ_TO_MEL_MAPPING[mel_scale];
    if (!fn) {
        throw new Error('mel_scale should be one of "htk", "slaney" or "kaldi".');
    }

    return typeof freq === 'number' ? fn(freq) : freq.map(x => fn(x));
}

const MEL_TO_HERTZ_MAPPING = {
    "htk": (/** @type {number} */ mels) => 700.0 * (10.0 ** (mels / 2595.0) - 1.0),
    "kaldi": (/** @type {number} */ mels) => 700.0 * (Math.exp(mels / 1127.0) - 1.0),
    "slaney": (/** @type {number} */ mels, min_log_hertz = 1000.0, min_log_mel = 15.0, logstep = Math.log(6.4) / 27.0) => mels >= min_log_mel
        ? min_log_hertz * Math.exp(logstep * (mels - min_log_mel))
        : 200.0 * mels / 3.0,
}

/**
 * @template {Float32Array|Float64Array|number} T 
 * @param {T} mels 
 * @param {string} [mel_scale]
 * @returns {T}
 */
function mel_to_hertz(mels, mel_scale = "htk") {
    const fn = MEL_TO_HERTZ_MAPPING[mel_scale];
    if (!fn) {
        throw new Error('mel_scale should be one of "htk", "slaney" or "kaldi".');
    }

    return typeof mels === 'number' ? fn(mels) : mels.map(x => fn(x));
}

/**
* Creates a triangular filter bank.
*
* Adapted from torchaudio and librosa.
*
* @param {Float64Array} fft_freqs Discrete frequencies of the FFT bins in Hz, of shape `(num_frequency_bins,)`.
* @param {Float64Array} filter_freqs Center frequencies of the triangular filters to create, in Hz, of shape `(num_mel_filters,)`.
* @returns {number[][]} of shape `(num_frequency_bins, num_mel_filters)`.
*/
function _create_triangular_filter_bank(fft_freqs, filter_freqs) {
    const filter_diff = Float64Array.from(
        { length: filter_freqs.length - 1 },
        (_, i) => filter_freqs[i + 1] - filter_freqs[i]
    );

    const slopes = Array.from({
        length: fft_freqs.length
    }, () => new Array(filter_freqs.length));

    for (let j = 0; j < fft_freqs.length; ++j) {
        const slope = slopes[j];
        for (let i = 0; i < filter_freqs.length; ++i) {
            slope[i] = filter_freqs[i] - fft_freqs[j];
        }
    }

    const numFreqs = filter_freqs.length - 2;
    const ret = Array.from({ length: numFreqs }, () => new Array(fft_freqs.length));

    for (let j = 0; j < fft_freqs.length; ++j) { // 201
        const slope = slopes[j];
        for (let i = 0; i < numFreqs; ++i) { // 80
            const down = -slope[i] / filter_diff[i];
            const up = slope[i + 2] / filter_diff[i + 1];
            ret[i][j] = Math.max(0, Math.min(down, up));
        }
    }
    return ret;
}

/**
 * Return evenly spaced numbers over a specified interval.
 * @param {number} start The starting value of the sequence.
 * @param {number} end The end value of the sequence.
 * @param {number} num Number of samples to generate.
 * @returns `num` evenly spaced samples, calculated over the interval `[start, stop]`.
 */
function linspace(start, end, num) {
    const step = (end - start) / (num - 1);
    return Float64Array.from({ length: num }, (_, i) => start + step * i);
}

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
    num_frequency_bins,
    num_mel_filters,
    min_frequency,
    max_frequency,
    sampling_rate,
    norm = null,
    mel_scale = "htk",
    triangularize_in_mel_space = false,
) {
    if (norm !== null && norm !== "slaney") {
        throw new Error('norm must be one of null or "slaney"');
    }

    const mel_min = hertz_to_mel(min_frequency, mel_scale);
    const mel_max = hertz_to_mel(max_frequency, mel_scale);
    const mel_freqs = linspace(mel_min, mel_max, num_mel_filters + 2);

    let filter_freqs = mel_to_hertz(mel_freqs, mel_scale);
    let fft_freqs; // frequencies of FFT bins in Hz

    if (triangularize_in_mel_space) {
        const fft_bin_width = sampling_rate / (num_frequency_bins * 2);
        fft_freqs = hertz_to_mel(Float64Array.from({ length: num_frequency_bins }, (_, i) => i * fft_bin_width), mel_scale);
        filter_freqs = mel_freqs;
    } else {
        fft_freqs = linspace(0, Math.floor(sampling_rate / 2), num_frequency_bins);
    }

    const mel_filters = _create_triangular_filter_bank(fft_freqs, filter_freqs);

    if (norm !== null && norm === "slaney") {
        // Slaney-style mel is scaled to be approx constant energy per channel
        for (let i = 0; i < num_mel_filters; ++i) {
            const filter = mel_filters[i];
            const enorm = 2.0 / (filter_freqs[i + 2] - filter_freqs[i]);
            for (let j = 0; j < num_frequency_bins; ++j) {
                // Apply this enorm to all frequency bins
                filter[j] *= enorm;
            }
        }
    }

    // TODO warn if there is a zero row

    return mel_filters;

}

/**
 * @template {Float32Array|Float64Array} T
 * Pads an array with a reflected version of itself on both ends.
 * @param {T} array The array to pad.
 * @param {number} left The amount of padding to add to the left.
 * @param {number} right The amount of padding to add to the right.
 * @returns {T} The padded array.
 */
function padReflect(array, left, right) {
    // @ts-ignore
    const padded = new array.constructor(array.length + left + right);
    const w = array.length - 1;

    for (let i = 0; i < array.length; ++i) {
        padded[left + i] = array[i];
    }

    for (let i = 1; i <= left; ++i) {
        padded[left - i] = array[calculateReflectOffset(i, w)];
    }

    for (let i = 1; i <= right; ++i) {
        padded[w + left + i] = array[calculateReflectOffset(w - i, w)];
    }

    return padded;
}

/**
 * Helper function to compute `amplitude_to_db` and `power_to_db`.
 * @template {Float32Array|Float64Array} T
 * @param {T} spectrogram 
 * @param {number} factor 
 * @param {number} reference 
 * @param {number} min_value 
 * @param {number} db_range 
 * @returns {T}
 */
function _db_conversion_helper(spectrogram, factor, reference, min_value, db_range) {
    if (reference <= 0) {
        throw new Error('reference must be greater than zero');
    }

    if (min_value <= 0) {
        throw new Error('min_value must be greater than zero');
    }

    reference = Math.max(min_value, reference);

    const logReference = Math.log10(reference);
    for (let i = 0; i < spectrogram.length; ++i) {
        spectrogram[i] = factor * Math.log10(Math.max(min_value, spectrogram[i]) - logReference)
    }

    if (db_range !== null) {
        if (db_range <= 0) {
            throw new Error('db_range must be greater than zero');
        }
        const maxValue = max(spectrogram)[0] - db_range;
        for (let i = 0; i < spectrogram.length; ++i) {
            spectrogram[i] = Math.max(spectrogram[i], maxValue);
        }
    }

    return spectrogram;
}

/**
 * Converts an amplitude spectrogram to the decibel scale. This computes `20 * log10(spectrogram / reference)`,
 * using basic logarithm properties for numerical stability. NOTE: Operates in-place.
 * 
 * The motivation behind applying the log function on the (mel) spectrogram is that humans do not hear loudness on a
 * linear scale. Generally to double the perceived volume of a sound we need to put 8 times as much energy into it.
 * This means that large variations in energy may not sound all that different if the sound is loud to begin with.
 * This compression operation makes the (mel) spectrogram features match more closely what humans actually hear.
 * 
 * @template {Float32Array|Float64Array} T
 * @param {T} spectrogram The input amplitude (mel) spectrogram.
 * @param {number} [reference=1.0] Sets the input spectrogram value that corresponds to 0 dB.
 * For example, use `np.max(spectrogram)` to set the loudest part to 0 dB. Must be greater than zero.
 * @param {number} [min_value=1e-5] The spectrogram will be clipped to this minimum value before conversion to decibels,
 * to avoid taking `log(0)`. The default of `1e-5` corresponds to a minimum of -100 dB. Must be greater than zero.
 * @param {number} [db_range=null] Sets the maximum dynamic range in decibels. For example, if `db_range = 80`, the
 * difference between the peak value and the smallest value will never be more than 80 dB. Must be greater than zero.
 * @returns {T} The modified spectrogram in decibels.
 */
function amplitude_to_db(spectrogram, reference = 1.0, min_value = 1e-5, db_range = null) {
    return _db_conversion_helper(spectrogram, 20.0, reference, min_value, db_range);
}

/**
 * Converts a power spectrogram to the decibel scale. This computes `10 * log10(spectrogram / reference)`,
 * using basic logarithm properties for numerical stability. NOTE: Operates in-place.
 * 
 * The motivation behind applying the log function on the (mel) spectrogram is that humans do not hear loudness on a
 * linear scale. Generally to double the perceived volume of a sound we need to put 8 times as much energy into it.
 * This means that large variations in energy may not sound all that different if the sound is loud to begin with.
 * This compression operation makes the (mel) spectrogram features match more closely what humans actually hear.
 * 
 * Based on the implementation of `librosa.power_to_db`.
 * 
 * @template {Float32Array|Float64Array} T
 * @param {T} spectrogram The input power (mel) spectrogram. Note that a power spectrogram has the amplitudes squared!
 * @param {number} [reference=1.0] Sets the input spectrogram value that corresponds to 0 dB.
 * For example, use `np.max(spectrogram)` to set the loudest part to 0 dB. Must be greater than zero.
 * @param {number} [min_value=1e-10] The spectrogram will be clipped to this minimum value before conversion to decibels,
 * to avoid taking `log(0)`. The default of `1e-10` corresponds to a minimum of -100 dB. Must be greater than zero.
 * @param {number} [db_range=null] Sets the maximum dynamic range in decibels. For example, if `db_range = 80`, the
 * difference between the peak value and the smallest value will never be more than 80 dB. Must be greater than zero.
 * @returns {T} The modified spectrogram in decibels.
 */
function power_to_db(spectrogram, reference = 1.0, min_value = 1e-10, db_range = null) {
    return _db_conversion_helper(spectrogram, 10.0, reference, min_value, db_range);
}

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
    waveform,
    window,
    frame_length,
    hop_length,
    {
        fft_length = null,
        power = 1.0,
        center = true,
        pad_mode = "reflect",
        onesided = true,
        preemphasis = null,
        mel_filters = null,
        mel_floor = 1e-10,
        log_mel = null,
        reference = 1.0,
        min_value = 1e-10,
        db_range = null,
        remove_dc_offset = null,

        // Custom parameters for efficiency reasons
        max_num_frames = null,
        do_pad = true,
        transpose = false,
    } = {}
) {
    const window_length = window.length;
    if (fft_length === null) {
        fft_length = frame_length;
    }
    if (frame_length > fft_length) {
        throw Error(`frame_length (${frame_length}) may not be larger than fft_length (${fft_length})`)
    }

    if (window_length !== frame_length) {
        throw new Error(`Length of the window (${window_length}) must equal frame_length (${frame_length})`);
    }

    if (hop_length <= 0) {
        throw new Error("hop_length must be greater than zero");
    }

    if (center) {
        if (pad_mode !== 'reflect') {
            throw new Error(`pad_mode="${pad_mode}" not implemented yet.`)
        }
        const half_window = Math.floor((fft_length - 1) / 2) + 1;
        waveform = padReflect(waveform, half_window, half_window);
    }

    // split waveform into frames of frame_length size
    const num_frames = Math.floor(1 + Math.floor((waveform.length - frame_length) / hop_length))

    const num_frequency_bins = onesided ? Math.floor(fft_length / 2) + 1 : fft_length

    let d1 = num_frames;
    let d1Max = num_frames;

    // If maximum number of frames is provided, we must either pad or truncate
    if (max_num_frames !== null) {
        if (max_num_frames > num_frames) { // input is too short, so we pad
            if (do_pad) {
                d1Max = max_num_frames;
            }
        } else { // input is too long, so we truncate
            d1Max = d1 = max_num_frames;
        }
    }

    // Preallocate arrays to store output.
    const fft = new FFT(fft_length);
    const inputBuffer = new Float64Array(fft_length);
    const outputBuffer = new Float64Array(fft.outputBufferSize);
    const magnitudes = new Array(d1);

    for (let i = 0; i < d1; ++i) {
        // Populate buffer with waveform data
        const offset = i * hop_length;
        for (let j = 0; j < frame_length; ++j) {
            inputBuffer[j] = waveform[offset + j];
        }

        if (remove_dc_offset) {
            let sum = 0;
            for (let j = 0; j < frame_length; ++j) {
                sum += inputBuffer[j];
            }
            const mean = sum / frame_length;
            for (let j = 0; j < frame_length; ++j) {
                inputBuffer[j] -= mean;
            }
        }

        if (preemphasis !== null) {
            // Done in reverse to avoid copies and distructive modification
            for (let j = frame_length - 1; j >= 1; --j) {
                inputBuffer[j] -= preemphasis * inputBuffer[j - 1];
            }
            inputBuffer[0] *= 1 - preemphasis;
        }

        for (let j = 0; j < window.length; ++j) {
            inputBuffer[j] *= window[j];
        }

        fft.realTransform(outputBuffer, inputBuffer);

        // compute magnitudes
        const row = new Array(num_frequency_bins);
        for (let j = 0; j < row.length; ++j) {
            const j2 = j << 1;
            row[j] = outputBuffer[j2] ** 2 + outputBuffer[j2 + 1] ** 2;
        }
        magnitudes[i] = row;
    }

    // TODO what should happen if power is None?
    // https://github.com/huggingface/transformers/issues/27772
    if (power !== null && power !== 2) {
        // slight optimization to not sqrt
        const pow = 2 / power; // we use 2 since we already squared
        for (let i = 0; i < magnitudes.length; ++i) {
            const magnitude = magnitudes[i];
            for (let j = 0; j < magnitude.length; ++j) {
                magnitude[j] **= pow;
            }
        }
    }

    // TODO: What if `mel_filters` is null?
    const num_mel_filters = mel_filters.length;

    // Only here do we create Float32Array
    const mel_spec = new Float32Array(num_mel_filters * d1Max);

    // Perform matrix muliplication:
    // mel_spec = mel_filters @ magnitudes.T
    //  - mel_filters.shape=(80, 201)
    //  - magnitudes.shape=(3000, 201) => - magnitudes.T.shape=(201, 3000)
    //  - mel_spec.shape=(80, 3000)
    const dims = transpose ? [d1Max, num_mel_filters] : [num_mel_filters, d1Max];
    for (let i = 0; i < num_mel_filters; ++i) { // num melfilters (e.g., 80)
        const filter = mel_filters[i];
        for (let j = 0; j < d1; ++j) { // num frames (e.g., 3000)
            const magnitude = magnitudes[j];

            let sum = 0;
            for (let k = 0; k < num_frequency_bins; ++k) { // num frequency bins (e.g., 201)
                sum += filter[k] * magnitude[k];
            }

            mel_spec[
                transpose
                    ? j * num_mel_filters + i
                    : i * d1 + j
            ] = Math.max(mel_floor, sum);
        }
    }

    if (power !== null && log_mel !== null) {
        const o = Math.min(mel_spec.length, d1 * num_mel_filters);
        switch (log_mel) {
            case 'log':
                for (let i = 0; i < o; ++i) {
                    mel_spec[i] = Math.log(mel_spec[i]);
                }
                break;
            case 'log10':
                for (let i = 0; i < o; ++i) {
                    mel_spec[i] = Math.log10(mel_spec[i]);
                }
                break;
            case 'dB':
                if (power === 1.0) {
                    // NOTE: operates in-place
                    amplitude_to_db(mel_spec, reference, min_value, db_range);
                } else if (power === 2.0) {
                    power_to_db(mel_spec, reference, min_value, db_range);
                } else {
                    throw new Error(`Cannot use log_mel option '${log_mel}' with power ${power}`)
                }
                break;
            default:
                throw new Error(`log_mel must be one of null, 'log', 'log10' or 'dB'. Got '${log_mel}'`);
        }
    }

    return { data: mel_spec, dims };
}

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
export function window_function(window_length, name, {
    periodic = true,
    frame_length = null,
    center = true,
} = {}) {
    const length = periodic ? window_length + 1 : window_length;
    let window;
    switch (name) {
        case 'boxcar':
            window = new Float64Array(length).fill(1.0);
            break;
        case 'hann':
        case 'hann_window':
            window = hanning(length);
            break;
        default:
            throw new Error(`Unknown window type ${name}.`);
    }
    if (periodic) {
        window = window.subarray(0, window_length);
    }
    if (frame_length === null) {
        return window;
    }
    if (window_length > frame_length) {
        throw new Error(`Length of the window (${window_length}) may not be larger than frame_length (${frame_length})`);
    }

    return window;
}
