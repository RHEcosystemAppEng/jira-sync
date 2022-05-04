export default function validateEnvVariables() {
    if(!process.env.SOURCE_JIRA_URL)
        throw new Error(`Missing env $SOURCE_JIRA_URL`);
    if(!process.env.TARGET_JIRA_URL)
        throw new Error(`Missing env $TARGET_JIRA_URL`);
    if(!process.env.SOURCE_JQL)
        throw new Error(`Missing env $SOURCE_JQL`);
    if(!process.env.TARGET_JQL)
        throw new Error(`Missing env $TARGET_JQL`);
    if(!process.env.TARGET_JIRA_PROJECT_CODE)
        throw new Error(`Missing env $TARGET_JIRA_PROJECT_CODE`);
}