import {Command, command, metadata} from 'clime';
import {format, Logger, transports} from "winston";
import axios from "axios";
import {Component} from "../lib/Component";

const winston = require('winston');
require('dotenv').config()

@command({
    description: 'Custom cleanup for Sonatype Nexus Artifacts system',
})
export default class extends Command {
    /**
     * Logging object used in methods
     * @private
     */
    private logger!: Logger

    /**
     * Sets up logging
     * @param logLevel - Log level
     * @protected
     */
    protected setupLogging(logLevel: string): void {
        this.logger = winston.createLogger({
            level: logLevel,
            format: format.combine(
                format.errors({stack: true}),
            ),
            transports: [
                new transports.Console({
                    format: format.combine(
                        format.cli(),
                    )
                })
            ]
        });
    }

    /**
     * Logs the given error message and exits with returncode 1
     * @param {string} msg - The error message to put out.
     */
    public errorAndExit(msg: any) {
        this.logger.error(msg)
        process.exit(1)
    }

    /**
     * Prints usage information
     */
    public usage() {
        console.log(
            'Place a .env file in same directory as main.js or set environment variables with same name to set these variables:\n\
            NEXUS_URL        - Nexus base URL without trailing slash\n\
            NEXUS_USERNAME   - Nexus user\n\
            NEXUS_PASSWORD   - Password for that Nexus User\n\
            REPO_NAME        - Name of the repo to cleanup components for\n\
            KEEP_ITEMS       - Keep this amount of items for given path depth\n\
            PATH_DEPTH       - Path depth to do cleanup for\n\
            EXECUTE_DELETE   - (Optional) If false, only print components to delete, instead of really deleting them (default = false)\n\
            LOG_LEVEL        - (Optional)Log level for logging (default = info)\n'
        )
    }

    /**
     * Retrieves components in order to structure them with given path depth and to then delete them based on given amount of components to keep for each path
     */
    @metadata
    async execute() {
        /**
         * URL of Nexus Repository Manager without trailing slash
         */
        let nexusUrl: string = ''

        /**
         * Username of a user in Nexus Repository Manager with permissions to get and delete components
         */
        let nexusUsername: string = ''

        /**
         * Password of a user in Nexus Repository Manager with permissions to get and delete components
         */
        let nexusPassword: string = ''

        /**
         * Name of the repo to cleanup components for
         */
        let repoName: string = ''

        /**
         * Keep this amount of items for given path depth
         */
        let keepItems: number = 0

        /**
         * Path depth to do cleanup for
         */
        let pathDepth: number = 0

        /**
         * If false, only print components to delete, instead of really deleting them
         */
        let executeDelete: boolean = false

        /**
         * Log level for logging
         */
        let logLevel: string = 'info'

        if (process.env.LOG_LEVEL) {
            logLevel = process.env.LOG_LEVEL
        }
        this.setupLogging(logLevel)

        if (!process.env.NEXUS_URL) {
            this.usage()
            this.errorAndExit('NEXUS_URL not set!')
        } else {
            nexusUrl = process.env.NEXUS_URL
        }
        if (!process.env.NEXUS_USERNAME) {
            this.usage()
            this.errorAndExit('NEXUS_USERNAME not set!')
        } else {
            nexusUsername = process.env.NEXUS_USERNAME
        }
        if (!process.env.NEXUS_PASSWORD) {
            this.usage()
            this.errorAndExit('NEXUS_PASSWORD not set!')
        } else {
            nexusPassword = process.env.NEXUS_PASSWORD
        }
        if (!process.env.REPO_NAME) {
            this.usage()
            this.errorAndExit('REPO_NAME not set!')
        } else {
            repoName = process.env.REPO_NAME
        }
        if (!process.env.KEEP_ITEMS) {
            this.usage()
            this.errorAndExit('KEEP_ITEMS not set!')
        } else {
            if (isNaN(parseInt(process.env.KEEP_ITEMS))) {
                this.errorAndExit('KEEP_ITEMS is not a number!')
            }
            keepItems = parseInt(process.env.KEEP_ITEMS)
        }
        if (!process.env.PATH_DEPTH) {
            this.usage()
            this.errorAndExit('PATH_DEPTH not set!')
        } else {
            if (isNaN(parseInt(process.env.PATH_DEPTH))) {
                this.errorAndExit('PATH_DEPTH is not a number!')
            }
            pathDepth = parseInt(process.env.PATH_DEPTH)
        }
        if (process.env.EXECUTE_DELETE) {
            executeDelete = (process.env.EXECUTE_DELETE === 'true')
        }

        /**
         * Retrieve components from Nexus API. Nexus does paging so all pages need to be requested and then the resulted
         * items are pushed into one output array
         */
        let doPaging = true;
        let continuationToken = '';
        let i = 1;
        const output: any[] = []
        while (doPaging) {
            i += 1;
            if (i >= 30) {
                this.errorAndExit('endless loop detected, more than 30 pages are not realistic!')
            }
            try {
                let requestUrl = ''
                if (continuationToken) {
                    requestUrl = `${nexusUrl}/service/rest/v1/components?repository=${repoName}&continuationToken=${continuationToken}`
                } else {
                    requestUrl = `${nexusUrl}/service/rest/v1/components?repository=${repoName}`
                }
                this.logger.debug(`Calling ${requestUrl}`)
                const response = await axios.get(
                    requestUrl,
                    {
                        auth: {
                            username: nexusUsername,
                            password: nexusPassword
                        }
                    }
                )
                // do not push empty items
                if(Object.keys(response.data.items).length) {
                    output.push(...response.data.items)
                }
                this.logger.debug(`page ${i} and token = +++${response.data.continuationToken}+++`)
                if (response.data.continuationToken != null) {
                    continuationToken = response.data.continuationToken
                } else {
                    doPaging = false
                }
            } catch (error) {
                this.logger.error(error)
            }
        }

        /**
         * "raw data" of the components needs to be parsed. Some information is retrieved from the first asset of the
         * component, because the Nexus API does not provide that specific information on the component
         */
        const components: Array<Component> = []
        const paths: Array<string> = []
        for (let item of output) {
            // skip if first asset has no path
            if(item.assets[0].hasOwnProperty('path')) {
                let trimmedPath: string = item.assets[0].path.split("/").slice(0, pathDepth).join("/")
                components.push(new Component()
                    .withDate(item.assets[0].lastModified)
                    .withId(item.id)
                    .withVersion(item.version)
                    .withPath(trimmedPath)
                )
                if (!paths.includes(trimmedPath)) {
                    paths.push(trimmedPath)
                }
                this.logger.debug(JSON.stringify(item.version))
            }
        }

        /**
         * For each path of the given path depth the components are now filtered from the full list of components from
         * the repo and sorted by newest first. Then skipping (based on keep items parameter) or deletion is performed.
         */
        for (let path of paths) {
            let componentsFilteredByPath = components.filter(component => component.path === path)
            componentsFilteredByPath.sort((a,b) => {
                if (a.timestamp > b.timestamp) {
                    return -1
                }
                if (a.timestamp < b.timestamp) {
                    return 1
                }
                return 0
            })
            let i = 1
            for (let component of componentsFilteredByPath) {
                if (i <= keepItems) {
                    this.logger.info(`Keeping ${component.version} with id ${component.id} at ${component.path} with timestamp ${component.timestamp}`)
                } else {
                    if (executeDelete) {
                        this.logger.info(`Deleting ${component.version} with id ${component.id} at ${component.path} with timestamp ${component.timestamp}`)
                        try {
                            let requestUrl = `${nexusUrl}/service/rest/v1/components/${component.id}`
                            this.logger.debug(`Calling ${requestUrl} with method DELETE`)
                            await axios.delete(
                                requestUrl,
                                {
                                    auth: {
                                        username: nexusUsername,
                                        password: nexusPassword
                                    }
                                }
                            );
                        } catch (error) {
                            this.logger.error(error)
                        }
                    } else {
                        this.logger.info(`Would delete ${component.version} with id ${component.id} at ${component.path} with timestamp ${component.timestamp}`)
                    }
                }
                i += 1
            }
            this.logger.info('################## SPACER ####################')
        }
    }
}