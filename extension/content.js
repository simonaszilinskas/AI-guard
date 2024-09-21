let config = {
    apiKey: '',
    userName: '',
    rules: {
        urls: [],
        patterns: {},
        guidelinesUrl: ''
    }
};

async function sendUsageData(action, details) {
    console.log('Preparing to send usage data:', { action, details, userName: config.userName, apiKey: config.apiKey });

    if (!config.apiKey || !config.userName) {
        console.error('Missing API key or user details. Cannot send usage data.');
        return;
    }

    const url = 'http://localhost:3000/usage';

    const payload = JSON.stringify({
        userName: config.userName,
        action,
        details,
        url: window.location.href,
        timestamp: new Date().toISOString()
    });

    console.log('Payload:', payload);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey
            },
            body: payload
        });

        console.log('Fetch response:', response);

        if (!response.ok) {
            const errorDetails = await response.text();
            throw new Error(`Failed to send usage data. Status: ${response.status}, Details: ${errorDetails}`);
        }

        console.log('Usage data sent successfully');
    } catch (error) {
        console.error('Error sending usage data:', error);
    }
}

function convertPatternsToRegex(patterns) {
    const convertedPatterns = {};
    for (const key in patterns) {
        if (patterns.hasOwnProperty(key)) {
            const pattern = patterns[key];
            try {
                if (typeof pattern === 'string') {
                    // If the pattern is a simple string, convert it directly
                    convertedPatterns[key] = { pattern: new RegExp(pattern, 'g'), enabled: true };
                } else if (typeof pattern.pattern === 'string') {
                    // If the pattern is an object with a pattern string
                    convertedPatterns[key] = { pattern: new RegExp(pattern.pattern, 'g'), enabled: pattern.enabled };
                } else {
                    console.warn(`Pattern for ${key} is not a string and has no "pattern" property`);
                }
                console.log(`Converted pattern for ${key}:`, convertedPatterns[key] ? convertedPatterns[key].pattern : 'undefined');
            } catch (err) {
                console.error(`Error converting pattern for ${key}:`, err);
            }
        } else {
            console.warn(`Pattern for ${key} is not provided`);
        }
    }
    return convertedPatterns;
}

function shouldCheckPage() {
    const currentUrl = window.location.href;
    const shouldCheck = config.rules.urls?.some(url => currentUrl.includes(url));
    console.log('Current URL:', currentUrl, 'Should Check:', shouldCheck);
    return shouldCheck;
}

function findSensitiveData(text) {
    let sensitiveData = {};
    console.log('Finding sensitive data in:', text);

    for (let dataType in config.rules.patterns) {
        const patternInfo = config.rules.patterns[dataType];
        console.log(`Testing pattern for ${dataType}:`, patternInfo.pattern);
        if (patternInfo?.enabled) {
            try {
                const matches = text.match(patternInfo.pattern);
                sensitiveData[dataType] = matches || [];
                console.log(`Pattern ${patternInfo.pattern} found matches:`, matches);
                if (matches && matches.length > 0) {
                    console.log(`Found ${dataType}:`, matches);
                } else {
                    console.log(`No ${dataType} found`);
                }
            } catch (error) {
                console.error(`Error processing pattern for ${dataType}:`, error);
            }
        } else {
            console.log(`Pattern for ${dataType} is not enabled or undefined`);
        }
    }

    return sensitiveData;
}

function anonymizeSensitiveData(text, sensitiveData) {
    let anonymizedText = text;

    for (let type in sensitiveData) {
        sensitiveData[type].forEach(item => {
            const anonymized = 'X'.repeat(item.length);
            const escapedPattern = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            anonymizedText = anonymizedText.replace(new RegExp(escapedPattern, 'g'), anonymized);
        });
    }
    return anonymizedText;
}

function showConfirmationDialog(sensitiveDataTypes, callback) {
    const dialogOverlay = document.createElement('div');
    dialogOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;

    const dialogBox = document.createElement('div');
    dialogBox.style.cssText = `
      background-color: white;
      padding: 20px;
      border-radius: 5px;
      max-width: 400px;
      text-align: center;
    `;

    const message = document.createElement('p');
    message.textContent = `Warning: The pasted text contains what appears to be sensitive information (${sensitiveDataTypes.join(', ')}). For security, it will be anonymized. Do you want to proceed?`;

    const guidelinesLink = document.createElement('a');
    guidelinesLink.href = config.rules.guidelinesUrl || 'https://your-company.com/guidelines';
    guidelinesLink.textContent = 'View Company Guidelines for LLM Content';
    guidelinesLink.target = '_blank';
    guidelinesLink.style.display = 'block';
    guidelinesLink.style.marginBottom = '15px';

    const confirmButton = document.createElement('button');
    confirmButton.textContent = 'Anonymize It';
    confirmButton.style.marginRight = '10px';
    confirmButton.onclick = () => {
        document.body.removeChild(dialogOverlay);
        callback(true);
    };

    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.onclick = () => {
        document.body.removeChild(dialogOverlay);
        callback(false);
    };

    dialogBox.appendChild(message);
    dialogBox.appendChild(guidelinesLink);
    dialogBox.appendChild(confirmButton);
    dialogBox.appendChild(cancelButton);
    dialogOverlay.appendChild(dialogBox);
    document.body.appendChild(dialogOverlay);
}

function pasteText(text) {
    const activeElement = document.activeElement;
    if (activeElement.isContentEditable) {
        activeElement.innerText = text;
    } else if (activeElement.tagName.toLowerCase() === 'textarea' || activeElement.tagName.toLowerCase() === 'input') {
        activeElement.value = text;
        activeElement.focus();
    }
}

document.addEventListener('paste', async (event) => {
    const pastedText = event.clipboardData?.getData('text');
    if (pastedText && shouldCheckPage()) {
        console.log('Pasted Text:', pastedText);

        const sensitiveData = findSensitiveData(pastedText);
        const sensitiveDataTypes = Object.keys(sensitiveData).filter(type => sensitiveData[type].length > 0);

        console.log('Sensitive Data Types:', sensitiveDataTypes);

        if (sensitiveDataTypes.length > 0) {
            event.preventDefault();
            const activeElement = document.activeElement;
            sendUsageData('sensitiveDataDetected', { sensitiveDataTypes });

            showConfirmationDialog(sensitiveDataTypes, (confirmed) => {
                if (confirmed) {
                    const anonymizedText = anonymizeSensitiveData(pastedText, sensitiveData);
                    sendUsageData('dataAnonymized', { sensitiveData });

                    activeElement.focus();
                    pasteText(anonymizedText);
                }
            });
        }
    }
});

async function fetchConfig() {
    return new Promise((resolve, reject) => {
        chrome.storage.sync.get(['userName', 'apiKey'], (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                config.userName = result.userName || config.userName;
                config.apiKey = result.apiKey || config.apiKey;

                chrome.runtime.sendMessage({ type: 'FETCH_RULES' }, (response) => {
                    if (response.status === 'success') {
                        console.log('Raw response from FETCH_RULES:', response);
                        config.rules = response.rules || config.rules;

                        // Log patterns before conversion
                        console.log('Patterns before conversion:', config.rules.patterns);

                        // Convert patterns to RegExp objects
                        config.rules.patterns = convertPatternsToRegex(config.rules.patterns);

                        resolve();
                    } else {
                        reject(response.message);
                    }
                });
            }
        });
    });
}

async function init() {
    console.log('Initializing extension...');
    try {
        await fetchConfig();
        console.log('Rules fetched and applied:', config.rules);
        const shouldCheck = shouldCheckPage();
        console.log('Initial shouldCheckPage result:', shouldCheck);
    } catch (error) {
        console.error('Failed to initialize:', error);
    }
}

init();