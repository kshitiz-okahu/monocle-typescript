exports.extractMessages = function extractMessages(args) {
    /**
     * Extract system and user messages
     */
    try {
        let systemMessage = "";
        let userMessage = "";

        if (args && args.length > 0) {
            if (args[0].messages && Array.isArray(args[0].messages)) {
                for (const msg of args[0].messages) {
                    if ('content' in msg && 'role' in msg) {
                        if (msg.role === "system") {
                            systemMessage = msg.content;
                        } else if (["user", "human"].includes(msg.role)) {
                            userMessage = msg.content;
                        }
                    }
                }
            } else if (Array.isArray(args[0])) {
                for (const msg of args[0]) {
                    if ('content' in msg && 'role' in msg) {
                        if (msg.role === "system") {
                            systemMessage = msg.content;
                        } else if (["user", "human"].includes(msg.role)) {
                            userMessage = extractQueryFromContent(msg.content);
                        }
                    }
                }
            }
        }
        return [systemMessage, userMessage];
    } catch (e) {
        console.warn(`Warning: Error occurred in extractMessages: ${e.toString()}`);
        return ["", ""];
    }
}

function extractQueryFromContent(content) {
    try {
        const queryPrefix = "Query:";
        const answerPrefix = "Answer:";
        
        const queryStart = content.indexOf(queryPrefix);
        if (queryStart === -1) {
            return null;
        }

        const actualQueryStart = queryStart + queryPrefix.length;
        const answerStart = content.indexOf(answerPrefix, actualQueryStart);
        
        const query = answerStart === -1 
            ? content.slice(actualQueryStart).trim()
            : content.slice(actualQueryStart, answerStart).trim();
            
        return query;
    } catch (e) {
        console.warn(`Warning: Error occurred in extractQueryFromContent: ${e.toString()}`);
        return "";
    }
}

exports.extractAssistantMessage = function extractAssistantMessage(response) {
    try {
        if (typeof response === 'string') {
            return response;
        }
        
        if ('content' in response) {
            return response.content;
        }
        
        if (response.message && 'content' in response.message) {
            return response.message.content;
        }
        
        if ('replies' in response) {
            if ('content' in response.replies[0]) {
                return response.replies[0].content;
            } else {
                return response.replies[0];
            }
        }
        
        return "";
    } catch (e) {
        console.warn(`Warning: Error occurred in extractAssistantMessage: ${e.toString()}`);
        return "";
    }
}

exports.getVectorstoreDeployment = function getVectorstoreDeployment(myMap) {
    if (typeof myMap === 'object' && !Array.isArray(myMap)) {
        if ('_client_settings' in myMap) {
            const client = myMap['_client_settings'];
            const { host, port } = getKeysAsTuple(client, 'host', 'port');
            if (host) {
                return port ? `${host}:${port}` : host;
            }
        }
        const keysToCheck = ['client', '_client'];
        const host = getHostFromMap(myMap, keysToCheck);
        if (host) {
            return host;
        }
    } else {
        if (myMap.client && '_endpoint' in myMap.client) {
            return myMap.client['_endpoint'];
        }
        const { host, port } = getKeysAsTuple(myMap, 'host', 'port');
        if (host) {
            return port ? `${host}:${port}` : host;
        }
    }
    return null;
}

function getKeysAsTuple(obj, key1, key2) {
    return { [key1]: obj[key1], [key2]: obj[key2] };
}

function getHostFromMap(map, keys) {
    for (const key of keys) {
        if (key in map) {
            return map[key];
        }
    }
    return null;
}