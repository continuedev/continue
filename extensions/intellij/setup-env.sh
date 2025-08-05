#!/bin/bash

# Setup script for IntelliJ extension build environment
# This script sets the JAVA_HOME to point to Java 17

export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64

echo "JAVA_HOME set to: $JAVA_HOME"
echo "Java version:"
java -version

echo ""
echo "You can now run: ./gradlew build"
echo "Or source this script in your shell: source setup-env.sh" 