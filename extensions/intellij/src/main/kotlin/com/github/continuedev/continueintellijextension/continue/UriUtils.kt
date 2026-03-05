package com.github.continuedev.continueintellijextension.`continue`

import java.io.File
import java.net.URI
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

/**
 * Utility class for URI operations
 */
object UriUtils {
    /**
     * Parses a URI string into a URI object, handling special cases for Windows file paths
     */
    fun parseUri(uri: String): URI {
        try {
            // Remove query parameters if present
            val uriStr = uri.substringBefore("?")

            if (uriStr.startsWith("file://")) {
                val normalizedFileUri = normalizeWindowsFileUri(uriStr)
                val encodedPath = normalizeAndEncodeFilePath(normalizedFileUri.substringAfter("file://"))
                return URI("file", "", encodedPath, null)
            }

            // Standard URI handling for other cases
            return URI(uriStr)
        } catch (e: Exception) {
            println("Error parsing URI: $uri ${e.message}")
            throw Exception("Invalid URI: $uri ${e.message}")
        }
    }

    private fun normalizeWindowsFileUri(uri: String): String {
        if (uri.startsWith("file://") && !uri.startsWith("file:///")) {
            val path = uri.substringAfter("file://")
            return "file:///$path"
        }
        return uri
    }

    private fun normalizeAndEncodeFilePath(rawPath: String): String {
        val decodedPath = URLDecoder.decode(rawPath.replace("+", "%2B"), StandardCharsets.UTF_8)
        return if (decodedPath.startsWith("/")) decodedPath else "/$decodedPath"
    }

    /**
     * Converts a URI string to a File object
     */
    fun uriToFile(uri: String): File {
        return File(parseUri(uri))
    }
}