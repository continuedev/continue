export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH=$JAVA_HOME/bin:$PATH
sh scripts/install-dependencies.sh

cd extensions/intellij
./gradlew clean
./gradlew build