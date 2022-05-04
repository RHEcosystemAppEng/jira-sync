# Atlassian JIRA synchronizer

Simple JIRA issue synchronizer. 

### Configurations

- Following environment variables are required

| Env variable name | Example value |
| --- | --- |
| `SOURCE_JIRA_URL` | `https://issues.redhat.com` |
| `TARGET_JIRA_URL` | `https://jira.abc.com` |
| `SOURCE_JIRA_TOKEN` | `xxxx` |
| `TARGET_JIRA_USERNAME` | `jnirosha@abc.com` |
| `TARGET_JIRA_TOKEN` | `xxxx` |
| `TARGET_JIRA_PROJECT_CODE` | `CEP` |
| `SOURCE_JQL` | `project = "Ecosystem Application Engineering" AND component = Finastra` |
| `TARGET_JQL` | `project = Team-CNI` |

### How to run

#### Local machine

- Build the project using `npm install`
- Set the required environment variables with correct values
- Run the program using `node app.js`
