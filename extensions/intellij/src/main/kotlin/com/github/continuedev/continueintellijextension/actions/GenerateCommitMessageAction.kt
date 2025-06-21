package com.github.continuedev.continueintellijextension.actions

import com.github.continuedev.continueintellijextension.ContinueIcons
import com.github.continuedev.continueintellijextension.`continue`.CoreMessenger
import com.github.continuedev.continueintellijextension.services.ContinueExtensionSettings
import com.github.continuedev.continueintellijextension.services.ContinuePluginService
import com.github.continuedev.continueintellijextension.utils.DiffUtils
import com.github.continuedev.continueintellijextension.utils.castNestedOrNull
import com.github.continuedev.continueintellijextension.utils.getNestedOrNull
import com.github.continuedev.continueintellijextension.utils.uuid
import com.intellij.icons.AllIcons
import com.intellij.ide.HelpTooltip
import com.intellij.openapi.actionSystem.ActionToolbar
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.Presentation
import com.intellij.openapi.actionSystem.ex.CustomComponentAction
import com.intellij.openapi.actionSystem.impl.ActionButton
import com.intellij.openapi.application.ModalityState
import com.intellij.openapi.application.invokeLater
import com.intellij.openapi.components.service
import com.intellij.openapi.diff.impl.patch.IdeaTextPatchBuilder
import com.intellij.openapi.project.DumbAwareAction
import com.intellij.openapi.project.Project
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.ui.popup.JBPopupFactory
import com.intellij.openapi.util.Disposer
import com.intellij.openapi.util.Key
import com.intellij.openapi.vcs.VcsDataKeys
import com.intellij.openapi.vcs.changes.Change
import com.intellij.openapi.vcs.changes.CurrentContentRevision
import com.intellij.openapi.vcs.ui.CommitMessage
import com.intellij.ui.ColoredListCellRenderer
import com.intellij.ui.SimpleTextAttributes
import com.intellij.ui.speedSearch.SpeedSearchUtil
import com.intellij.vcs.commit.AbstractCommitWorkflowHandler
import com.intellij.vcs.commit.CommitWorkflowUi
import com.jetbrains.rd.util.ConcurrentHashMap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.nio.file.Path
import javax.swing.JComponent
import javax.swing.JList

/**
 * @author lk
 */
class GenerateCommitMessageAction : DumbAwareAction(TIP_TITLE_GENERATE), CustomComponentAction {

    private val continueSettingsService = service<ContinueExtensionSettings>()

    private var selectedModel: String?
        set(value) {
            continueSettingsService.continueState.lastSelectedVcsCommitModel = value
        }
        get() = continueSettingsService.continueState.lastSelectedVcsCommitModel

    private var currentSelectedModel: String? = selectedModel

    private var activeUiToJobMap: MutableMap<CommitWorkflowUi, GenerateJob> = ConcurrentHashMap()

    private val scope = CoroutineScope(Dispatchers.IO)

    override fun getActionUpdateThread() = ActionUpdateThread.BGT

    override fun update(e: AnActionEvent) {
        val project = e.project ?: return
        val workflowUi = commitWorkflowUi(e) ?: return
        val presentation = e.presentation
        presentation.isVisible = e.isFromActionToolbar && commitMessage(e) != null
        presentation.icon = if (isActive(workflowUi)) ContinueIcons.SPINNING else ContinueIcons.CONTINUE
        initializeGenerationJobAndModelOptions(project, workflowUi, presentation)
    }

    override fun actionPerformed(e: AnActionEvent) {
        val editorField = commitMessage(e)?.editorField ?: return
        val workflowUi = commitWorkflowUi(e) ?: return
        val project = e.project ?: return

        if (isActive(workflowUi)) {
            cancelJob(workflowUi)
            return
        }

        val changes = getChanges(workflowUi)
        if (changes.isEmpty()) return

        val basePath = Path.of(project.basePath ?: "")
        val patches = IdeaTextPatchBuilder.buildPatch(
            e.project, changes, basePath, false, true
        )

        scope.launch {
            val diff = withContext(Dispatchers.Default) {
                DiffUtils.diff(patches, basePath).split(Regex("\\n(?=diff)"))
            }

            if (diff.isEmpty()) return@launch

            val data = mapOf(
                "modelTitle" to selectedModel,
                "diff" to diff,
            )

            activeUiToJobMap.computeIfPresent(workflowUi) { _, job ->
                // Need to cancel first, then clear
                job.cancelAndRegenerate().also {
                    invokeLater(ModalityState.any()) { editorField.text = "" }
                }
            }?.start(data) {
                // We ensure that when transitioning from commit changes view to diff view,
                // it is not affected by the current modality state and works as expected
                invokeLater(ModalityState.any()) { editorField.text += it }
            }
        }
    }

    override fun createCustomComponent(presentation: Presentation, place: String): JComponent {
        return ActionButton(this, presentation, place, ActionToolbar.DEFAULT_MINIMUM_BUTTON_SIZE).apply {
            presentation.putClientProperty(CONTINUE_VCS_HELP_TOOLTIP, HelpTooltip())
            presentation.putClientProperty(CONTINUE_VCS_ACTION_BUTTON, this)
        }
    }

    override fun updateCustomComponent(component: JComponent, presentation: Presentation) {
        val workflowUi = presentation.getClientProperty(CONTINUE_VCS_COMMIT_WORKFLOW_UI) ?: return
        val tooltip = presentation.getClientProperty(CONTINUE_VCS_HELP_TOOLTIP) ?: return

        val active = isActive(workflowUi)
        val hasDiffs = hasDiffs(workflowUi)
        presentation.isEnabled = selectedModel != null && (active || hasDiffs)
        tooltip.setTitle(if (active) TIP_TITLE_GENERATING else TIP_TITLE_GENERATE)
        tooltip.setDescription(
            if (!active && !hasDiffs) TIP_DESCRIPTION_NO_CHANGES
            else if (selectedModel != null) "Model: $selectedModel"
            else TIP_DESCRIPTION_NO_MODEL
        )
        if (HelpTooltip.getTooltipFor(component) != tooltip) tooltip.installOn(component)
    }

    private fun isActive(workflowUi: CommitWorkflowUi?) = workflowUi?.let { activeUiToJobMap[it]?.isActive() } ?: false

    private fun cancelJob(workflowUi: CommitWorkflowUi?) = activeUiToJobMap[workflowUi]?.cancel()

    private fun initializeGenerationJobAndModelOptions(
        project: Project, workflowUi: CommitWorkflowUi, presentation: Presentation
    ) {
        if (activeUiToJobMap.containsKey(workflowUi)) return
        val tooltip = presentation.getClientProperty(CONTINUE_VCS_HELP_TOOLTIP) ?: return
        val component = presentation.getClientProperty(CONTINUE_VCS_ACTION_BUTTON) ?: return

        if (!activeUiToJobMap.containsKey(workflowUi)) {
            currentSelectedModel = selectedModel.also { selectedModel = null }
            project.getService(ContinuePluginService::class.java)?.coreMessenger?.let {
                activeUiToJobMap[workflowUi] = GenerateJob(it)
                Disposer.register(workflowUi) {
                    cancelJob(workflowUi)
                    activeUiToJobMap.remove(workflowUi)
                }

                // Load options only when the ui is first shown, not in other modals
                loadModelOptions(it, tooltip, component)
            }

        }
    }

    private fun loadModelOptions(coreMessenger: CoreMessenger, tooltip: HelpTooltip, component: JComponent) {
        fetchModelOptions(coreMessenger) { modelOptions ->
            invokeLater {
                if (modelOptions.size > 1) {
                    tooltip.setLink(LINK_TEXT) {
                        createPopup(modelOptions) { model ->
                            if (selectedModel != model) {
                                selectedModel = model
                                Messages.showInfoMessage(component, "Model selected: $model", "Success")
                            }
                        }.showUnderneathOf(component)
                    }
                }
            }
        }
    }

    private fun fetchModelOptions(coreMessenger: CoreMessenger, callback: (List<String>) -> Unit) {
        coreMessenger.request(
            "config/getSerializedProfileInfo", null, null
        ) { response ->
            val conf = response.getNestedOrNull("content", "result", "config")
            conf.castNestedOrNull<List<Map<String, Any>>>("modelsByRole", "chat")
                ?.mapNotNull { it.castNestedOrNull<String>("title") }?.let { options ->
                    if (options.isNotEmpty() && !options.any { currentSelectedModel == it }) {
                        val selectedModelByRole = conf.castNestedOrNull<String>("selectedModelByRole", "chat", "title")
                        currentSelectedModel = selectedModelByRole ?: options[0]
                    }
                    selectedModel = currentSelectedModel
                    callback(options)
                }
        }
    }

    private fun commitMessage(e: AnActionEvent) = e.getData(VcsDataKeys.COMMIT_MESSAGE_CONTROL) as? CommitMessage

    private fun commitWorkflowUi(e: AnActionEvent) = e.presentation.getClientProperty(CONTINUE_VCS_COMMIT_WORKFLOW_UI)
        ?: (e.getData(VcsDataKeys.COMMIT_WORKFLOW_HANDLER) as? AbstractCommitWorkflowHandler<*, *>)?.ui?.apply {
            e.presentation.putClientProperty(CONTINUE_VCS_COMMIT_WORKFLOW_UI, this)
        }


    private fun hasDiffs(ui: CommitWorkflowUi) =
        ui.getIncludedChanges().isNotEmpty() || ui.getIncludedUnversionedFiles().isNotEmpty()

    private fun getChanges(ui: CommitWorkflowUi): List<Change> {
        return ui.getIncludedChanges() + ui.getIncludedUnversionedFiles().map {
            Change(null, CurrentContentRevision(it))
        }
    }

    private fun createPopup(modelOptions: List<String>, onChosen: (String) -> Unit) =
        JBPopupFactory.getInstance().createPopupChooserBuilder(modelOptions).setTitle(POPUP_TITLE)
            .setItemChosenCallback(onChosen).setNamerForFiltering { n -> n }.setRenderer(customRenderer())
            .setSelectedValue(selectedModel, true).createPopup()


    private fun customRenderer() = object : ColoredListCellRenderer<String>() {
        override fun customizeCellRenderer(
            list: JList<out String>, value: String, index: Int, selected: Boolean, hasFocus: Boolean
        ) {
            val attributes = if (selected) {
                SimpleTextAttributes.REGULAR_BOLD_ATTRIBUTES
            } else {
                SimpleTextAttributes.REGULAR_ATTRIBUTES
            }
            append(value, attributes)
            icon = if (selectedModel == value) {
                AllIcons.General.GreenCheckmark
            } else {
                AllIcons.Nodes.EmptyNode
            }
            SpeedSearchUtil.applySpeedSearchHighlighting(list, this, true, selected)
        }
    }

    companion object {
        const val TIP_TITLE_GENERATE = "Generate Commit Message"
        const val TIP_TITLE_GENERATING = "Generating Commit Message"
        const val TIP_DESCRIPTION_NO_MODEL = "No model available"
        const val TIP_DESCRIPTION_NO_CHANGES = "No selected changes"
        const val POPUP_TITLE = "Select LLM Model"
        const val LINK_TEXT = "Switch model"

        val CONTINUE_VCS_ACTION_BUTTON: Key<ActionButton> = Key.create("continue.vcs.action.button")
        val CONTINUE_VCS_HELP_TOOLTIP: Key<HelpTooltip> = Key.create("continue.vcs.help.tooltip")
        val CONTINUE_VCS_COMMIT_WORKFLOW_UI: Key<CommitWorkflowUi> = Key.create("continue.vcs.commit.workflow.ui")

    }


}

class GenerateJob(
    private val coreMessenger: CoreMessenger,
) {
    private var isActive = false
    private var messageId: String? = null
    fun start(data: Any?, handle: (String) -> Unit) {
        isActive = true
        messageId = uuid()
        coreMessenger.request("generateCommitMessage", data, messageId) {
            if (!isActive) return@request
            if (it.castNestedOrNull<Boolean>("done") == true) {
                cancel(false)
            }
            handle(it.castNestedOrNull<String>("content") ?: "")
        }
    }

    fun cancelAndRegenerate() = GenerateJob(coreMessenger).also { cancel() }

    fun cancel(abort: Boolean = true) {
        if (!isActive) return
        isActive = false
        if (abort) coreMessenger.request("abort", null, messageId) {}
    }

    fun isActive() = isActive
}