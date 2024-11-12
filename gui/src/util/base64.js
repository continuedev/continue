class Base64 {
  b64 = "-_wR6OcdHIJQ7ijpfykT12UvKSPABClm89nozxeDE4FGVqrstuWXYZ5aN0LM3bgh";
  a256 = "";
  r64 = [256];
  r256 = [256];
  constructor() {
    let i = 0;
    while (i < 256) {
      var c = String.fromCharCode(i);
      this.a256 += c;
      this.r256[i] = i;
      this.r64[i] = this.b64.indexOf(c);
      ++i;
    }
  }
  code(s, discard, alpha, beta, w1, w2) {
    s = String(s);
    var buffer = 0,
      i = 0,
      length = s.length,
      result = "",
      bitsInBuffer = 0;

    while (i < length) {
      var c = s.charCodeAt(i);
      c = c < 256 ? alpha[c] : -1;

      buffer = (buffer << w1) + c;
      bitsInBuffer += w1;

      while (bitsInBuffer >= w2) {
        bitsInBuffer -= w2;
        var tmp = buffer >> bitsInBuffer;
        result += beta.charAt(tmp);
        buffer ^= tmp << bitsInBuffer;
      }
      ++i;
    }
    if (!discard && bitsInBuffer > 0)
      result += beta.charAt(buffer << (w2 - bitsInBuffer));
    return result;
  }
  encode(plain, utf8encode) {
    plain = utf8encode ? this.utf8encode(plain) : plain;
    plain = this.code(plain, false, this.r256, this.b64, 8, 6);
    return plain + "====".slice(plain.length % 4 || 4);
  }
  // public method for decoding
  decode(coded, utf8decode) {
    coded = String(coded).split("=");
    var i = coded.length;
    do {
      --i;
      coded[i] = this.code(coded[i], true, this.r64, this.a256, 6, 8);
    } while (i > 0);
    coded = coded.join("");
    return utf8decode ? this.utf8decode(coded) : coded;
  }

  // private method for UTF-8 encoding
  _utf8_encode(strUni) {
    var strUtf = strUni.replace(/[\u0080-\u07ff]/g, function (c) {
      var cc = c.charCodeAt(0);
      return String.fromCharCode(
        0xe0 | (cc >> 12),
        0x80 | ((cc >> 6) & 0x3f),
        0x80 | (cc & 0x3f)
      );
    }); // U+0080 - U+07FF => 2 bytes 110yyyyy, 10zzzzzz

    return strUtf;
  }

  // private method for UTF-8 decoding
  _utf8_decode(strUtf) {
    // note: decode 3-byte chars first as decoded 2-byte strings could appear to be 3-byte char!
    var strUni = strUtf
      .replace(
        /[\u00e0-\u00ef][\u0080-\u00bf][\u0080-\u00bf]/g, // 3-byte chars
        function (c) {
          // (note parentheses for precence)
          var cc =
            ((c.charCodeAt(0) & 0x0f) << 12) |
            ((c.charCodeAt(1) & 0x3f) << 6) |
            (c.charCodeAt(2) & 0x3f);
          return String.fromCharCode(cc);
        }
      )
      .replace(
        /[\u00c0-\u00df][\u0080-\u00bf]/g, // 2-byte chars
        function (c) {
          // (note parentheses for precence)
          var cc = ((c.charCodeAt(0) & 0x1f) << 6) | (c.charCodeAt(1) & 0x3f);
          return String.fromCharCode(cc);
        }
      );
    return strUni;
  }
}

export default new Base64();
