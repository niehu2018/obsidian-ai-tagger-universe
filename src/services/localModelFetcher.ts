export async function fetchLocalModels(endpoint: string): Promise<string[]> {
    try {
        const baseUrl = normalizeEndpoint(endpoint);
        const isOllama = baseUrl.includes('localhost:11434') || baseUrl.includes('ollama');
        
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
                console.error('Failed to fetch Ollama models:', error);
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
                return []; // Return empty array if endpoint doesn't respond properly
            }
    
            const data = await response.json();
            
            if (Array.isArray(data)) {
                return data.map(model => typeof model === 'string' ? model : model.id || model.name);
            } else if (data.data && Array.isArray(data.data)) {
                return data.data.map((model: any) => model.id || model.name);
            } else if (data.models && Array.isArray(data.models)) {
                return data.models.map((model: any) => model.id || model.name);
            }
        } catch (error) {
            console.error('Failed to fetch models from standard endpoint:', error);
        }
        
        return []; // Return empty array if all attempts fail
    } catch (error) {
        console.error('Error in fetchLocalModels:', error);
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
