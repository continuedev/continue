import org.jetbrains.changelog.markdownToHTML
import org.jetbrains.intellij.platform.gradle.TestFrameworkType
import org.jetbrains.intellij.platform.gradle.tasks.PrepareSandboxTask
import org.gradle.kotlin.dsl.intellijPlatform

fun environment(key: String) = providers.environmentVariable(key)

val platformVersion: String by project
val pluginGroup: String by project
val pluginVersion: String by project
val isEap get() = environment("RELEASE_CHANNEL").orNull == "eap"

// The IntelliJ Platform Gradle plugin (2.20.0, the latest) still brings
// jackson 2.21.4 and jsoup 1.22.2 onto the build classpath, both with known
// advisories. Raise them to fixed releases; drop these once the plugin does.
buildscript {
    dependencies {
        classpath(platform("com.fasterxml.jackson:jackson-bom:2.21.7"))
        constraints {
            classpath("org.jsoup:jsoup:1.23.2")
        }
    }
}

plugins {
    kotlin("jvm") version "2.4.21"
    id("org.jetbrains.intellij.platform") version "2.20.0"
    id("org.jetbrains.changelog") version "2.5.0"
    id("org.jetbrains.qodana") version "0.1.13"
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

    testImplementation("junit:junit:4.13.2")
    // Assertions such as assertDoesNotThrow; this used to arrive transitively
    // through the video recorder.
    testImplementation("org.junit.jupiter:junit-jupiter-api:6.1.3")
    testImplementation("io.mockk:mockk:1.14.11") {
        // this transitive dependency (1.6.4) conflicts with built-in version (1.7.3)
        // otherwise e2e tests (runIdeForUiTests) will have linkage errors
        exclude(group = "org.jetbrains.kotlinx", module = "kotlinx-coroutines-core")
    }
    testRuntimeOnly("org.junit.vintage:junit-vintage-engine:6.1.3") // required to run both JUnit 5 and JUnit 3
    // Gradle 9 no longer supplies the JUnit Platform launcher itself
    testRuntimeOnly("org.junit.platform:junit-platform-launcher:6.1.3")

    testIntegrationImplementation("org.junit.jupiter:junit-jupiter:6.1.3")
    "testIntegrationRuntimeOnly"("org.junit.platform:junit-platform-launcher:6.1.3")
    testIntegrationImplementation("org.kodein.di:kodein-di-jvm:7.33.0")
    testIntegrationImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-core-jvm:1.11.0")

    // The IntelliJ Starter test framework (ide-starter-squashed 243.x, used by
    // the integration tests only) brings Netty 4.2.0.Alpha4, Bouncy Castle
    // 1.78.1, Jackson 2.17, Guava 33.3.0, protobuf 3.24.4, XStream 1.4.20,
    // lz4-java 1.8.0, OpenTelemetry 1.41.0, Ktor 2.3.12 and jsoup 1.18.1, all
    // with known advisories. Raise them to fixed releases;
    // newer Starter releases still carry some of them and need Java 21.
    testIntegrationImplementation(platform("io.netty:netty-bom:4.2.18.Final"))
    testIntegrationImplementation(platform("com.fasterxml.jackson:jackson-bom:2.21.7"))
    testIntegrationImplementation(platform("io.opentelemetry:opentelemetry-bom:1.68.0"))
    testIntegrationImplementation(platform("io.opentelemetry:opentelemetry-bom-alpha:1.68.0-alpha"))
    testIntegrationImplementation(platform("io.ktor:ktor-bom:2.3.13"))
    constraints {
        testIntegrationImplementation("org.bouncycastle:bcprov-jdk18on:1.86")
        testIntegrationImplementation("org.bouncycastle:bcpkix-jdk18on:1.86")
        testIntegrationImplementation("org.bouncycastle:bcutil-jdk18on:1.86")
        testIntegrationImplementation("com.google.guava:guava:33.7.2-jre")
        testIntegrationImplementation("com.google.protobuf:protobuf-java:3.25.5")
        testIntegrationImplementation("com.thoughtworks.xstream:xstream:1.4.21")
        testIntegrationImplementation("org.jsoup:jsoup:1.23.2")
    }
}

// The unit-test framework (com.jetbrains.intellij.platform:test-framework
// 241.x, in the intellijPlatformTest* configurations the IntelliJ Platform
// plugin creates) brings jackson-core and jackson-databind 2.16.0, with known
// advisories. Raise them as on the other classpaths.
configurations.matching { it.name.startsWith("intellijPlatformTest") }.configureEach {
    resolutionStrategy.eachDependency {
        if (requested.group == "com.fasterxml.jackson.core" &&
            requested.name in setOf("jackson-core", "jackson-databind")
        ) {
            useVersion("2.21.7")
            because("jackson 2.16.0 from the IntelliJ test framework has advisories")
        }
    }
}

// lz4-java moved from org.lz4 to at.yawk.lz4; the old coordinates have no
// fixed release.
configurations.matching { it.name.startsWith("testIntegration") }.configureEach {
    resolutionStrategy.dependencySubstitution {
        substitute(module("org.lz4:lz4-java"))
            .using(module("at.yawk.lz4:lz4-java:1.13.0"))
            .because("org.lz4:lz4-java 1.8.0 has advisories fixed only in at.yawk.lz4")
    }
}

kotlin {
    jvmToolchain(17)
    compilerOptions {
        // sinceBuild=241 (2024.1) bundles Kotlin 1.9.x; Kotlin 2.4 cannot target below 2.0, so pin to 2.0
        // (the lowest allowed). The IDE's own kotlin-stdlib is used at
        // runtime (kotlin.stdlib.default.dependency=false), so only use APIs/language features
        // the oldest supported IDE provides.
        apiVersion.set(org.jetbrains.kotlin.gradle.dsl.KotlinVersion.KOTLIN_2_0)
        languageVersion.set(org.jetbrains.kotlin.gradle.dsl.KotlinVersion.KOTLIN_2_0)
    }
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
