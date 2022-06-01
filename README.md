# Atlassian JIRA synchronizer ↔️

![JIRA logo](./doc/img/jira_logo.png)

Simple JIRA issue synchronizer. This program can only sync issues from a 
defined source JIRA platform to a defined target JIRA platform.

### Features

- Create missing issues in target JIRA platform ✅
- Link newly created issue to source JIRA issue ✅
- Copy comments from source JIRA to newly created issue/ existing linked issue ✅
- Map issue state to defined state in the config.json ✅
- Assigned issues to relevant users ❌

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
| `SOURCE_JQL` | `project = "Ecosystem Application Engineering" AND component = ABC` |
| `TARGET_JQL` | `project = Team-CNI` |

- Program expects that when creating "Epic" type of issues, it requires 
  a custom type (Epic Name) to be visible on the issue creation page.

### How to run

Use the JQL expressions to narrow down the issue search as much as possible. 
It will help to run the program faster with less memory footprint. 

#### Local machine

- Build the project using `npm install`
- Set the required environment variables with correct values
- Run the program using `node app.js`

### deploy with helm

- go to deploy/jira-sync
- open the values file and configiure according to the comments.
