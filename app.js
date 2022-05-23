import _ from 'lodash';
import {Version2Client, Version2} from 'jira.js';
import validateEnvVariables from './validate.js'
import configUtils from './config-utlis.js'

const srcDefaultIssueTransitionName = 'To Do';
let srcIssueComments;
let destIssueComments;
let issueRemoteLinks;
let destIssueFields;
let destEpicCustomField;
let destProject;
const existingIssues = {};
const existingIssuesToSrcIssuesMap = {};
const newlyCreatedIssueList = [];
const updatedIssueList = [];
const userMappings = configUtils.getUserMappings();
const issueTypeMappings = configUtils.getTypeMappings();
const issueStateMappings = configUtils.getStateMappings();
const errors = [];


// todo
// Phase - 1
// sync users  (compare with existing)
// sync states  (compare with existing)
// sync comments  (compare with existing)


// project = FusionOperate AND assignee in (123, 1234, 3453, 567)
// project = FusionOperate AND filter=1845

// Phase - 2
// sync summary (compare with existing)
// sync description  (compare with existing)
// sync attachments  (copy only the web-links to the original source attachments)
// sync priority  (compare with existing)
// sync labels  (compare with existing, use the config)
async function main() {
    console.log('Jira-Sync started!');
    validateEnvVariables()

    const sourceClient = await new Version2Client({
        newErrorHandling: true,
        host: `${process.env.SOURCE_JIRA_URL}`,
        authentication: {
            personalAccessToken: `${process.env.SOURCE_JIRA_TOKEN}`,
        },
    });
    const targetClient = await new Version2Client({
        newErrorHandling: true,
        host: `${process.env.TARGET_JIRA_URL}`,
        authentication: {
            basic: {
                email: `${process.env.TARGET_JIRA_USERNAME}`,
                apiToken: `${process.env.TARGET_JIRA_TOKEN}`,
            },
        },
    });

    issueRemoteLinks = new Version2.IssueRemoteLinks(targetClient);
    srcIssueComments = new Version2.IssueComments(sourceClient);
    destIssueComments = new Version2.IssueComments(targetClient);
    destIssueFields = new Version2.IssueFields(targetClient);

    try {
        destProject = await targetClient.projects.getProject({projectIdOrKey: process.env.TARGET_JIRA_PROJECT_CODE});

        let srcIssueList = [];

        const toCreateIssueList = [];
        const toUpdateIssueList = [];
        const toCreateSubTypeIssueList = [];

        await Promise.all([
            loadIssues(sourceClient, process.env.SOURCE_JQL)
                .then((e) => {
                    srcIssueList = e;
                }),
            loadIssues(targetClient, process.env.TARGET_JQL)
                .then(async (destIssueList) => {
                    for (const destIssue of destIssueList) {
                        const srcIssueKey = await _getRemoteLinkIssueKey(destIssue.id);

                        if (!_.isEmpty(srcIssueKey)) {
                            existingIssues[srcIssueKey[0].object.title] = destIssue;
                        }
                    }
                }),
        ]);

        console.log('Loading data finished...');

        for (const srcIssue of srcIssueList) {

            if (!existingIssues[srcIssue.key]) {
                if (!srcIssue.fields.parent) {
                    toCreateIssueList.push(srcIssue)
                } else {
                    toCreateSubTypeIssueList.push(srcIssue)
                }
            } else {
                // compare fields for any updates
                const destIssue = existingIssues[srcIssue.key];
                existingIssuesToSrcIssuesMap[destIssue.id] = srcIssue;
                toUpdateIssueList.push(destIssue)
            }
        }

        console.log('Synchronizing the jira issues...');

        await Promise.all([
            createNewIssues(targetClient, toCreateIssueList),
            updateExistingIssues(targetClient, toUpdateIssueList)
        ])

        // sub-type issues expect their parent issue to be available
        await createNewIssues(targetClient, toCreateSubTypeIssueList);

        console.log(`Jira issue synchronization completed.`);
        console.log(`Created: ${newlyCreatedIssueList.length} Updated: ${updatedIssueList.length} Errored: ${errors.length}`);
    } catch (e) {
        console.log(e);
    }
}

function _getIssueType(srcIssueTypeName) {
    const matchingVal = issueTypeMappings[srcIssueTypeName];
    if (_.isEmpty(matchingVal) || _.isUndefined(matchingVal)) return 'Task';

    return matchingVal;
}

function _getTargetTransition(allDestTransitions, srcTransitionName, defaultTransitionName){

    let transition = allDestTransitions.filter((e) => e.name === defaultTransitionName)[0];
    const mappedTransitionName = issueStateMappings[srcTransitionName];
    const matchedTransition = allDestTransitions.filter((e) => e.name === mappedTransitionName);
    if (matchedTransition.length > 0) {
        transition = matchedTransition[0];
    }
    return transition;
}

function _getRemoteLinkIssueKey(srcIssueId) {
    return issueRemoteLinks.getRemoteIssueLinks({
        issueIdOrKey: srcIssueId,
    }).then((listData) => listData.filter((e) => e.object.url && e.object.url.includes('https://')));
}

async function _generateCreateIssuePayload(srcIssue, destProjId) {
    const newIssueType = _getIssueType(srcIssue.fields.issuetype.name);

    const payload = {
        fields: {
            summary: srcIssue.fields.summary,
            description: srcIssue.fields.description,
            project: {
                id: destProjId,
            },
            issuetype: {
                name: newIssueType,
            }
        },
    };

    if (newIssueType.toLowerCase().includes("sub")) {
        payload.fields['parent'] = {
            key: existingIssues[srcIssue.fields.parent.key].key
        }
    }
    if (newIssueType.toLowerCase().includes("epic")) {
        if (!destEpicCustomField) {
            const result = await destIssueFields.getFieldsPaginated({
                query: "Epic Name"
            })
            destEpicCustomField = result.values[0];
        }
        payload.fields[destEpicCustomField.id] = srcIssue.fields.summary
    }
    return payload;
}

async function loadIssues(jiraClient, jql) {
    const issueList = [];
    let offSet = 0;
    let total = 0;

    do {
        const searchResults = await jiraClient
            .issueSearch.searchForIssuesUsingJqlPost(
                {
                    startAt: offSet,
                    jql,
                },
            ).catch((e) => {
                console.log(`Cannot fetch issues from JIRA(${jiraClient.config.host}). Reason : ${JSON.stringify(e)}`);
            });

        issueList.push(...searchResults.issues);

        offSet += searchResults.maxResults;
        total = searchResults.total;
    } while (offSet < total);

    return issueList;
}

async function loadIssueComments(issueCommentsObj, issueKey) {
    const commentList = [];
    let offSet = 0;
    let total = 0;

    do {
        const searchResults = await issueCommentsObj.getComments(
            {
                startAt: offSet,
                issueIdOrKey: issueKey,
            },
        ).catch((e) => {
            console.log(`Cannot fetch issue comments. Reason : ${JSON.stringify(e)}`);
        });

        commentList.push(...searchResults.comments);

        offSet += searchResults.maxResults;
        total = searchResults.total;
    } while (offSet < total);

    return commentList;
}

async function createNewIssues(targetClient, issueList) {
    for (const srcIssue of issueList) {
        const payload = await _generateCreateIssuePayload(srcIssue, destProject.id);

        await targetClient.issues.createIssue(payload)
        .then(async (newIssue) => {
            await issueRemoteLinks.createOrUpdateRemoteIssueLink({
                issueIdOrKey: newIssue.key,
                object: {
                    title: srcIssue.key,
                    url: process.env.SOURCE_JIRA_URL + "/browse/" + srcIssue.key,
                },
            });
            return newIssue;
        }).then(async (newIssue) => {
            const allTransitions = await targetClient.issues.getTransitions({
                issueIdOrKey: newIssue.key,
            }).then((e) => e.transitions);
            let transition = _getTargetTransition(allTransitions, srcIssue.fields.status.name, srcDefaultIssueTransitionName);

            await targetClient.issues.doTransition({
                issueIdOrKey: newIssue.id,
                transition: {
                    id: transition.id,
                    to: {
                        name: transition.name,
                    },
                },
            });
            return newIssue;
        }).then(async (newIssue) => {
            const srcComments = await loadIssueComments(srcIssueComments, srcIssue.key);
            for (const comment of srcComments) {
                await destIssueComments.addComment({
                    issueIdOrKey: newIssue.key,
                    body: comment.body,
                });
            }
            return newIssue;
        }).then((newIssue) => {
            newlyCreatedIssueList.push(newIssue);
            existingIssues[srcIssue.key] = newIssue;
        }).catch((e) => {
            errors.push(e);
            console.log(`New issue creation failed in target system. Source Jira : ${srcIssue.key}  Reason:` + JSON.stringify(e));
        });
    }
}

async function updateExistingIssues(targetClient, issueList) {

    for (const destIssue of issueList) {
        try {
            let isUpdated = false;
            const srcIssue = existingIssuesToSrcIssuesMap[destIssue.id];

            const allTransitions = await targetClient.issues.getTransitions({
                issueIdOrKey: destIssue.key,
            }).then((e) => e.transitions);
            let transition = _getTargetTransition(allTransitions, srcIssue.fields.status.name, destIssue.fields.status.name);

            if (transition.name !== destIssue.fields.status.name) {
                await targetClient.issues.doTransition({
                    issueIdOrKey: destIssue.id,
                    transition: {
                        id: transition.id,
                        to: {
                            name: transition.name,
                        },
                    },
                });
                isUpdated = true;
            }

            // sync comments (only src ---> dest. Not the other way!)
            // NOTE: Updated comments will be added as a new comment in destination jira system
            const srcCommentMap = {};
            const destCommentMap = {};
            await loadIssueComments(destIssueComments, destIssue.key).then((commentList) => {
                commentList.forEach((e) => {
                    destCommentMap[e.body] = e;
                });
            });

            const srcComments = await loadIssueComments(srcIssueComments, srcIssue.key).then((commentList) => {
                commentList.forEach((e) => {
                    srcCommentMap[e.body] = e;
                });
                return commentList;
            });

            for (const comment of srcComments) {
                if (!destCommentMap[comment.body]) {
                    await destIssueComments.addComment({
                        issueIdOrKey: destIssue.key,
                        body: comment.body,
                    });
                    isUpdated = true;
                }
            }

            if (isUpdated) {
                updatedIssueList.push(destIssue);
            }
        } catch (e) {
            errors.push(e)
            console.log(`Update issue of ${destIssue.key} failed in target jira system. Reason: ${JSON.stringify(e)}`)
        }
    }
}

main();
