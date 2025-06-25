package com.github.continuedev.continueintellijextension.auth

import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.google.gson.Gson
import com.intellij.credentialStore.Credentials
import com.intellij.ide.BrowserUtil
import com.intellij.ide.passwordSafe.PasswordSafe
import com.intellij.ide.util.PropertiesComponent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.project.Project
import com.intellij.remoteServer.util.CloudConfigurationUtil.createCredentialAttributes
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.net.URL

@Service
class ContinueAuthService {
    private val coroutineScope = CoroutineScope(Dispatchers.IO)

    companion object {
        fun getInstance(): ContinueAuthService = service<ContinueAuthService>()
        private const val CREDENTIALS_USER = "ContinueAuthUser"
        private const val ACCESS_TOKEN_KEY = "ContinueAccessToken"
        private const val REFRESH_TOKEN_KEY = "ContinueRefreshToken"
        private const val ACCOUNT_ID_KEY = "ContinueAccountId"
        private const val ACCOUNT_LABEL_KEY = "ContinueAccountLabel"
    }

    private fun getControlPlaneUrl(): String {
        val env = service<ContinueExtensionSettings>().continueState.continueTestEnvironment;
        when (env) {
            "none" -> return "https://control-plane-api-service-i3dqylpbqa-uc.a.run.app"
            "local" -> return "http://localhost:3001"
            "production" -> return "https://api.continue.dev"
            "test" -> return "https://api-test.continue.dev"
        }

        return "https://control-plane-api-service-i3dqylpbqa-uc.a.run.app"
    }

    init {
        setupRefreshTokenInterval()
    }

    fun startAuthFlow(project: Project, useOnboarding: Boolean) {
        // Open login page
        val url = openSignInPage(project, useOnboarding)

        // Open a dialog where the user should paste their sign-in token
        ApplicationManager.getApplication().invokeLater {
            val dialog = ContinueAuthDialog(useOnboarding, url) { token ->
                // Store the token
                updateRefreshToken(token)
            }
            dialog.show()
        }
    }

    fun signOut() {
        // Clear the stored tokens
        setAccessToken("")
        setRefreshToken("")
        setAccountId("")
        setAccountLabel("")

        ApplicationManager.getApplication().messageBus.syncPublisher(AuthListener.TOPIC)
            .handleUpdatedSessionInfo(null)
    }

    private fun updateRefreshToken(token: String) {
        // Launch a coroutine to call the suspend function
        coroutineScope.launch {
            try {
                val response = refreshToken(token)
                val accessToken = response["accessToken"] as? String
                val refreshToken = response["refreshToken"] as? String
                val user = response["user"] as? Map<*, *>
                val firstName = user?.get("firstName") as? String
                val lastName = user?.get("lastName") as? String
                val label = "$firstName $lastName"
                val id = user?.get("id") as? String
                val email = user?.get("email") as? String

                // Persist the session info
                setRefreshToken(refreshToken!!)
                val sessionInfo =
                    ControlPlaneSessionInfo(accessToken!!, ControlPlaneSessionInfo.Account(email!!, label))
                setControlPlaneSessionInfo(sessionInfo)

                // Notify listeners
                ApplicationManager.getApplication().messageBus.syncPublisher(AuthListener.TOPIC)
                    .handleUpdatedSessionInfo(sessionInfo)

            } catch (e: Exception) {
                // Handle any exceptions
                println("Exception while refreshing token: ${e.message}")
            }
        }
    }

    private fun setupRefreshTokenInterval() {
        // Launch a coroutine to refresh the token every 30 minutes
        coroutineScope.launch {
            while (true) {
                val refreshToken = getRefreshToken()
                if (refreshToken != null) {
                    updateRefreshToken(refreshToken)
                }

                kotlinx.coroutines.delay(15 * 60 * 1000) // 15 minutes in milliseconds
            }
        }
    }

    private suspend fun refreshToken(refreshToken: String) = withContext(Dispatchers.IO) {
        val client = OkHttpClient()
        val url = URL(getControlPlaneUrl()).toURI().resolve("/auth/refresh").toURL()
        val jsonBody = mapOf("refreshToken" to refreshToken)
        val jsonString = Gson().toJson(jsonBody)
        val requestBody = jsonString.toRequestBody("application/json".toMediaType())

        val request = Request.Builder()
            .url(url)
            .post(requestBody)
            .header("Content-Type", "application/json")
            .build()

        val response = client.newCall(request).execute()

        val responseBody = response.body?.string()
        val gson = Gson()
        val responseMap = gson.fromJson(responseBody, Map::class.java)

        responseMap
    }


    private fun openSignInPage(project: Project, useOnboarding: Boolean): String? {
        var authUrl: String? = null
        val coreMessenger = project.service<ContinuePluginService>().coreMessenger

        // Use a blocking approach to get the URL
        val latch = java.util.concurrent.CountDownLatch(1)

        coreMessenger?.request(
            "auth/getAuthUrl", mapOf(
                "useOnboarding" to useOnboarding
            ), null
        ) { response ->
            authUrl = ((response as? Map<*, *>)?.get("content") as? Map<*, *>)?.get("url") as? String
            latch.countDown()
        }

        // Wait for the response with a reasonable timeout
        latch.await(5, java.util.concurrent.TimeUnit.SECONDS)

        // Still open the URL in the browser (keeping existing behavior)
        if (authUrl != null) {
            BrowserUtil.open(authUrl!!)
        }

        return authUrl
    }

    private fun retrieveSecret(key: String): String? {
        return try {
            val attributes = createCredentialAttributes(key, CREDENTIALS_USER)
            val passwordSafe: PasswordSafe = PasswordSafe.instance

            val credentials: Credentials? = passwordSafe[attributes!!]
            credentials?.getPasswordAsString()
        } catch (e: Exception) {
            // Log the exception or handle it as needed
            println("Error retrieving secret for key $key: ${e.message}")
            null
        }
    }

    private fun storeSecret(key: String, secret: String) {
        try {
            val attributes = createCredentialAttributes(key, CREDENTIALS_USER)
            val passwordSafe: PasswordSafe = PasswordSafe.instance

            val credentials = Credentials(CREDENTIALS_USER, secret)
            passwordSafe.set(attributes!!, credentials)
        } catch (e: Exception) {
            // Log the exception or handle it as needed
            println("Error storing secret for key $key: ${e.message}")
        }
    }

    private fun getAccessToken(): String? {
        return retrieveSecret(ACCESS_TOKEN_KEY)
    }

    private fun setAccessToken(token: String) {
        storeSecret(ACCESS_TOKEN_KEY, token)
    }

    private fun getRefreshToken(): String? {
        return retrieveSecret(REFRESH_TOKEN_KEY)
    }

    private fun setRefreshToken(token: String) {
        storeSecret(REFRESH_TOKEN_KEY, token)
    }

    fun getAccountId(): String? {
        return PropertiesComponent.getInstance().getValue(ACCOUNT_ID_KEY)
    }

    fun setAccountId(id: String) {
        PropertiesComponent.getInstance().setValue(ACCOUNT_ID_KEY, id)
    }

    fun getAccountLabel(): String? {
        return PropertiesComponent.getInstance().getValue(ACCOUNT_LABEL_KEY)
    }

    fun setAccountLabel(label: String) {
        PropertiesComponent.getInstance().setValue(ACCOUNT_LABEL_KEY, label)
    }

    // New method to load all info as an object
    fun loadControlPlaneSessionInfo(): ControlPlaneSessionInfo? {
        val accessToken = getAccessToken()
        val accountId = getAccountId()
        val accountLabel = getAccountLabel()

        return if ((accessToken != null && accessToken != "") && accountId != null && accountLabel != null) {
            ControlPlaneSessionInfo(
                accessToken = accessToken,
                account = ControlPlaneSessionInfo.Account(
                    id = accountId,
                    label = accountLabel
                )
            )
        } else {
            null
        }
    }

    // New method to set all info from a ControlPlaneSessionInfo object
    fun setControlPlaneSessionInfo(info: ControlPlaneSessionInfo) {
        setAccessToken(info.accessToken)
        setAccountId(info.account.id)
        setAccountLabel(info.account.label)
    }

}

// Data class to represent the ControlPlaneSessionInfo
data class ControlPlaneSessionInfo(
    val accessToken: String,
    val account: Account
) {
    data class Account(
        val id: String,
        val label: String
    )
}
