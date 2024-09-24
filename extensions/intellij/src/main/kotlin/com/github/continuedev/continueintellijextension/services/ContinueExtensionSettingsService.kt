package com.github.continuedev.continueintellijextension.services

import com.github.continuedev.continueintellijextension.constants.getConfigJsPath
import com.github.continuedev.continueintellijextension.constants.getConfigJsonPath
import com.intellij.notification.Notification
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationType
import com.intellij.notification.Notifications
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.*
import com.intellij.openapi.options.Configurable
import com.intellij.ui.JBColor
import com.intellij.ui.TitledSeparator
import com.intellij.ui.components.JBCheckBox
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBPasswordField
import com.intellij.ui.components.JBTextField
import com.intellij.util.concurrency.AppExecutorUtil
import com.intellij.util.messages.Topic
import com.intellij.util.ui.FormBuilder
import com.intellij.util.ui.JBUI
import kotlinx.serialization.Serializable
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException
import java.net.URL
import java.text.NumberFormat
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit
import javax.swing.*


public class ContinueSettingsComponent {
    val panel: JPanel
    val remoteConfigServerUrl: JFormattedTextField = JFormattedTextField()
    val remoteConfigSyncPeriod: JFormattedTextField = JFormattedTextField(NumberFormat.getNumberInstance())
    val userToken: JBPasswordField = JBPasswordField()
    val enableTabAutocomplete: JBCheckBox = JBCheckBox("Enable tab autocomplete", false)
    val enableContinueTeamsBeta: JBCheckBox = JBCheckBox("Enabled", false)
    val displayEditorTooltip: JBCheckBox = JBCheckBox("Display editor tooltip", false)
    val controlPlaneProvider: JComboBox<ControlPlaneProviderName> = JComboBox(ControlPlaneProviderName.values())
    val controlPlaneProviderParams: MutableMap<JBLabel, JBTextField> = mutableMapOf()

    private fun withPanelBorder(component: JComponent): JComponent {
        component.setBorder(JBUI.Borders.emptyLeft(17))
        return component
    }

    init {

        remoteConfigSyncPeriod.value = 60 // default value;

        val remoteConfigPanel = FormBuilder.createFormBuilder()
            .addLabeledComponent("Remote config server URL:", remoteConfigServerUrl, 5, false)
            .addLabeledComponent("Remote config sync period:", remoteConfigSyncPeriod, 5, false)
            .addTooltip("IDE will sync remote config every set amount of minutes")
            .addLabeledComponent("User token:", userToken, 5, false)

        val autocompletePanel = FormBuilder.createFormBuilder()
            .addComponent(enableTabAutocomplete, 5)
            .addComponent(displayEditorTooltip, 5)

        controlPlaneProvider.setEnabled(enableContinueTeamsBeta.isSelected)

        enableContinueTeamsBeta.addChangeListener {
            controlPlaneProvider.setEnabled(enableContinueTeamsBeta.isSelected)
        }

        val controlPlaneProviderParamsPanel = FormBuilder.createFormBuilder()
            .addComponentFillVertically(JPanel(), 0)

        controlPlaneProvider.addActionListener {
            toggleControlPlaneProviderPanel(controlPlaneProviderParamsPanel)
        }

        val controlPlaneProviderPanel = FormBuilder.createFormBuilder()
            .addComponent(enableContinueTeamsBeta, 5)
            .addLabeledComponent("Provider", controlPlaneProvider, 5, false)
            .addComponent(controlPlaneProviderParamsPanel.panel, 5)

        panel = FormBuilder.createFormBuilder()
            .addComponent(TitledSeparator("Remote Config Settings"), 5)
            .addComponent(withPanelBorder(remoteConfigPanel.panel))
            .addComponent(TitledSeparator("Completions Options"), 5)
            .addComponent(withPanelBorder(autocompletePanel.panel))
            .addComponent(TitledSeparator("Teams Settings"), 5)
            .addTooltip("Enable/Disable requires restart")
            .addComponent(withPanelBorder(controlPlaneProviderPanel.panel), 5)
            .addComponentFillVertically(JPanel(), 0)
            .panel;
    }

    private fun toggleControlPlaneProviderPanel(form: FormBuilder) {
        val selectedProvider = controlPlaneProvider.selectedItem as ControlPlaneProviderName
        val provider = when (selectedProvider) {
            ControlPlaneProviderName.Continue -> ContinueControlPlaneProvider()
            ControlPlaneProviderName.Generic -> GenericControlPlaneProvider()
        }

        form.panel.removeAll()
        controlPlaneProviderParams.clear()

        provider.params.forEach { (key, value) ->
            controlPlaneProviderParams[JBLabel("${key}:")] = JBTextField(value)
        }

        controlPlaneProviderParams.forEach { (key, value) ->
            form.addLabeledComponent(key.text, value, 5, false)
        }
    }

    fun validateRemoteConfigServerUrl(): Boolean {
        val defaultBorder = UIManager.getLookAndFeel().defaults.getBorder("TextField.border")
        try {
            URL(remoteConfigServerUrl.text).toURI()
            remoteConfigServerUrl.foreground = JBColor.foreground()
            remoteConfigServerUrl.border = defaultBorder
            return true
        } catch (e: Exception) {
            remoteConfigServerUrl.foreground = JBColor.RED
            remoteConfigServerUrl.border = BorderFactory.createCompoundBorder(defaultBorder, BorderFactory.createLineBorder(JBColor.RED))
            return false
        }
    }
}

@Serializable
class ContinueRemoteConfigSyncResponse {
    var configJson: String? = null
    var configJs: String? = null
}

enum class ControlPlaneProviderName(private val displayName: String) {
    Continue("Continue for Teams"),
    Generic("Generic Teams Provider");

    override fun toString() : String {
        return displayName
    }
}

interface ControlPlaneProvider {
    val name: ControlPlaneProviderName
    var params: MutableMap<String, String>
}

class ContinueControlPlaneProvider: ControlPlaneProvider {
    override val name: ControlPlaneProviderName = ControlPlaneProviderName.Continue
    override var params: MutableMap<String, String> = mutableMapOf()
}

class GenericControlPlaneProvider: ControlPlaneProvider {
    override val name: ControlPlaneProviderName = ControlPlaneProviderName.Generic
    override var params: MutableMap<String, String> = mutableMapOf(
        "Auth redirect URL" to "",
        "Auth token URL" to "",
        "Client ID" to "",
    )
}


@State(
    name = "com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings",
    storages = [Storage("ContinueExtensionSettings.xml")]
)
open class ContinueExtensionSettings : PersistentStateComponent<ContinueExtensionSettings.ContinueState> {

    class ContinueState {
        var lastSelectedInlineEditModel: String? = null
        var shownWelcomeDialog: Boolean = false
        var remoteConfigServerUrl: String? = null
        var remoteConfigSyncPeriod: Int = 60
        var userToken: String? = null
        var enableTabAutocomplete: Boolean = true
        var ghAuthToken: String? = null
        var enableContinueTeamsBeta: Boolean = false
        var displayEditorTooltip: Boolean = true
        var controlPlaneProvider: ControlPlaneProvider = ContinueControlPlaneProvider()
    }

    var continueState: ContinueState = ContinueState()

    private var remoteSyncFuture: ScheduledFuture<*>? = null

    override fun getState(): ContinueState {
        return continueState
    }

    override fun loadState(state: ContinueState) {
        continueState = state
    }

    companion object {
        val instance: ContinueExtensionSettings
            get() = ServiceManager.getService(ContinueExtensionSettings::class.java)
    }

    // Sync remote config from server
    private fun syncRemoteConfig() {
        val state = instance.continueState

        if (state.remoteConfigServerUrl != null && state.remoteConfigServerUrl!!.isNotEmpty()) {
            // download remote config as json file

            val client = OkHttpClient()
            val baseUrl = state.remoteConfigServerUrl?.removeSuffix("/")

            val requestBuilder = Request.Builder().url("${baseUrl}/sync")

            if (state.userToken != null) {
                requestBuilder.addHeader("Authorization", "Bearer ${state.userToken}")
            }

            val request = requestBuilder.build()
            var configResponse: ContinueRemoteConfigSyncResponse? = null

            try {
                client.newCall(request).execute().use { response ->
                    if (!response.isSuccessful) throw IOException("Unexpected code $response")

                    response.body?.string()?.let { responseBody ->
                        try {
                            configResponse =
                                Json.decodeFromString<ContinueRemoteConfigSyncResponse>(responseBody)
                        } catch (e: Exception) {
                            e.printStackTrace()
                            return
                        }
                    }
                }
            } catch (e: IOException) {
                e.printStackTrace()
                return
            }

            if (configResponse?.configJson?.isNotEmpty()!!) {
                val file = File(getConfigJsonPath(request.url.host))
                file.writeText(configResponse!!.configJson!!)
            }

            if (configResponse?.configJs?.isNotEmpty()!!) {
                val file = File(getConfigJsPath(request.url.host))
                file.writeText(configResponse!!.configJs!!)
            }
        }
    }

    // Create a scheduled task to sync remote config every `remoteConfigSyncPeriod` minutes
    fun addRemoteSyncJob() {

        if (remoteSyncFuture != null) {
            remoteSyncFuture?.cancel(false)
        }

        instance.remoteSyncFuture = AppExecutorUtil.getAppScheduledExecutorService()
            .scheduleWithFixedDelay(
                { syncRemoteConfig() },
                0,
                continueState.remoteConfigSyncPeriod.toLong(),
                TimeUnit.MINUTES
            )
    }
}

interface SettingsListener {
    fun settingsUpdated(settings: ContinueExtensionSettings.ContinueState)

    companion object {
        val TOPIC = Topic.create("SettingsUpdate", SettingsListener::class.java)
    }
}

class ContinueExtensionConfigurable : Configurable {
    private var mySettingsComponent: ContinueSettingsComponent? = null

    override fun createComponent(): JComponent {
        mySettingsComponent = ContinueSettingsComponent()
        return mySettingsComponent!!.panel
    }

    override fun isModified(): Boolean {
        mySettingsComponent?.validateRemoteConfigServerUrl();

        val settings = ContinueExtensionSettings.instance

        val modified =
            mySettingsComponent?.remoteConfigServerUrl?.text != settings.continueState.remoteConfigServerUrl ||
            mySettingsComponent?.remoteConfigSyncPeriod?.text?.toInt() != settings.continueState.remoteConfigSyncPeriod ||
            mySettingsComponent?.userToken?.getPassword().toString() != settings.continueState.userToken ||
            mySettingsComponent?.enableTabAutocomplete?.isSelected != settings.continueState.enableTabAutocomplete ||
            mySettingsComponent?.enableContinueTeamsBeta?.isSelected != settings.continueState.enableContinueTeamsBeta ||
            mySettingsComponent?.displayEditorTooltip?.isSelected != settings.continueState.displayEditorTooltip
            mySettingsComponent?.controlPlaneProvider?.selectedItem != settings.continueState.controlPlaneProvider.name
            mySettingsComponent?.controlPlaneProviderParams?.forEach { (key, value) ->
                if (settings.continueState.controlPlaneProvider.params?.get(key.text) != value.text) {
                    return true
                }
            }
        return modified
    }

    override fun apply() {
        if (!mySettingsComponent?.validateRemoteConfigServerUrl()!!) {
            return
        }

        val settings = ContinueExtensionSettings.instance
        val restartRequired = mySettingsComponent?.enableContinueTeamsBeta?.isSelected != settings.continueState.enableContinueTeamsBeta

        settings.continueState.remoteConfigServerUrl = mySettingsComponent?.remoteConfigServerUrl?.text
        settings.continueState.remoteConfigSyncPeriod = mySettingsComponent?.remoteConfigSyncPeriod?.text?.toInt() ?: 60
        settings.continueState.userToken = mySettingsComponent?.userToken?.text
        settings.continueState.enableTabAutocomplete = mySettingsComponent?.enableTabAutocomplete?.isSelected ?: false
        settings.continueState.enableContinueTeamsBeta = mySettingsComponent?.enableContinueTeamsBeta?.isSelected ?: false
        settings.continueState.displayEditorTooltip = mySettingsComponent?.displayEditorTooltip?.isSelected ?: true

        ApplicationManager.getApplication().messageBus.syncPublisher(SettingsListener.TOPIC).settingsUpdated(settings.continueState)
        ContinueExtensionSettings.instance.addRemoteSyncJob()

        if (restartRequired) {
            notifyRestart()
        }
    }

    override fun reset() {
        val settings = ContinueExtensionSettings.instance
        mySettingsComponent?.remoteConfigServerUrl?.text = settings.continueState.remoteConfigServerUrl
        mySettingsComponent?.remoteConfigSyncPeriod?.text = settings.continueState.remoteConfigSyncPeriod.toString()
        mySettingsComponent?.userToken?.text = settings.continueState.userToken
        mySettingsComponent?.enableTabAutocomplete?.isSelected = settings.continueState.enableTabAutocomplete
        mySettingsComponent?.enableContinueTeamsBeta?.isSelected = settings.continueState.enableContinueTeamsBeta
        mySettingsComponent?.displayEditorTooltip?.isSelected = settings.continueState.displayEditorTooltip

        ContinueExtensionSettings.instance.addRemoteSyncJob()
    }

    override fun disposeUIResources() {
        mySettingsComponent = null
    }

    override fun getDisplayName(): String {
        return "Continue Extension Settings"
    }

    private fun notifyRestart() {
        val notification = Notification(
            "Continue Extension",
            "Settings updated",
            "Some changes require a restart to take effect.",
            NotificationType.INFORMATION,
        )

        notification.addAction(NotificationAction.createSimple("Restart IDE") {
            ApplicationManager.getApplication().restart()
        })

        Notifications.Bus.notify(notification)
    }
}
