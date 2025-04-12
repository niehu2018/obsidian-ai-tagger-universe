export async function fetchLocalModels(endpoint: string): Promise<string[]> {
    try {
        const baseUrl = normalizeEndpoint(endpoint);
        const isOllama = baseUrl.includes('localhost:11434') || baseUrl.includes('ollama');
        const isLocalAI = baseUrl.includes('localhost:8080') || baseUrl.includes('localai');
        const isLMStudio = baseUrl.includes('localhost:1234') || baseUrl.includes('lm_studio');
        
        // Special handling for Ollama
        if (isOllama) {
            try {
                // First try Ollama's specific API endpoint for listing models
                const ollamaResponse = await fetch(`${baseUrl.replace('/v1', '')}/api/tags`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (ollamaResponse.ok) {
                    const ollamaData = await ollamaResponse.json();
                    if (ollamaData.models && Array.isArray(ollamaData.models)) {
                        return ollamaData.models.map((model: any) => model.name);
                    }
                }
                
                // If that fails, try the Ollama list API
                const ollamaListResponse = await fetch(`${baseUrl.replace('/v1', '')}/api/list`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                if (ollamaListResponse.ok) {
                    const ollamaListData = await ollamaListResponse.json();
                    if (Array.isArray(ollamaListData.models)) {
                        return ollamaListData.models.map((model: any) => model.name);
                    }
                }
            } catch (error) {
                // Will fall back to standard endpoint
                //console.error('Failed to fetch Ollama models:', error);
            }
        }
        
        // Standard OpenAI-compatible API endpoint
        const modelsEndpoint = `${baseUrl}/models`;
        
        try {
            const response = await fetch(modelsEndpoint, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
    
            if (!response.ok) {
                // if (isLocalAI) {
                //     console.error('Failed to connect to LocalAI service. Please make sure it is running on the specified endpoint.');
                // } else if (isOllama) {
                //     console.error('Failed to connect to Ollama service. Please make sure it is running on the specified endpoint.');
                // } else if (isLMStudio) {
                //     console.error('Failed to connect to LM Studio service. Please make sure it is running on the specified endpoint.');
                // } else {
                //     console.error('Failed to connect to the specified API endpoint.');
                // }
                return []; // Return empty array if endpoint doesn't respond properly
            }
    
            const data = await response.json();
            
            let models: string[] = [];
            if (Array.isArray(data)) {
                models = data.map(model => typeof model === 'string' ? model : model.id || model.name);
            } else if (data.data && Array.isArray(data.data)) {
                models = data.data.map((model: any) => model.id || model.name);
            } else if (data.models && Array.isArray(data.models)) {
                models = data.models.map((model: any) => model.id || model.name);
            }

            if (models.length === 0) {
                // Service is running but no models found
                // if (isLocalAI) {
                //     console.error('No models found for LocalAI. Please download at least one model before using this service.');
                // } else if (isOllama) {
                //     console.error('No models found for Ollama. Please pull at least one model using the command: ollama pull <model>');
                // } else if (isLMStudio) {
                //     console.error('No models found for LM Studio. Please download at least one model via the LM Studio interface.');
                // } else {
                //     console.error('No models found for the specified service.');
                // }
            }
            
            return models;
        } catch (error) {
            //console.error('Failed to fetch models from standard endpoint:', error);
        }
        
        return []; // Return empty array if all attempts fail
    } catch (error) {
        //console.error('Error in fetchLocalModels:', error);
        return [];
    }
}

function normalizeEndpoint(endpoint: string): string {
    endpoint = endpoint.trim();
    endpoint = endpoint.replace(/\/$/, '');
    
    if (endpoint.endsWith('/v1/chat/completions')) {
        endpoint = endpoint.replace('/v1/chat/completions', '');
    }
    
    if (endpoint.endsWith('/api/generate')) {
        endpoint = endpoint.replace('/api/generate', '');
    }
    
    return endpoint;
}
