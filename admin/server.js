const express = require('express');
const crypto = require('crypto');
const fs = require('fs').promises;
const bodyParser = require('body-parser');
const cors = require('cors');  // Import the cors package

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(cors());  // Use the cors middleware

// File paths
const CONFIG_FILE = './config.json';
const USAGE_FILE = './usageData.json';

// Helper function to read JSON file
async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return {}; // If the file doesn't exist, return an empty object
        } else if (error instanceof SyntaxError) {
            console.error(`Invalid JSON in ${filePath}. Initializing with an empty object.`);
            return {}; // For invalid JSON format, return an empty object and log the error
        }
        throw error; // For other errors, throw the error
    }
}

// Helper function to write JSON file
async function writeJsonFile(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// Initialize config file if it doesn't exist
async function initializeConfig() {
    try {
        await fs.access(CONFIG_FILE); // Check if the config file exists
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(`Initializing ${CONFIG_FILE} with default configuration.`);
            const defaultConfig = {
                apiKey: crypto.randomBytes(32).toString('hex'), // Generate a random API key
                rules: {
                    urls: [],
                    patterns: {},
                    guidelinesUrl: ''
                }
            };
            await writeJsonFile(CONFIG_FILE, defaultConfig); // Create the config file with default values
        }
    }
}

// Get API key
app.get('/api-key', async (req, res) => {
    try {
        const config = await readJsonFile(CONFIG_FILE);
        res.json({ apiKey: config.apiKey });
    } catch (error) {
        console.error('Error retrieving API key:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current rules
app.get('/rules', async (req, res) => {
    try {
        const config = await readJsonFile(CONFIG_FILE);
        res.json(config.rules);
    } catch (error) {
        console.error('Error reading rules:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update rules
app.post('/rules', async (req, res) => {
    try {
        const config = await readJsonFile(CONFIG_FILE);
        config.rules = req.body; // Update rules with the request body
        await writeJsonFile(CONFIG_FILE, config); // Write updated rules to the config file
        res.json({ message: 'Rules updated successfully' });
    } catch (error) {
        console.error('Error updating rules:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get configuration for extension
app.get('/config', async (req, res) => {
    try {
        const providedApiKey = req.headers['x-api-key']; // Get API key from request headers
        if (!providedApiKey) {
            return res.status(401).json({ error: 'API key is required' });
        }

        const config = await readJsonFile(CONFIG_FILE);
        if (providedApiKey !== config.apiKey) {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        res.json(config.rules); // Return rules if API key is valid
    } catch (error) {
        console.error('Error getting configuration:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Record usage data
app.post('/usage', async (req, res) => {
    try {
        console.log('Received usage data:', req.body); // Log the received data for debugging
        let usageData;
        try {
            const raw = await fs.readFile(USAGE_FILE, 'utf8');
            usageData = JSON.parse(raw);
        } catch (error) {
            if (error.code === 'ENOENT') {
                usageData = [];
            } else {
                throw error;
            }
        }
        usageData.push(req.body); // Add new data to existing data
        await writeJsonFile(USAGE_FILE, usageData); // Write updated usage data to the file
        res.status(200).json({ message: 'Usage data recorded successfully' });
    } catch (error) {
        console.error('Error recording usage data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get usage data
app.get('/usage', async (req, res) => {
    try {
        const usageData = await getUsageData();
        res.json(usageData);
    } catch (error) {
        console.error('Error retrieving usage data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Helper function to get usage data
async function getUsageData() {
    try {
        const rawData = await fs.readFile(USAGE_FILE, 'utf8');
        return JSON.parse(rawData);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return []; // Return an empty array if no usage data is found
        }
        throw error; // Throw other errors
    }
}

// Start the server
async function startServer() {
    await initializeConfig(); // Ensure the config file is initialized before starting the server
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}

startServer();