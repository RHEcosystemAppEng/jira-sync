import {Version2Client} from 'jira.js';
import fs from 'fs';

function _getSourceUrl() {
    const ENV_SOURCE_URL = process.env.SOURCE_JIRA_URL;
    if (!ENV_SOURCE_URL) {
        return _throwError("SOURCE_JIRA_URL")
    }
    return ENV_SOURCE_URL;
}

function _getTargetUrl() {
    const ENV_TARGET_URL = process.env.TARGET_JIRA_URL;
    if (!ENV_TARGET_URL) {
        _throwError("TARGET_JIRA_URL")
    }
    return ENV_TARGET_URL;
}

function _getSourcePersonalAccessToken() {
    const ENV_SOURCE_JIRA_TOKEN = process.env.SOURCE_JIRA_TOKEN;
    if (!ENV_SOURCE_JIRA_TOKEN) {
        _throwError("SOURCE_JIRA_TOKEN")
    }
    return ENV_SOURCE_JIRA_TOKEN;
}

function _getTargetPersonalAccessToken() {
    const ENV_TARGET_JIRA_TOKEN = process.env.TARGET_JIRA_TOKEN;
    if (!ENV_TARGET_JIRA_TOKEN) {
        _throwError("TARGET_JIRA_TOKEN")
    }
    return ENV_TARGET_JIRA_TOKEN;
}

function _getSourceUserName() {
    const ENV_SOURCE_JIRA_USERNAME = process.env.SOURCE_JIRA_USERNAME;
    if (!ENV_SOURCE_JIRA_USERNAME) {
        return _throwError("SOURCE_JIRA_USERNAME")
    }
    return ENV_SOURCE_JIRA_USERNAME;
}

function _getTargetUserName() {
    const ENV_TARGET_JIRA_USERNAME = process.env.TARGET_JIRA_USERNAME;
    if (!ENV_TARGET_JIRA_USERNAME) {
        _throwError("TARGET_JIRA_USERNAME")
    }
    return ENV_TARGET_JIRA_USERNAME;
}

function _getSourcePassword() {
    const ENV_SOURCE_JIRA_PASSWORD = process.env.SOURCE_JIRA_PASSWORD;
    if (!ENV_SOURCE_JIRA_PASSWORD) {
        _throwError("SOURCE_JIRA_PASSWORD")
    }
    return ENV_SOURCE_JIRA_PASSWORD;
}

function _getTargetPassword() {
    const ENV_TARGET_JIRA_PASSWORD = process.env.TARGET_JIRA_PASSWORD;
    if (!ENV_TARGET_JIRA_PASSWORD) {
        _throwError("TARGET_JIRA_PASSWORD")
    }
    return ENV_TARGET_JIRA_PASSWORD;
}

async function _getSourceAuthJson() {
    if (process.env.SOURCE_JIRA_USERNAME && process.env.SOURCE_JIRA_PASSWORD) {
        return {
            basic: {
                email: _getSourceUserName(),
                apiToken: _getSourcePassword(),
            }
        }
    }
    return {
        personalAccessToken: _getSourcePersonalAccessToken()
    }
}

async function _getTargetAuthJson() {
    if (process.env.TARGET_JIRA_USERNAME && process.env.TARGET_JIRA_PASSWORD) {
        return {
            basic: {
                email: _getTargetUserName(),
                apiToken: _getTargetPassword(),
            }
        }
    }
    return {
        personalAccessToken: _getTargetPersonalAccessToken()
    }
}

function _throwError(varName) {
    throw new Error(`Environment variable ${varName} is not set.`)
}

async function getSourceClient() {
    try {
        return new Version2Client({
            host: _getSourceUrl(),
            authentication: await _getSourceAuthJson()
        });
    } catch (e) {
        console.log(e)
    }
}


async function getTargetClient() {
    try {
        return new Version2Client({
            host: _getTargetUrl(),
            authentication: await _getTargetAuthJson(),
        })
    } catch (e) {
        console.log(e)
    }
}

async function loadConfigJson() {
    return JSON.parse(fs.readFileSync('./config.json', 'utf8'));
}

export default {
    getSourceClient,
    getTargetClient,
    loadConfigJson
};