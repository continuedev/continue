package com.github.continuedev.continueintellijextension.browser

import com.intellij.openapi.project.DumbAware
import org.cef.browser.CefBrowser
import org.cef.browser.CefFrame
import org.cef.callback.CefCallback
import org.cef.callback.CefSchemeHandlerFactory
import org.cef.handler.CefLoadHandler
import org.cef.handler.CefResourceHandler
import org.cef.misc.IntRef
import org.cef.misc.StringRef
import org.cef.network.CefRequest
import org.cef.network.CefResponse
import java.io.IOException
import java.io.InputStream
import java.net.URLConnection

class CustomSchemeHandlerFactory : CefSchemeHandlerFactory {
    override fun create(
        browser: CefBrowser?,
        frame: CefFrame?,
        schemeName: String,
        request: CefRequest
    ): CefResourceHandler {
        return CustomResourceHandler()
    }
}

class CustomResourceHandler : CefResourceHandler, DumbAware {
    private var state: ResourceHandlerState = ClosedConnection
    private var currentUrl: String? = null
    override fun processRequest(
        cefRequest: CefRequest,
        cefCallback: CefCallback
    ): Boolean {
        val url = cefRequest.url
        return if (url != null) {
            val pathToResource = url.replace("http://continue", "webview/").replace("http://localhost:5173", "webview/")
            val newUrl = javaClass.classLoader.getResource(pathToResource)
            state = OpenedConnection(newUrl?.openConnection())
            currentUrl = url
            cefCallback.Continue()
            true
        } else {
            false
        }
    }

    override fun getResponseHeaders(
        cefResponse: CefResponse,
        responseLength: IntRef,
        redirectUrl: StringRef
    ) {
        if (currentUrl !== null) {
            when {
                currentUrl!!.contains("css") -> cefResponse.mimeType = "text/css"
                currentUrl!!.contains("js") -> cefResponse.mimeType = "text/javascript"
                currentUrl!!.contains("html") -> cefResponse.mimeType = "text/html"
                else -> {}
            }
        }

        state.getResponseHeaders(cefResponse, responseLength, redirectUrl)
    }

    override fun readResponse(
        dataOut: ByteArray,
        bytesToRead: Int,
        bytesRead: IntRef,
        callback: CefCallback
    ): Boolean {
        return state.readResponse(dataOut, bytesToRead, bytesRead, callback)
    }

    override fun cancel() {
        state.close()
        state = ClosedConnection
    }
}

sealed class ResourceHandlerState {
    open fun getResponseHeaders(
        cefResponse: CefResponse,
        responseLength: IntRef,
        redirectUrl: StringRef
    ) {
    }

    open fun readResponse(
        dataOut: ByteArray,
        bytesToRead: Int,
        bytesRead: IntRef,
        callback: CefCallback
    ): Boolean = false

    open fun close() {}
}


class OpenedConnection(private val connection: URLConnection?) :
    ResourceHandlerState() {

    private val inputStream: InputStream? by lazy {
        connection?.inputStream
    }

    override fun getResponseHeaders(
        cefResponse: CefResponse,
        responseLength: IntRef,
        redirectUrl: StringRef
    ) {
        try {
            if (connection != null) {
                val fullUrl = connection.url.toString()
                // Extract only the resource path after the JAR prefix to prevent incorrect mime type matching
                // (e.g., if a user's home folder contains "js" in the path)
                val url = fullUrl.substringAfterLast("jar!/", fullUrl)
                when {
                    url.contains("css") -> cefResponse.mimeType = "text/css"
                    url.contains("js") -> cefResponse.mimeType = "text/javascript"
                    url.contains("html") -> cefResponse.mimeType = "text/html"
                    else -> cefResponse.mimeType = connection.contentType
                }
                responseLength.set(inputStream?.available() ?: 0)
                cefResponse.status = 200
            } else {
                // Handle the case where connection is null
                cefResponse.error = CefLoadHandler.ErrorCode.ERR_FAILED
                cefResponse.statusText = "Connection is null"
                cefResponse.status = 500
            }
        } catch (e: IOException) {
            cefResponse.error = CefLoadHandler.ErrorCode.ERR_FILE_NOT_FOUND
            cefResponse.statusText = e.localizedMessage
            cefResponse.status = 404
        }
    }


    override fun readResponse(
        dataOut: ByteArray,
        bytesToRead: Int,
        bytesRead: IntRef,
        callback: CefCallback
    ): Boolean {
        return inputStream?.let { inputStream ->
            val availableSize = inputStream.available()
            return if (availableSize > 0) {
                val maxBytesToRead = minOf(availableSize, bytesToRead)
                val realBytesRead = inputStream.read(dataOut, 0, maxBytesToRead)
                bytesRead.set(realBytesRead)
                true
            } else {
                inputStream.close()
                false
            }
        } ?: false
    }

    override fun close() {
        inputStream?.close()
    }
}

object ClosedConnection : ResourceHandlerState() {
    override fun getResponseHeaders(
        cefResponse: CefResponse,
        responseLength: IntRef,
        redirectUrl: StringRef
    ) {
        cefResponse.status = 404
    }
}
