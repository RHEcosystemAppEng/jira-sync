import { Version2Client } from 'jira.js';

var sourceFields;
var targetFields;
var sourceIssues;
var targetIssues;

const sourceClient = new Version2Client({
    host: `${process.env.sourceJiraUrl}`,
    authentication: {
        basic: {
            email: process.env.sourceJiraUser,
            apiToken: process.env.sourceJiraPassword,
        },
    },
});


const targetClient = new Version2Client({
    host: `${process.env.targetJiraUrl}`,
    authentication: {
        personalAccessToken: process.env.targetJiraPassword,
    },
});



async function getAllSourceFields() {
    if (!sourceFields) {
        sourceFields = await adminClient.field.getAllFields();
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

async function getAllSourceIssues() {
    if (!sourceIssues) {
        sourceIssues = await sourceClient.issueSearch.searchForIssuesUsingJql();
        //await populateOptions();
    }
    return sourceIssues;
}

async function main() {
    // const projects = await sourceClient.projects.getAllProjects();
    // console.log(projects);

    const fields = await sourceClient.issueFields.getFields();
    console.log(fields);

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