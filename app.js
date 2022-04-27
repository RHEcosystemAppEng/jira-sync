import config from './config-utlis.js'
import IssueLoader from './issue-loader.js';
import {Version2Client} from 'jira.js';

var sourceFields;
var targetFields;
var sourceIssues;
var targetIssues;


async function getAllSourceFields() {
    if (!sourceFields) {
        sourceFields = await sourceClient.field.getAllFields();
        // await populateOptions();
    }
    return sourceFields;
}

async function getAllTargetFields() {
    if (!targetFields) {
        targetFields = await targetClient.field.getAllFields();
        //await populateOptions();
    }
    return targetFields;
}

async function getAllTargetIssues() {
    if (!targetIssues) {
        targetIssues = await targetClient.search.search();
        //await populateOptions();
    }
    return targetIssues;
}

async function getAllSourceIssues(sourceClient) {
    if (!sourceIssues) {
        sourceIssues = await sourceClient.issueSearch.searchForIssuesUsingJql();
        //await populateOptions();
    }
    return sourceIssues;
}

async function main() {
    // const sourceClient = await config.getSourceClient();
    // const targetClient = await config.getTargetClient();
    // const issueLoader = new IssueLoader(targetClient, sourceClient);

    // const sourceIssues = await getAllSourceIssues(sourceClient);
    // console.log(sourceIssues);
    const sourceClient = await new Version2Client({
        newErrorHandling: true,
        host: 'https://issues.redhat.com',
        authentication: {
            personalAccessToken: `${process.env.SOURCE_JIRA_TOKEN}`
        },
    });
    const targetClient = await new Version2Client({
        newErrorHandling: true,
        host: `${process.env.TARGET_JIRA_URL}`,
        authentication: {
            basic: {
                email: `${process.env.TARGET_JIRA_USERNAME}`,
                apiToken: `${process.env.TARGET_JIRA_TOKEN}`
            }
        },
    });
    try {
        let projectInDest = await targetClient.projects.getProject({projectIdOrKey: "CEP"});
        console.log(projectInDest)
        let projectInSrc = await sourceClient
            .issueSearch.searchForIssuesUsingJqlPost(
                {
                    startAt: 47,
                    jql: "project = \"Ecosystem Application Engineering\" AND component = Finastra AND status != Closed",
                    fields: ["summary", "description"]
                }
            );

        for (const e of projectInSrc.issues) {
            const issueTypes = [];
            const res = await targetClient.issueTypes.getIssueAllTypes()
            res.forEach(e => {

                if (e.hierarchyLevel > -1) {
                    issueTypes.push({
                        id: e.id,
                        name: e.name,
                        level: e.hierarchyLevel
                    })
                }
            })
            console.log(JSON.stringify(issueTypes))
            await targetClient.issues.createIssue({
                fields: {
                    summary: e.fields.summary,
                    description: e.fields.description,
                    project: {
                        id: projectInDest.id
                    },
                    issuetype: {
                        id: issueTypes.find(e => e.name === "Task").id
                    }
                }
            })
            console.log(JSON.stringify(e));
        }


    } catch (e) {
        console.log(e)
    }

    // const projects = await issueLoader.fetchIssues();
    // console.log(projects)
    // const fields = await sourceClient.issueFields.getFields();
    // console.log(fields);

    // const issues = await sourceClient.issueSearch.searchForIssuesUsingJql();
    // console.log(issues);
}

main();


////synchronize() {
// get source fields
// get target fields

// source jql
// getSoureIssues (jql);

// do a search in target jira with link name of source jira id
// jql= linktext= jiraid and project AppEng

// if it does not exist
// creat a jira
// in create jira dont forget to add the link text
// issueRemoteLinks.createOrUpdateRemoteIssueLink

// var issue = createIssue();


// and if it exist update the jira


//}