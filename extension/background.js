chrome.runtime.onInstalled.addListener(() => {
    console.log('Extension installed');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FETCH_RULES') {
        loadConfig().then(() => fetchRules(config.apiKey)).then((rules) => {
            config.rules = rules;
            sendResponse({ status: 'success', rules: config.rules });
        }).catch(err => {
            sendResponse({ status: 'error', message: err.message });
        });
        return true; // Indicate that we will respond asynchronously
    }
});

async function loadConfig() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['apiKey'], (result) => {
            if (result.apiKey) {
                config.apiKey = result.apiKey;
                resolve();
            } else {
                reject(new Error('API key not found'));
            }
        });
    });
}

async function fetchRules(apiKey) {
    if (!apiKey) {
        throw new Error('API key not set');
    }

    const response = await fetch('http://localhost:3000/rules', {
        headers: {
            'x-api-key': apiKey
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch rules');
    }

    return await response.json();
}

let config = {
    apiKey: '',
    rules: {
        urls: [],
        patterns: {},
        guidelinesUrl: ''
    }
};