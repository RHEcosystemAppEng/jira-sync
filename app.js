import config from './config-utlis.js'
import IssueLoader from './issue-loader.js';
var sourceFields;
var targetFields;
var sourceIssues;
var targetIssues;


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
    const sourceClient = await config.getSourceClient();
    // const targetClient = config.getTargetClient();
    const issueLoader = new IssueLoader(sourceClient, sourceClient);

    const projects = await issueLoader.fetchIssues();
    console.log(projects)
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