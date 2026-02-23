# create the docker file

cat > Dockerfile << 'EOF'
FROM ubuntu:latest
ENV DEBIAN_FRONTEND=noninteractive
# Install SSH server
RUN apt-get update && apt-get install -y openssh-server
# Configure SSH
RUN mkdir /var/run/sshd
RUN echo 'root:my_password' | chpasswd
# Allow root login
RUN sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
# SSH login fix
RUN sed 's@session\s*required\s*pam_loginuid.so@session optional pam_loginuid.so@g' -i /etc/pam.d/sshd
EXPOSE 22
CMD ["/usr/sbin/sshd", "-D"]
EOF

docker build -t continue-ubuntu-ssh . # build the image

rm Dockerfile # remove the created Dockerfile

container_name="continue-ssh-container"

docker run -d -p 2222:22 --name $container_name continue-ubuntu-ssh # run the container

echo "docker container ${container_name} running on port 2222"

# add the instructions
bold=$(tput bold)
normal=$(tput sgr0)

echo "\n--------------------------------------"
echo "now ssh into vscode (using remote explorer) with the following command: ${bold}ssh root@localhost -p 2222${normal}"
echo "use the following password - \"${bold}my_password${normal}\""
