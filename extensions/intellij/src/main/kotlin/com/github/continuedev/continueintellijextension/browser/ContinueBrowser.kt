package com.github.continuedev.continueintellijextension.browser

import com.github.continuedev.continueintellijextension.constants.MessageTypes
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.uuid
import com.google.gson.Gson
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Disposer
import com.intellij.ui.jcef.*
import org.cef.CefApp
import org.cef.browser.CefBrowser
import org.cef.handler.CefLoadHandlerAdapter
import kotlinx.coroutines.*
import java.lang.management.ManagementFactory
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import javax.swing.JComponent

class ContinueBrowser(private val project: Project): Disposable {

    private val log = Logger.getInstance(ContinueBrowser::class.java.simpleName)
    private val browser: JBCefBrowser = JBCefBrowser.createBuilder().setOffScreenRendering(false).build()
    private val myJSQueryOpenInBrowser = JBCefJSQuery.create(browser as JBCefBrowserBase)
    private val maintenanceExecutor: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor()
    private val memoryMonitorExecutor: ScheduledExecutorService = Executors.newSingleThreadScheduledExecutor()
    private var lastInteractionTime = System.currentTimeMillis()
    private var browserMemoryStats: BrowserMemoryStats? = null

    init {
        CefApp.getInstance().registerSchemeHandlerFactory("http", "continue", CustomSchemeHandlerFactory())
        browser.jbCefClient.setProperty(JBCefClient.Properties.JS_QUERY_POOL_SIZE, 200)
        myJSQueryOpenInBrowser.addHandler { msg: String? ->
            val json = Gson().fromJson(msg, BrowserMessage::class.java)
            val messageType = json.messageType
            val data = json.data
            val messageId = json.messageId
            
            // Handle memory usage reports from browser
            if (messageType == "memoryUsage" && messageId == "memory-monitor") {
                handleBrowserMemoryReport(data)
                return@addHandler null
            }

            if (MessageTypes.PASS_THROUGH_TO_CORE.contains(messageType)) {
                project.service<ContinuePluginService>().coreMessenger?.request(messageType, data, messageId) { data ->
                    sendToWebview(messageType, data, messageId ?: uuid())
                }
                return@addHandler null
            }

            // If not pass through, then put it in the status/content/done format for webview
            // Core already sends this format
            if (msg != null) {
                project.service<ContinuePluginService>().ideProtocolClient?.handleMessage(msg) { data ->
                    sendToWebview(
                        messageType,
                        mapOf(
                            "status" to "success",
                            "content" to data,
                            "done" to true
                        ),
                        messageId ?: uuid()
                    )
                }
            }

            null
        }

        browser.jbCefClient.addLoadHandler(OnPageLoad {
            executeJavaScript(myJSQueryOpenInBrowser)
        }, browser.cefBrowser)

        // Load the url only after the protocolClient is initialized,
        // otherwise some messages will be lost, which are some configurations when the page is loaded.
        // Moreover, we should add LoadHandler before loading the url.
        project.service<ContinuePluginService>().onProtocolClientInitialized {
            browser.loadURL(getGuiUrl())
        }

        browser.createImmediately()
        
        // Schedule periodic maintenance to prevent freezing during idle periods
        startMaintenanceScheduler()
        
        // Start memory monitoring
        startMemoryMonitoring()
    }

    fun getComponent(): JComponent =
        browser.component

    fun focusOnInput() {
        browser.component.components?.get(0)?.requestFocus()
    }

    fun openDevTools() {
        browser.openDevtools()
    }

    fun sendToWebview(messageType: String, data: Any? = null, messageId: String = uuid()) {
        updateLastInteractionTime()
        val json = Gson().toJson(BrowserMessage(messageType, messageId, data))
        val jsCode = """window.postMessage($json, "*");"""
        try {
            browser.executeJavaScriptAsync(jsCode)
        } catch (error: IllegalStateException) {
            log.warn(error)
        }
    }

    private fun executeJavaScript(myJSQueryOpenInBrowser: JBCefJSQuery) {
        val script = """
            window.postIntellijMessage = function(messageType, data, messageId) {
                const msg = JSON.stringify({messageType, data, messageId});
                ${myJSQueryOpenInBrowser.inject("msg")}
            }
            """
        browser.cefBrowser.executeJavaScript(script, getGuiUrl(), 0)
    }

    private fun updateLastInteractionTime() {
        lastInteractionTime = System.currentTimeMillis()
    }
    
    private fun startMaintenanceScheduler() {
        // Run maintenance every 30 minutes
        maintenanceExecutor.scheduleAtFixedRate({
            try {
                performMaintenance()
            } catch (e: Exception) {
                log.warn("Error during browser maintenance", e)
            }
        }, 30, 30, TimeUnit.MINUTES)
    }
    
    private fun startMemoryMonitoring() {
        // Log memory usage every 5 minutes
        memoryMonitorExecutor.scheduleAtFixedRate({
            try {
                logMemoryUsage()
            } catch (e: Exception) {
                log.warn("Error during memory monitoring", e)
            }
        }, 5, 5, TimeUnit.MINUTES)
    }
    
    private fun performMaintenance() {
        val idleTime = System.currentTimeMillis() - lastInteractionTime
        val oneHour = 60 * 60 * 1000L
        
        // If idle for more than 1 hour, perform maintenance
        if (idleTime > oneHour) {
            log.info("Performing browser maintenance after ${idleTime / 1000 / 60} minutes of idle time")
            
            // Log memory before maintenance
            logMemoryUsage("Before maintenance")
            
            // Force garbage collection in the browser
            try {
                browser.executeJavaScriptAsync(
                    """if (window.gc) { window.gc(); } else if (window.webkitGC) { window.webkitGC(); }"""
                )
            } catch (e: Exception) {
                log.warn("Could not trigger browser GC", e)
            }
            
            // Clear any accumulated message queues
            browser.jbCefClient.setProperty(JBCefClient.Properties.JS_QUERY_POOL_SIZE, 200)
            
            // Log memory after maintenance (with delay to allow GC)
            maintenanceExecutor.schedule({
                logMemoryUsage("After maintenance")
            }, 5, TimeUnit.SECONDS)
        }
    }
    
    private fun logMemoryUsage(context: String = "Periodic check") {
        // JVM Memory Usage
        val runtime = Runtime.getRuntime()
        val maxMemory = runtime.maxMemory()
        val totalMemory = runtime.totalMemory()
        val freeMemory = runtime.freeMemory()
        val usedMemory = totalMemory - freeMemory
        
        val memoryBean = ManagementFactory.getMemoryMXBean()
        val heapUsage = memoryBean.heapMemoryUsage
        val nonHeapUsage = memoryBean.nonHeapMemoryUsage
        
        val idleTime = (System.currentTimeMillis() - lastInteractionTime) / 1000 / 60 // minutes
        
        log.info("Memory Usage [$context] - Idle: ${idleTime}m | " +
                "JVM: ${formatBytes(usedMemory)}/${formatBytes(maxMemory)} | " +
                "Heap: ${formatBytes(heapUsage.used)}/${formatBytes(heapUsage.max)} | " +
                "NonHeap: ${formatBytes(nonHeapUsage.used)}/${formatBytes(nonHeapUsage.max)}")
        
        // Get browser memory usage via JavaScript
        getBrowserMemoryUsage()
    }
    
    private fun getBrowserMemoryUsage() {
        try {
            browser.executeJavaScriptAsync("""
                if (window.performance && window.performance.memory) {
                    const mem = window.performance.memory;
                    window.postIntellijMessage('memoryUsage', {
                        used: mem.usedJSHeapSize,
                        total: mem.totalJSHeapSize,
                        limit: mem.jsHeapSizeLimit
                    }, 'memory-monitor');
                } else {
                    window.postIntellijMessage('memoryUsage', {
                        error: 'Performance memory API not available'
                    }, 'memory-monitor');
                }
            """)
        } catch (e: Exception) {
            log.warn("Could not query browser memory usage", e)
        }
    }
    
    private fun formatBytes(bytes: Long): String {
        if (bytes < 1024) return "${bytes}B"
        val kb = bytes / 1024.0
        if (kb < 1024) return "%.1fKB".format(kb)
        val mb = kb / 1024.0
        if (mb < 1024) return "%.1fMB".format(mb)
        val gb = mb / 1024.0
        return "%.1fGB".format(gb)
    }
    
    data class BrowserMemoryStats(
        val used: Long,
        val total: Long,
        val limit: Long
    )
    
    private fun handleBrowserMemoryReport(data: Any?) {
        try {
            @Suppress("UNCHECKED_CAST")
            val memData = data as? Map<String, Any>
            if (memData != null && memData.containsKey("used")) {
                val used = (memData["used"] as? Number)?.toLong() ?: 0L
                val total = (memData["total"] as? Number)?.toLong() ?: 0L
                val limit = (memData["limit"] as? Number)?.toLong() ?: 0L
                
                browserMemoryStats = BrowserMemoryStats(used, total, limit)
                
                log.info("Browser Memory: ${formatBytes(used)}/${formatBytes(total)} (limit: ${formatBytes(limit)})")
                
                // Warn if browser memory usage is high
                val usagePercent = if (limit > 0) (used.toDouble() / limit * 100) else 0.0
                if (usagePercent > 80) {
                    log.warn("High browser memory usage: %.1f%% of limit".format(usagePercent))
                }
            } else if (memData?.containsKey("error") == true) {
                log.debug("Browser memory monitoring: ${memData["error"]}")
            }
        } catch (e: Exception) {
            log.warn("Error processing browser memory report", e)
        }
    }
    
    override fun dispose() {
        maintenanceExecutor.shutdown()
        memoryMonitorExecutor.shutdown()
        
        try {
            if (!maintenanceExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
                maintenanceExecutor.shutdownNow()
            }
            if (!memoryMonitorExecutor.awaitTermination(5, TimeUnit.SECONDS)) {
                memoryMonitorExecutor.shutdownNow()
            }
        } catch (e: InterruptedException) {
            maintenanceExecutor.shutdownNow()
            memoryMonitorExecutor.shutdownNow()
        }
        
        Disposer.dispose(myJSQueryOpenInBrowser)
        Disposer.dispose(browser)
    }

    // todo: remove and use types.Message
    private data class BrowserMessage(
        val messageType: String,
        val messageId: String?,
        val data: Any?
    )

    private class OnPageLoad(
        private val onLoad: () -> Unit
    ) : CefLoadHandlerAdapter() {
        override fun onLoadingStateChange(
            browser: CefBrowser?,
            isLoading: Boolean,
            canGoBack: Boolean,
            canGoForward: Boolean
        ) {
            if (!isLoading)
                onLoad()
        }
    }

    private companion object {

        private fun getGuiUrl() =
            System.getenv("GUI_URL") ?: "http://continue/index.html"

    }

}