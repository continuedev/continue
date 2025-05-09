import org.jetbrains.changelog.markdownToHTML

fun properties(key: String) = providers.gradleProperty(key)

fun environment(key: String) = providers.environmentVariable(key)

fun Sync.prepareSandbox() {
    from("../../binary/bin") { into("${intellij.pluginName.get()}/core/") }
    from("../vscode/node_modules/@vscode/ripgrep") { into("${intellij.pluginName.get()}/ripgrep/") }
}

val remoteRobotVersion = "0.11.23"

plugins {
    id("java") // Java support
    alias(libs.plugins.kotlin) // Kotlin support
    alias(libs.plugins.gradleIntelliJPlugin) // Gradle IntelliJ Plugin
    alias(libs.plugins.changelog) // Gradle Changelog Plugin
    alias(libs.plugins.qodana) // Gradle Qodana Plugin
    alias(libs.plugins.kover) // Gradle Kover Plugin
    kotlin("plugin.serialization") version "1.8.0"
}

group = properties("pluginGroup").get()

version = properties("pluginVersion").get()

// Configure project's dependencies
repositories {
    mavenCentral()
    maven { url = uri("https://packages.jetbrains.team/maven/p/ij/intellij-dependencies") }
}

// Dependencies are managed with Gradle version catalog - read more:
// https://docs.gradle.org/current/userguide/platforms.html#sub:version-catalog
dependencies {
    //    implementation(libs.annotations)
    implementation("com.squareup.okhttp3:okhttp:4.12.0") {
        exclude(group = "org.jetbrains.kotlin", module = "kotlin-stdlib")
    }
    implementation("org.jetbrains.kotlin:kotlin-stdlib:1.4.32")
    implementation("com.posthog.java:posthog:1.+")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.5.0")
    testImplementation("com.intellij.remoterobot:remote-robot:$remoteRobotVersion")
    testImplementation("com.intellij.remoterobot:remote-fixtures:$remoteRobotVersion")
    testImplementation("io.mockk:mockk:1.14.2")
    testImplementation("org.junit.jupiter:junit-jupiter-api:5.10.0")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.9.2")
    testImplementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation("com.automation-remarks:video-recorder-junit5:2.0")


    // Exclude vulnerable Log4j from all dependencies
    configurations.all {
        resolutionStrategy {
            eachDependency {
                if (requested.group == "log4j" && requested.name == "log4j") {
                    useTarget("org.slf4j:log4j-over-slf4j:1.7.36")
                }
            }
        }
    }

    // Add Log4j 2.x explicitly
    implementation("org.apache.logging.log4j:log4j-core:2.20.0")
    implementation("org.apache.logging.log4j:log4j-api:2.20.0")
    testImplementation(kotlin("test"))
}

// Set the JVM language level used to build the project. Use Java 11 for 2020.3+, and Java 17 for
// 2022.2+.
kotlin { jvmToolchain(17) }

// Configure Gradle IntelliJ Plugin - read more:
// https://plugins.jetbrains.com/docs/intellij/tools-gradle-intellij-plugin.html
intellij {
    pluginName = properties("pluginName")
    version = properties("platformVersion")
    type = properties("platformType")

    // Plugin Dependencies. Uses `platformPlugins` property from the gradle.properties file.
    plugins =
        properties("platformPlugins").map {
            it.split(',').map(String::trim).filter(String::isNotEmpty)
        }
}

// Configure Gradle Changelog Plugin - read more:
// https://github.com/JetBrains/gradle-changelog-plugin
changelog {
    groups.empty()
    repositoryUrl = properties("pluginRepositoryUrl")
}

// Configure Gradle Qodana Plugin - read more: https://github.com/JetBrains/gradle-qodana-plugin
qodana {
    cachePath = provider { file(".qodana").canonicalPath }
    reportPath = provider { file("build/reports/inspections").canonicalPath }
    saveReport = true
    showReport = environment("QODANA_SHOW_REPORT").map { it.toBoolean() }.getOrElse(false)
}

// Configure Gradle Kover Plugin - read more: https://github.com/Kotlin/kotlinx-kover#configuration
koverReport { defaults { xml { onCheck = true } } }

tasks {
    downloadRobotServerPlugin {
        version.set(remoteRobotVersion)
    }

    prepareSandbox {
        prepareSandbox()
    }

    prepareTestingSandbox {
        prepareSandbox()
    }

    prepareUiTestingSandbox {
        prepareSandbox()
    }

    wrapper { gradleVersion = properties("gradleVersion").get() }

    patchPluginXml {
        version.set(properties("pluginVersion"))
        sinceBuild.set(properties("pluginSinceBuild"))
        untilBuild.set(properties("pluginUntilBuild"))
        pluginDescription.set(
            providers.fileContents(layout.projectDirectory.file("README.md")).asText.map {
                val start = "<!-- Plugin description -->"
                val end = "<!-- Plugin description end -->"

                with(it.lines()) {
                    if (!containsAll(listOf(start, end))) {
                        throw GradleException(
                            "Plugin description section not found in README.md:\n$start ... $end"
                        )
                    }
                    subList(indexOf(start) + 1, indexOf(end)).joinToString("\n").let(::markdownToHTML)
                }
            }
        )
    }

    // Configure UI tests plugin
    // Read more: https://github.com/JetBrains/intellij-ui-test-robot
    runIdeForUiTests {
        environment(
            "CONTINUE_GLOBAL_DIR",
            "${rootProject.projectDir}/src/test/kotlin/com/github/continuedev/continueintellijextension/e2e/test-continue"
        )
        systemProperty("robot-server.port", "8082")
        systemProperty("ide.mac.message.dialogs.as.sheets", "false")
        systemProperty("jb.privacy.policy.text", "<!--999.999-->")
        systemProperty("jb.consents.confirmation.enabled", "false")
        systemProperty("ide.mac.file.chooser.native", "false")
        systemProperty("jbScreenMenuBar.enabled", "false")
        systemProperty("apple.laf.useScreenMenuBar", "false")
        systemProperty("idea.trust.all.projects", "true")
        systemProperty("ide.show.tips.on.startup.default.value", "false")
        systemProperty("ide.browser.jcef.jsQueryPoolSize", "10000")
        systemProperty("ide.browser.jcef.contextMenu.devTools.enabled", "true")

        // This is to ensure we load the GUI with OSR enabled. We have logic that
        // renders with OSR disabled below a particular IDE version.
        // See ContinueExtensionSettingsService.kt for more info.
//        intellij {
//            version.set("2024.1")
//        }
    }

    signPlugin {
        certificateChain = environment("CERTIFICATE_CHAIN")
        privateKey = environment("PRIVATE_KEY")
        password = environment("PRIVATE_KEY_PASSWORD")
    }

    publishPlugin {
        //        dependsOn("patchChangelog")
        token = environment("PUBLISH_TOKEN")
        // The pluginVersion is based on the SemVer (https://semver.org) and supports pre-release
        // labels, like 2.1.7-alpha.3
        // Specify pre-release label to publish the plugin in a custom Release Channel automatically.
        // Read more:
        // https://plugins.jetbrains.com/docs/intellij/deployment.html#specifying-a-release-channel
        channels.set(listOf(environment("RELEASE_CHANNEL").getOrElse("eap")))

        // We always hide the stable releases until a few days of EAP have proven them stable
        //        hidden = environment("RELEASE_CHANNEL").map { it == "stable" }.getOrElse(false)
    }

    runIde {
        // Open the `manual-testing-sandbox` directory and the specific file on start
        args = listOf(
            "${rootProject.projectDir.parentFile.parentFile}/manual-testing-sandbox",
            "${rootProject.projectDir.parentFile.parentFile}/manual-testing-sandbox/test.kt"
        ).map { file(it).absolutePath }
    }

    test {
        useJUnitPlatform()
    }
}
