import _ from 'lodash';
import {Version2Client, Version2} from 'jira.js';
import validateEnvVariables from './validate.js'

const srcDefaultIssueTransitionName = 'To Do';
let srcIssueComments;
let destIssueComments;
let issueRemoteLinks;
let destProject;
const existingIssues = {};
const existingIssuesToSrcIssuesMap = {};
const newlyCreatedIssueList = [];
const updatedIssueList = [];
const destIssueTypes = [];
const errors = [];

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
            targetClient.issueTypes.getIssueAllTypes()
                .then((data) => {
                    data.forEach((e) => {
                        destIssueTypes.push(e.name);
                    });
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

        await createNewSubIssues(targetClient, toCreateSubTypeIssueList);

        console.log(`Jira issue synchronization completed.`);
        console.log(`Created: ${newlyCreatedIssueList.length} Updated: ${updatedIssueList.length} Errored: ${errors.length}`);
    } catch (e) {
        console.log(e);
    }
}


function _getIssueType(destIssueTypeList, destIssueTypeName) {
    const matchingVal = destIssueTypeList.find((e) => e === destIssueTypeName);
    if (_.isEmpty(matchingVal) || _.isUndefined(matchingVal)) return 'Task';

    return matchingVal;
}

function _getRemoteLinkIssueKey(srcIssueId) {
    return issueRemoteLinks.getRemoteIssueLinks({
        issueIdOrKey: srcIssueId,
    }).then((listData) => listData.filter((e) => e.object.url && e.object.url.includes('https://')));
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
        await targetClient.issues.createIssue({
            fields: {
                summary: srcIssue.fields.summary,
                description: srcIssue.fields.description,
                project: {
                    id: destProject.id,
                },
                issuetype: {
                    name: _getIssueType(destIssueTypes, srcIssue.fields.issuetype.name),
                }
            },
        }).then(async (newIssue) => {
            await issueRemoteLinks.createOrUpdateRemoteIssueLink({
                issueIdOrKey: newIssue.key,
                object: {
                    title: srcIssue.key,
                    url: srcIssue.self,
                },
            });
            return newIssue;
        }).then(async (newIssue) => {
            const targetTransitions = await targetClient.issues.getTransitions({
                issueIdOrKey: newIssue.key,
            }).then((e) => e.transitions);

            let transition = targetTransitions.filter((e) => e.name === srcDefaultIssueTransitionName)[0];
            const matchedTransition = targetTransitions.filter((e) => e.name === srcIssue.fields.status.name);
            if (matchedTransition.length > 0) {
                transition = matchedTransition[0];
            }
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

async function createNewSubIssues(targetClient, issueList) {
    for (const srcIssue of issueList) {

        await targetClient.issues.createIssue({
            fields: {
                summary: srcIssue.fields.summary,
                description: srcIssue.fields.description,
                project: {
                    id: destProject.id,
                },
                issuetype: {
                    name: "Subtask",
                },
                parent: {
                    key: existingIssues[srcIssue.fields.parent.key].key
                }
            },
        }).then(async (newIssue) => {
            await issueRemoteLinks.createOrUpdateRemoteIssueLink({
                issueIdOrKey: newIssue.key,
                object: {
                    title: srcIssue.key,
                    url: srcIssue.self,
                },
            });
            return newIssue;
        }).then(async (newIssue) => {
            const targetTransitions = await targetClient.issues.getTransitions({
                issueIdOrKey: newIssue.key,
            }).then((e) => e.transitions);

            let transition = targetTransitions.filter((e) => e.name === srcDefaultIssueTransitionName)[0];
            const matchedTransition = targetTransitions.filter((e) => e.name === srcIssue.fields.status.name);
            if (matchedTransition.length > 0) {
                transition = matchedTransition[0];
            }
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
        }).catch((e) => {
            errors.push(e)
            console.log(`New issue creation failed in target system. Source Jira : ${srcIssue.key}  Reason:` + JSON.stringify(e));
        });
    }
}

async function updateExistingIssues(targetClient, issueList) {

    for (const destIssue of issueList) {
        try {
            let isUpdated = false;
            const srcIssue = existingIssuesToSrcIssuesMap[destIssue.id];

            const targetTransitions = await targetClient.issues.getTransitions({
                issueIdOrKey: destIssue.key,
            }).then((e) => e.transitions);
            const transition = targetTransitions.filter((e) => e.name === destIssue.fields.status.name)[0];
            const matchedTransition = targetTransitions.filter((e) => e.name === srcIssue.fields.status.name);

            if (matchedTransition.length > 0 && transition.name !== matchedTransition[0].name) {
                await targetClient.issues.doTransition({
                    issueIdOrKey: destIssue.id,
                    transition: {
                        id: matchedTransition[0].id,
                        to: {
                            name: matchedTransition[0].name,
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
