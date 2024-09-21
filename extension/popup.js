document.getElementById('saveApiKey').addEventListener('click', () => {
    const userName = document.getElementById('userName').value;
    const apiKey = document.getElementById('apiKey').value;

    chrome.storage.sync.set({ userName, apiKey }, () => {
        document.getElementById('statusMessage').textContent = 'API key and user details saved successfully!';
        fetchAndDisplayRules(apiKey);
    });
});

// Load the saved API key and user name on popup load
document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.sync.get(['userName', 'apiKey'], (result) => {
        if (result.userName) {
            document.getElementById('userName').value = result.userName;
        }
        if (result.apiKey) {
            document.getElementById('apiKey').value = result.apiKey;
            fetchAndDisplayRules(result.apiKey);
        } else {
            document.getElementById('rules').textContent = 'No API key set. Please enter your API key to fetch rules.';
        }
    });
});

async function fetchAndDisplayRules(apiKey) {
    try {
        const response = await fetch('http://localhost:3000/rules', {
            headers: {
                'x-api-key': apiKey
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch rules');
        }

        const rules = await response.json();
        document.getElementById('rules').textContent = JSON.stringify(rules, null, 2);
    } catch (error) {
        console.error('Error fetching rules:', error);
        document.getElementById('rules').textContent = 'Error fetching rules. Please check your API key and try again.';
    }
}