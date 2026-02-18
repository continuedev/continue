import org.jetbrains.changelog.markdownToHTML
import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.intellij.platform.gradle.tasks.PrepareSandboxTask
import org.gradle.kotlin.dsl.intellijPlatform

fun environment(key: String) = providers.environmentVariable(key)

val platformVersion: String by project
val pluginGroup: String by project
val pluginVersion: String by project
val isEap get() = environment("RELEASE_CHANNEL").orNull == "eap"

plugins {
    kotlin("jvm") version "2.1.0"
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

sourceSets {
    val testIntegration = create("testIntegration")
    testIntegration.apply {
        compileClasspath += sourceSets.main.get().output
        runtimeClasspath += sourceSets.main.get().output
    }
}

val testIntegrationImplementation: Configuration by configurations.getting {
    extendsFrom(configurations.testImplementation.get())
}

dependencies {
    intellijPlatform {
        intellijIdeaCommunity(platformVersion)
        plugins(listOf("org.jetbrains.plugins.terminal:241.14494.150"))
        testFramework(TestFrameworkType.Platform)
        testFramework(TestFrameworkType.Starter, "243.21565.193", configurationName = "testIntegrationImplementation")
    }
    implementation("com.posthog.java:posthog:1.2.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("io.mockk:mockk:1.14.2") {
        // this transitive dependency (1.6.4) conflicts with built-in version (1.7.3)
        // otherwise e2e tests (runIdeForUiTests) will have linkage errors
        exclude(group = "org.jetbrains.kotlinx", module = "kotlinx-coroutines-core")
    }
    testImplementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    testImplementation("com.automation-remarks:video-recorder-junit5:2.0")
    testRuntimeOnly("org.junit.vintage:junit-vintage-engine:5.10.0") // required to run both JUnit 5 and JUnit 3

    testIntegrationImplementation("org.junit.jupiter:junit-jupiter:5.7.1")
    testIntegrationImplementation("org.kodein.di:kodein-di-jvm:7.20.2")
    testIntegrationImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-core-jvm:1.10.1")
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
    publishing {
        token = environment("PUBLISH_TOKEN")
        hidden = true
        val channel = if (isEap) "eap" else "default"
        channels = listOf(channel)
    }
    signing {
        certificateChain = environment("CERTIFICATE_CHAIN")
        privateKey = environment("PRIVATE_KEY")
        password = environment("PRIVATE_KEY_PASSWORD")
    }
    pluginVerification {
        ides {
            create("IC", "2025.2")
            create("IC", "2025.1")
            create("IC", "2024.3")
            create("IC", "2024.2")
            create("IC", "2024.1")
        }
    }
}

qodana {
    cachePath = provider { file(".qodana").canonicalPath }
    reportPath = provider { file("build/reports/inspections").canonicalPath }
    saveReport = true
    showReport = environment("QODANA_SHOW_REPORT").map { it.toBoolean() }.getOrElse(false)
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

    runIde {
        val openProject = "$projectDir/../../manual-testing-sandbox"
        argumentProviders += CommandLineArgumentProvider {
            listOf(openProject, "$openProject/test.kt")
        }
    }

    test {
        useJUnitPlatform()
        environment("CONTINUE_GLOBAL_DIR", "${rootProject.projectDir}/src/test/kotlin/com/github/continuedev/continueintellijextension/test-continue")
        jvmArgumentProviders += CommandLineArgumentProvider { listOf("-Dide.browser.jcef.sandbox.enable=false") }
    }
}

val testIntegration = task<Test>("testIntegration") {
    val integrationTestSourceSet = sourceSets.getByName("testIntegration")
    testClassesDirs = integrationTestSourceSet.output.classesDirs
    classpath = integrationTestSourceSet.runtimeClasspath
    systemProperty("CONTINUE_PLUGIN_DIR", tasks.prepareSandbox.get().pluginDirectory.get().asFile)
    environment("CONTINUE_GLOBAL_DIR", "${rootProject.projectDir}/src/testIntegration/kotlin/com/github/continuedev/continueintellijextension/test-continue")
    useJUnitPlatform()
    dependsOn(tasks.prepareSandbox)
}
