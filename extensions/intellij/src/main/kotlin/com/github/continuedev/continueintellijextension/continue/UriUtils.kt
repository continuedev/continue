package com.github.continuedev.continueintellijextension.`continue`

import java.io.File
import java.net.URI

/**
 * Utility class for URI operations.
 *
 * Provides methods for parsing URI strings and converting them to File objects,
 * with special handling for Windows file paths, WSL paths, and unencoded URIs
 * that may contain spaces or other special characters in the path component.
 */
object UriUtils {
    /**
     * Parses a URI string into a URI object, handling special cases for Windows
     * file paths and unencoded URIs (e.g. paths containing spaces).
     *
     * @param uri The URI string to parse
     * @return A properly parsed URI object
     * @throws Exception if the URI cannot be parsed
     */
    fun parseUri(uri: String): URI {
        // Remove query parameters if present
        val noParams = uri.substringBefore("?")

        // Normalize Windows file paths with authority component, so that the path
        // is percent-decoded by URI just like for authority-less file URIs
        val uriStr = if (noParams.startsWith("file://") && !noParams.startsWith("file:///"))
            "file:///" + noParams.removePrefix("file://")
        else
            noParams

        return try {
            URI(uriStr)
        } catch (e: Exception) {
            // Handle unencoded file URIs (e.g. spaces in path from VirtualFile.toUriOrNull())
            if (uriStr.startsWith("file:///")) {
                URI("file", "", uriStr.removePrefix("file://"), null)
            } else {
                throw Exception("Invalid URI: $uri ${e.message}")
            }
        }
    }

    /**
     * Converts a URI string to a File object by first parsing the URI
     * and then constructing a File from the parsed result.
     *
     * @param uri The URI string to convert to a file path
     * @return A File object representing the path from the URI
     */
    fun uriToFile(uri: String): File {
        val parsedUri = parseUri(uri)
        return File(parsedUri)
    }

    /**
     * Converts a URI string to a filesystem path with forward slashes, the
     * format expected by the IntelliJ virtual file system.
     *
     * @param uri The URI string to convert to a file path
     * @return A percent-decoded path, e.g. "C:/My Project/file.txt"
     */
    fun uriToPath(uri: String): String =
        uriToFile(uri).path.replace('\\', '/')
}