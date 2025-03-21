export async function fetchLocalModels(endpoint: string): Promise<string[]> {
    try {
        const baseUrl = normalizeEndpoint(endpoint);
        const isOllama = baseUrl.includes('localhost:11434') || baseUrl.includes('ollama');
        const modelsEndpoint = `${baseUrl}/models`;
        
        if (isOllama) {
            try {
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
            } catch (error) {
                // Fall back to standard endpoint
            }
        }
        
        const response = await fetch(modelsEndpoint, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
            if (isOllama) {
                return ['llama2', 'llama2:13b', 'llama2:70b', 'mistral', 'mixtral', 'phi', 'phi2', 'gemma', 'gemma:7b', 'codellama'];
            }
            return [];
        }

        const data = await response.json();
        
        if (Array.isArray(data)) {
            return data.map(model => typeof model === 'string' ? model : model.id || model.name);
        } else if (data.data && Array.isArray(data.data)) {
            return data.data.map((model: any) => model.id || model.name);
        } else if (data.models && Array.isArray(data.models)) {
            return data.models.map((model: any) => model.id || model.name);
        } else if (isOllama) {
            return ['llama2', 'llama2:13b', 'llama2:70b', 'mistral', 'mixtral', 'phi', 'phi2', 'gemma', 'gemma:7b', 'codellama'];
        }
        
        return [];
    } catch (error) {
        if (endpoint.includes('localhost:11434') || endpoint.includes('ollama')) {
            return ['llama2', 'llama2:13b', 'llama2:70b', 'mistral', 'mixtral', 'phi', 'phi2', 'gemma', 'gemma:7b', 'codellama'];
        }
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
