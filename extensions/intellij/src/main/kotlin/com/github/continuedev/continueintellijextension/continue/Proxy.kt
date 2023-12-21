package com.github.continuedev.continueintellijextension.`continue`


import io.ktor.server.application.*
import io.ktor.http.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.plugins.cors.routing.*
import io.ktor.utils.io.jvm.javaio.*
import okhttp3.OkHttpClient
import okhttp3.Request
import org.apache.commons.io.IOUtils.byteArray
import java.io.ByteArrayOutputStream
import java.net.URL

fun startProxyServer() {
    embeddedServer(Netty, port = 65433, module = Application::proxyServer).start(wait = true)
}

fun Application.proxyServer() {
    install(CORS) {
        anyHost()
        allowCredentials = true
        allowNonSimpleContentTypes = true
        allowSameOrigin = true
        allowMethod(HttpMethod.Options)
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Delete)
        allowMethod(HttpMethod.Patch)
        allowHeader(HttpHeaders.ContentType)
        allowHeader(HttpHeaders.Authorization)
        allowHeader(HttpHeaders.AccessControlAllowOrigin)
        allowHeader("x-continue-url")

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
        val client = OkHttpClient()

        val requestBody = body?.let { okhttp3.RequestBody.create(null, it) }
        val headers = okhttp3.Headers.Builder()
        for (header in originalRequest.headers.entries()) {
            if (header.key != HttpHeaders.Host && header.key != HttpHeaders.Origin) {
                headers.add(header.key, header.value.joinToString(","))
            }
        }
        headers.add(HttpHeaders.Host, parsedUrl.host)

        val requestBuilder = Request.Builder()
                .url(continueUrl)
                .method(originalRequest.httpMethod.value, requestBody)
                .headers(headers.build())

        val response = client.newCall(requestBuilder.build()).execute()

        val ktorHeaders = Headers.build {
            response.headers.forEach { h ->
                appendAll(h.first, listOf(h.second))
            }
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