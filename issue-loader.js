import configUtils from './config-utlis.js';

export default class IssueLoader {
    srcClient = null;
    destClient = null;
    configJson = configUtils.loadConfigJson();

    constructor(srcClient, destClient) {
        this.srcClient = srcClient;
        this.destClient = destClient;
    }

    async fetchIssues() {
        // return this.srcClient.projects.getProject({projectIdOrKey: "CEP"});
        return this.srcClient.projects.getAllProjects();
    }
}