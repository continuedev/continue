package com.github.continuedev.continueintellijextension.`continue`

//import io.ktor.client.*
//import io.ktor.client.statement.*
//import io.ktor.server.application.*
//import io.ktor.http.*
//import io.ktor.http.content.*
//import io.ktor.server.request.*
//import io.ktor.server.response.*
//import io.ktor.server.routing.*
//import io.ktor.server.engine.*
//import io.ktor.server.netty.*
//import io.ktor.utils.io.*
//import java.net.URL

//fun main() {
//    embeddedServer(Netty, port = 8080, module = Application::proxyServer).start(wait = true)
//}
//
//fun Application.proxyServer() {
//
//    routing {
//        route("/{...}") {
//            handle {
//                val originalRequest = call.request
//                val continueUrl = originalRequest.headers["x-continue-url"] ?: return@handle call.respond(HttpStatusCode.BadRequest)
//                val parsedUrl = URL(continueUrl)
//                val client = HttpClient()
//
//                try {
//                    val response: HttpResponse = client.request(continueUrl) {
//                        method = HttpMethod.parse(originalRequest.httpMethod.value)
//                        headers {
//                            originalRequest.headers.forEach { key, values ->
//                                if (key != HttpHeaders.Host && key != HttpHeaders.Origin) {
//                                    appendAll(key, values)
//                                }
//                            }
//                            append(HttpHeaders.Host, parsedUrl.host)
//                        }
//                    }
//                    call.respond(response.status, response.readBytes())
//                } catch (e: Exception) {
//                    application.log.error("Proxy error", e)
//                    call.respond(HttpStatusCode.InternalServerError)
//                }
//            }
//        }
//    }
//}

import io.ktor.server.application.*
import io.ktor.client.*
import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.util.*
import io.ktor.utils.io.*
import io.ktor.server.engine.embeddedServer
import io.ktor.server.netty.Netty
import io.ktor.server.routing.*
import kotlinx.coroutines.*
import java.net.URL

/**
 * Main entry point of the application. This application starts a webserver at port 8080 based on Netty.
 * It intercepts all the requests, reverse-proxying them to the wikipedia.
 *
 * In the case of HTML it is completely loaded in memory and preprocessed to change URLs to our own local domain.
 * In the case of other files, the file is streamed from the HTTP client to the HTTP server response.
 */
//fun startProxyServer() {
//    // Creates a Netty server
//    try {
//        val server = embeddedServer(Netty, port = 65433, module = Application::proxyServer)
//        // Starts the server and waits for the engine to stop and exits.
//        server.start(wait = true)
//    } catch (e: Exception) {
//        println(e)
//    }
//}


fun startProxyServer() {
    GlobalScope.launch {
        embeddedServer(Netty, port = 65433, module = Application::proxyServer).start(wait = true)
    }
}


@OptIn(InternalAPI::class)
fun Application.proxyServer() {

        routing {
            route("/{...}") {
                handle {
                    call.respond("Hello")
                }
            }
        }

//    intercept(ApplicationCallPipeline.Call) {
//
//        val originalRequest = call.request
//        val continueUrl = originalRequest.headers["x-continue-url"] ?: return@intercept call.respond(HttpStatusCode.BadRequest)
//        val parsedUrl = URL(continueUrl)
//        val client = HttpClient()
//
//        val response = client.request(continueUrl) {
//            method = HttpMethod.parse(originalRequest.httpMethod.value)
//            headers {
//                originalRequest.headers.forEach { key, values ->
//                    if (key != HttpHeaders.Host && key != HttpHeaders.Origin) {
//                        appendAll(key, values)
//                    }
//                }
//                append(HttpHeaders.Host, parsedUrl.host)
//            }
//        }
//
//        call.respond(object : OutgoingContent.WriteChannelContent() {
//            override val headers: Headers = response.headers;
//            override val status: HttpStatusCode = response.status
//            override suspend fun writeTo(channel: ByteWriteChannel) {
//                response.content.copyAndClose(channel)
//            }
//        })
//
//    }
}