# Simple Dockerfile for the Azure Function notification handler (Node.js)
FROM mcr.microsoft.com/azure-functions/node:4-node18-appservice

COPY . /home/site/wwwroot

# Install dependencies if you have package.json (not included in this sample). Example:
# RUN cd /home/site/wwwroot && npm install --production

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    FUNCTIONS_WORKER_RUNTIME=node

CMD ["/azure-functions-host/Microsoft.Azure.WebJobs.Script.WebHost"]
