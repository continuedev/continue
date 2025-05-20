package com.github.continuedev.continueintellijextension.`continue`

import java.io.File
import java.net.URI

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

            // Handle Windows file paths with authority component
            if (uriStr.startsWith("file://") && !uriStr.startsWith("file:///")) {
                val path = uriStr.substringAfter("file://")
                return URI("file:///$path")
            }

            // Standard URI handling for other cases
            val uriWithoutQuery = URI(uriStr)
            return uriWithoutQuery
        } catch (e: Exception) {
            println("Error parsing URI: $uri ${e.message}")
            throw Exception("Invalid URI: $uri ${e.message}")
        }
    }

    /**
     * Converts a URI string to a File object
     */
    fun uriToFile(uri: String): File {
        return File(parseUri(uri))
    }
}