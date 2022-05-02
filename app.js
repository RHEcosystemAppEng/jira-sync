import _ from 'lodash'
import config from './config-utlis.js'
import IssueLoader from './issue-loader.js';
import {Version2Client, Version2} from 'jira.js';

const srcDefaultIssueTransitionName = "To Do";
let srcIssueComments;
let destIssueComments;
let issueRemoteLinks;
let destProject;
let existingIssues = {};
let newlyCreatedIssueList = [];
let updatedIssueList = [];


function _getIssueType(srcIssueList, destIssueTypeName) {
    const matchingVal = srcIssueList.find(e => e === destIssueTypeName)
    if (_.isEmpty(matchingVal) || _.isUndefined(matchingVal))
        return "Task"

    return matchingVal
}

function _getRemoteLinkIssueKey(srcIssueId) {
    return issueRemoteLinks.getRemoteIssueLinks({
        issueIdOrKey: srcIssueId
    }).then(listData => {
        return listData.filter(e => e.object.url && e.object.url.includes("https://"))
    })
}

async function loadIssues(jiraClient, jql) {
    const issueList = [];
    let offSet = 0;
    let total = 0;

    do {
        let searchResults = await jiraClient
            .issueSearch.searchForIssuesUsingJqlPost(
                {
                    startAt: offSet,
                    jql: jql
                }
            ).catch(e => {
                console.log(`Cannot fetch issues from JIRA(${jiraClient.config.host}). Reason : ` + JSON.stringify(e))
            });

        issueList.push(...searchResults.issues)

        offSet += searchResults.maxResults
        total = searchResults.total

    } while (offSet < total);

    return issueList
}

async function loadIssueComments(issueCommentsObj, issueKey) {
    const commentList = [];
    let offSet = 0;
    let total = 0;

    do {
        let searchResults = await issueCommentsObj.getComments(
            {
                startAt: offSet,
                issueIdOrKey: issueKey
            }
        ).catch(e => {
            console.log(`Cannot fetch issue comments. Reason : ` + JSON.stringify(e))
        });

        commentList.push(...searchResults.comments)

        offSet += searchResults.maxResults
        total = searchResults.total

    } while (offSet < total);

    return commentList
}

async function main() {
    console.log("Jira-Sync started!")
    const sourceClient = await new Version2Client({
        newErrorHandling: true,
        host: `${process.env.SOURCE_JIRA_URL}`,
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

    issueRemoteLinks = new Version2.IssueRemoteLinks(targetClient)
    srcIssueComments = new Version2.IssueComments(sourceClient)
    destIssueComments = new Version2.IssueComments(targetClient)

    try {
        destProject = await targetClient.projects.getProject({projectIdOrKey: "CEP"})

        let srcIssueList = await loadIssues(sourceClient, "project = \"Ecosystem Application Engineering\" AND component = Finastra")
        let destIssueList = await loadIssues(targetClient, "project = cepheus")


        const srcIssueTypes = [];
        await targetClient.issueTypes.getIssueAllTypes()
            .then(data => {
                data.forEach(e => {
                    srcIssueTypes.push(e.name)
                })
            })

        for (const destIssue of destIssueList) {
            const srcIssueKey = await _getRemoteLinkIssueKey(destIssue.id)

            if (!_.isEmpty(srcIssueKey)) {
                existingIssues[srcIssueKey[0].object.title] = destIssue
            }
        }
        console.log("Synchronizing the jira issues...")

        for (const srcIssue of srcIssueList) {

            if (!existingIssues[srcIssue.key]) {
                if (srcIssue.key === "APPENG-638") {


                    await targetClient.issues.createIssue({
                        fields: {
                            summary: srcIssue.fields.summary,
                            description: srcIssue.fields.description,
                            project: {
                                id: destProject.id
                            },
                            issuetype: {
                                name: _getIssueType(srcIssueTypes, srcIssue.fields.issuetype.name)
                            }
                        }
                    }).then(async newIssue => {
                        const targetTransitions = await targetClient.issues.getTransitions({
                            issueIdOrKey: newIssue.key
                        }).then(e => {
                            return e['transitions']
                        })

                        let transition = targetTransitions.filter(e => e.name === srcDefaultIssueTransitionName)[0];
                        const matchedTransition = targetTransitions.filter(e => e.name === srcIssue.fields.status.name)
                        if (matchedTransition.length > 0) {
                            transition = matchedTransition[0]
                        }
                        await targetClient.issues.doTransition({
                            issueIdOrKey: newIssue.id,
                            transition: {
                                id: transition.id,
                                to: {
                                    name: transition.name
                                }
                            }
                        })
                        return newIssue
                    }).then(async newIssue => {

                        const srcComments = await loadIssueComments(srcIssueComments, srcIssue.key)
                        if (!_.isEmpty(srcComments)) {
                            console.log(JSON.stringify(srcComments))
                        }
                        for (const comment of srcComments) {
                            await destIssueComments.addComment({
                                issueIdOrKey: newIssue.key,
                                body: comment.body
                            })
                        }
                        return newIssue
                    }).then(async newIssue => {
                        await issueRemoteLinks.createOrUpdateRemoteIssueLink({
                            issueIdOrKey: newIssue.key,
                            object: {
                                title: srcIssue.key,
                                url: srcIssue.self
                            }
                        })
                        return newIssue
                    }).then(newIssue => {
                        newlyCreatedIssueList.push(newIssue)
                    }).catch(e => {
                        console.log(e)
                    })
                }
            } else {
                // compare fields for any updates
                const destIssue = existingIssues[srcIssue.key]
                let isUpdated = false;

                const targetTransitions = await targetClient.issues.getTransitions({
                    issueIdOrKey: destIssue.key
                }).then(e => {
                    return e['transitions']
                })
                let transition = targetTransitions.filter(e => e.name === destIssue.fields.status.name)[0];
                const matchedTransition = targetTransitions.filter(e => e.name === srcIssue.fields.status.name)

                if(matchedTransition.length > 0 && transition.name !== matchedTransition[0].name) {
                    await targetClient.issues.doTransition({
                        issueIdOrKey: destIssue.id,
                        transition: {
                            id: matchedTransition[0].id,
                            to: {
                                name: matchedTransition[0].name
                            }
                        }
                    })
                    isUpdated = true;
                }

                // sync comments (only src ---> dest. Not the other way!)
                // NOTE: Updated comments will be added as a new comment in destination jira system
                const srcCommentMap = {};
                const destCommentMap = {};
                await loadIssueComments(destIssueComments, destIssue.key).then(commentList => {
                    commentList.forEach(e => {
                        destCommentMap[e.body] = e;
                    })
                })

                await loadIssueComments(srcIssueComments, srcIssue.key).then(commentList => {
                    commentList.forEach(e => {
                        srcCommentMap[e.body] = e;
                    })
                }).then(async srcComments => {
                    for (const srcComment in srcComments) {
                        if (!destCommentMap[srcComment.body]) {
                            await destIssueComments.addComment({
                                issueIdOrKey: destIssue.key,
                                body: srcComment.body
                            })
                            isUpdated = true;
                        }
                    }
                })

                if (isUpdated) {
                    updatedIssueList.push(destIssue)
                }
            }
        }

        console.log(`Jira issue synchronization completed. Created: ${newlyCreatedIssueList.length} Updated: ${updatedIssueList.length}`)
    } catch (e) {
        console.log(e)
    }
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