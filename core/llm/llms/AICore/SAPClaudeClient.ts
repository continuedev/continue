import axios, { AxiosResponse } from 'axios';

// Define interfaces for the types
export interface SAPClaudeClientOptions {
    clientid: string;
    clientsecret: string;
    url: string;
    serviceurls: {AI_API_URL: string};
    resourcegroup?: string;
}

interface Token {
    access_token: string;
    expires_in: number;
    expires_at: number;
    [key: string]: any;
}

interface Deployment {
    id: string
    name: string
}
const CLAUDE_3_7_MODEL_ID = 'anthropic--claude-3.7-sonnet';

class SAPClaudeClient {
    private options: SAPClaudeClientOptions;
    private token: Token | null;
    private deployments?: Deployment[];
    model: string;
    constructor(options: SAPClaudeClientOptions, model: string) {
        this.options = {
            clientid: options.clientid,
            clientsecret: options.clientsecret,
            url: options.url,
            resourcegroup: options.resourcegroup || 'default',
            serviceurls: options.serviceurls
        };
        this.model = model;
        this.token = null;
    }

    private async getAiCoreDeployments(): Promise<Deployment[]> {
        if (this.options.clientsecret === "") {
            return [{ id: "notconfigured", name: "ai-core-not-configured" }]
        }

        const token = await this.getToken()
        const headers = {
            Authorization: `Bearer ${token}`,
            "AI-Resource-Group": this.options.resourcegroup,
            "Content-Type": "application/json",
        }

        const url = `${this.options.serviceurls.AI_API_URL}/v2/lm/deployments?$top=10000&$skip=0`

        try {
            const response = await axios.get(url, { headers })
            const deployments = response.data.resources

            return deployments
                .filter((deployment: any) => deployment.targetStatus === "RUNNING")
                .map((deployment: any) => {
                    const model = deployment.details?.resources?.backend_details?.model
                    if (!model?.name || !model?.version) {
                        return null // Skip this row
                    }
                    return {
                        id: deployment.id,
                        name: `${model.name}:${model.version}`,
                    }
                })
                .filter((deployment: any) => deployment !== null)
        } catch (error) {
            console.error("Error fetching deployments:", error)
            throw new Error("Failed to fetch deployments")
        }
    }

    private hasDeploymentForModel(modelId: string): boolean {
        return this.deployments?.some((d) => d.name.split(":")[0].toLowerCase() === modelId.split(":")[0].toLowerCase()) ?? false
    }

    private async getDeploymentForModel(modelId: string): Promise<string> {
        // If deployments are not fetched yet or the model is not found in the fetched deployments, fetch deployments
        if (!this.deployments || !this.hasDeploymentForModel(modelId)) {
            this.deployments = await this.getAiCoreDeployments()
        }

        const deployment = this.deployments.find((d) => {
            const deploymentBaseName = d.name.split(":")[0].toLowerCase()
            const modelBaseName = modelId.split(":")[0].toLowerCase()
            return deploymentBaseName === modelBaseName
        })

        if (!deployment) {
            throw new Error(`No running deployment found for model ${modelId}`)
        }

        return deployment.id
    }

    private async getToken(): Promise<string> {
        if (!this.token || this.token.expires_at < Date.now()) {
            this.token = await this.authenticate()
        }
        return this.token.access_token
    }

    /**
     * Authenticate and get access token
     * @returns {Promise<Token>} Authentication token
     */
    async authenticate(): Promise<Token> {
        const payload = {
            grant_type: "client_credentials",
            client_id: this.options.clientid || "",
            client_secret: this.options.clientsecret || "",
        };

        try {
            const response: AxiosResponse = await axios.post(`${this.options.url}/oauth/token` || "", payload, {
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
            });

            const token: Token = response.data;
            token.expires_at = Date.now() + token.expires_in * 1000;
            this.token = token;
            return token;
        } catch (error: any) {
            throw new Error(`Authentication failed: ${error.message}`);
        }
    }

    /**
     * Check if current token is valid
     * @returns {boolean} True if token is valid
     */
    isTokenValid(): boolean {
        if (!this.token) return false;
        return Date.now() < this.token.expires_at - 60000; // 1 minute buffer
    }

    /**
     * Make a call to Claude via SAP AI Core
     * @param {ClaudeParams} params - Parameters for the Claude call
     * @returns {Promise<any>} Claude response
     */
    async sendMessage(params: any): Promise<any> {
        try {
            const token = await this.getToken();
            const deploymentId = await this.getDeploymentForModel(this.model)


            const requestData = {
                ...params
            };

            const response: AxiosResponse = await axios.post(
                `${this.options.serviceurls.AI_API_URL}/v2/inference/deployments/${deploymentId}/converse-stream`,
                requestData,
                {
                    headers: {
                        'AI-Resource-Group': this.options.resourcegroup,
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    responseType: "stream"
                }
            );

            return response;

        } catch (error: any) {
            console.error('Error calling Claude:', error.response?.data || error.message);
            throw error;
        }
    }

}

// Export the class
export default SAPClaudeClient;

