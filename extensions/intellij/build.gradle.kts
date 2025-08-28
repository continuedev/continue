import org.jetbrains.changelog.markdownToHTML
import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.intellij.platform.gradle.tasks.PrepareSandboxTask

fun environment(key: String) = providers.environmentVariable(key)

val remoteRobotVersion = "0.11.23"
val platformVersion: String by project
val pluginGroup: String by project
val pluginVersion: String by project
val isEap get() = environment("RELEASE_CHANNEL").orNull == "eap"

plugins {
    kotlin("jvm") version "1.9.22"
    id("org.jetbrains.intellij.platform") version "2.7.2"
    id("org.jetbrains.changelog") version "2.1.2"
    id("org.jetbrains.qodana") version "0.1.13"
    id("io.sentry.jvm.gradle") version "5.8.0"
}

group = pluginGroup
version = if (isEap) "$pluginVersion-eap" else pluginVersion

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        create("IC", platformVersion)
        plugins(listOf("org.jetbrains.plugins.terminal:241.14494.150"))
        testFramework(TestFrameworkType.Platform)
    }
    implementation("com.posthog.java:posthog:1.2.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("com.intellij.remoterobot:remote-robot:$remoteRobotVersion")
    testImplementation("com.intellij.remoterobot:remote-fixtures:$remoteRobotVersion")
    testImplementation("io.mockk:mockk:1.14.2") {
        // this transitive dependency (1.6.4) conflicts with built-in version (1.7.3)
        // otherwise e2e tests (runIdeForUiTests) will have linkage errors
        exclude(group = "org.jetbrains.kotlinx", module = "kotlinx-coroutines-core")
    }
    testImplementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    testImplementation("com.automation-remarks:video-recorder-junit5:2.0")
    testRuntimeOnly("org.junit.vintage:junit-vintage-engine:5.10.0") // required to run both JUnit 5 and JUnit 3
}

kotlin {
    jvmToolchain(17)
}

intellijPlatform {
    pluginConfiguration {
        ideaVersion {
            sinceBuild = "241"
        }
    }
    pluginVerification {
        ides {
            ide("IC", "2025.2")
            ide("IC", "2025.1")
            ide("IC", "2024.3")
            ide("IC", "2024.2")
            ide("IC", "2024.1")
        }
    }
}

qodana {
    cachePath = provider { file(".qodana").canonicalPath }
    reportPath = provider { file("build/reports/inspections").canonicalPath }
    saveReport = true
    showReport = environment("QODANA_SHOW_REPORT").map { it.toBoolean() }.getOrElse(false)
}

intellijPlatformTesting {
    runIde {
        register("runIdeForUiTests") {
            task {
                environment(
                    "CONTINUE_GLOBAL_DIR",
                    "${rootProject.projectDir}/src/test/kotlin/com/github/continuedev/continueintellijextension/e2e/test-continue"
                )
                jvmArgumentProviders += CommandLineArgumentProvider {
                    listOf(
                        "-Drobot-server.port=8082",
                        "-Dide.mac.message.dialogs.as.sheets=false",
                        "-Djb.privacy.policy.text=<!--999.999-->",
                        "-Djb.consents.confirmation.enabled=false",
                        "-Dide.mac.file.chooser.native=false",
                        "-DjbScreenMenuBar.enabled=false",
                        "-Dapple.laf.useScreenMenuBar=false",
                        "-Didea.trust.all.projects=true",
                        "-Dide.show.tips.on.startup.default.value=false",
                        "-Dide.browser.jcef.sandbox.enable=false"
                    )
                }
            }
            plugins {
                robotServerPlugin()
            }
        }
    }
}

tasks {
    withType<PrepareSandboxTask> {
        from("../../binary/bin") {
            into(pluginName.map { "$it/core" })
        }
    }

    patchPluginXml {
        pluginDescription = providers.fileContents(layout.projectDirectory.file("README.md")).asText.get()
            .substringAfter("<!-- Plugin description -->")
            .substringBefore("<!-- Plugin description end -->")
            .let(::markdownToHTML)
        check(pluginDescription.get().isNotEmpty()) { "Plugin description section not found in README.md" }
    }

    signPlugin {
        certificateChain = environment("CERTIFICATE_CHAIN")
        privateKey = environment("PRIVATE_KEY")
        password = environment("PRIVATE_KEY_PASSWORD")
    }

    publishPlugin {
        token = environment("PUBLISH_TOKEN")

        val channel = if (isEap) "eap" else "default"
        channels = listOf(channel)
    }

    runIde {
        val openProject = "$projectDir/../../manual-testing-sandbox"
        argumentProviders += CommandLineArgumentProvider {
            listOf(openProject, "$openProject/test.kt")
        }
    }

    test {
        useJUnitPlatform()
        jvmArgumentProviders += CommandLineArgumentProvider { listOf("-Dide.browser.jcef.sandbox.enable=false") }
    }
}
