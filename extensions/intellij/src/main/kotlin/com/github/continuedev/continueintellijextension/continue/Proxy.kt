package com.github.continuedev.continueintellijextension.`continue`


import io.ktor.server.application.*
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.cors.routing.*
import io.ktor.util.*
import io.ktor.utils.io.jvm.javaio.*
import kotlinx.coroutines.withTimeout
import okhttp3.OkHttpClient
import okhttp3.Request
import org.apache.commons.io.IOUtils.byteArray
import java.io.ByteArrayOutputStream
import java.net.URL

fun startProxyServer() {
    embeddedServer(Netty, port = 65433, module = Application::proxyServer, configure = {
        responseWriteTimeoutSeconds = 7200
    }).start(wait = true)
}

fun Application.proxyServer() {
    install(CORS) {
        anyHost()

        allowCredentials = true
        allowNonSimpleContentTypes = true

        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowMethod(HttpMethod.Patch)

        allowHeaders {
            true
        }

        allowOrigins { origin ->
           true
        }
    }

    intercept(ApplicationCallPipeline.Call) {
        val originalRequest = call.request

        // Don't intercept CORS pre-flight requests
        if (originalRequest.httpMethod == HttpMethod.Options) {
            return@intercept;
        }

        val continueUrl = originalRequest.headers["x-continue-url"] ?: return@intercept call.respond(HttpStatusCode.OK)
        val parsedUrl = URL(continueUrl)
        val body = originalRequest.receiveChannel().toInputStream().use { inputStream ->
            if (inputStream == null) {
                return@use null;
            }
            val buffer = byteArray(4096) // size of the buffer can be adjusted as needed
            val outputStream = ByteArrayOutputStream()
            while (true) {
                val bytesRead = inputStream.read(buffer)
                if (bytesRead == -1) {
                    break
                }
                outputStream.write(buffer, 0, bytesRead)
            }
            outputStream.toByteArray()
        }

        // Create OkHttpClient instance
        val client = OkHttpClient.Builder()
                .callTimeout(7200, java.util.concurrent.TimeUnit.SECONDS)
                .connectTimeout(7200, java.util.concurrent.TimeUnit.SECONDS)
                .readTimeout(7200, java.util.concurrent.TimeUnit.SECONDS)
                .build()

        val requestBody = body?.let { okhttp3.RequestBody.create(null, it) }
        val okhttpHeaders = okhttp3.Headers.Builder()
        for (header in originalRequest.headers.entries()) {
            if (header.key != HttpHeaders.Host && header.key != HttpHeaders.Origin) {
                okhttpHeaders.add(header.key, header.value.joinToString(","))
            }
        }
        okhttpHeaders.add(HttpHeaders.Host, parsedUrl.host)

        val requestBuilder = Request.Builder()
                .url(continueUrl)
                .method(originalRequest.httpMethod.value, requestBody)
                .headers(okhttpHeaders.build())

        val response = client.newCall(requestBuilder.build()).execute()

        // Set the response headers
        response.headers.forEach { h ->
            if (h.first.lowercase() == HttpHeaders.TransferEncoding.lowercase() || h.first.lowercase() == HttpHeaders.AccessControlAllowOrigin.lowercase()) {
                return@forEach
            }
            call.response.header(h.first, h.second)
        }

        call.respondOutputStream(ContentType.parse(response.header("Content-Type") ?: "text/plain"), HttpStatusCode(response.code, response.message)) {
            response.body?.byteStream()?.use { inputStream ->
                if (inputStream == null) {
                    return@use;
                }
                val buffer = byteArray(4096) // size of the buffer can be adjusted as needed
                while (true) {
                    val bytesRead = inputStream.read(buffer)
                    if (bytesRead == -1) {
                        break
                    }
                    write(buffer, 0, bytesRead)
                    flush()
                }
            }
        }
    }
}