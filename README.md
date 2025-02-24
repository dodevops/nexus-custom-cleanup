# Sonatype Nexus Repository Manager custom cleanup

## Introduction

Sonatype Nexus Repository Manager natively only offers cleanup based on the age of a component or the last download date
of a component.

We have the requirement to do a cleanup based on the (maven) path depth and to keep the n youngest components. This tool
implements this requirement.

## Usage

The docker based used is recommended, but if required it can also be used as a node application directly:

### Configuration

These are the variables to configure the application with:

| Variable             | description                                                                 | Required | Default value |
|----------------------|-----------------------------------------------------------------------------|----------|---------------|
| NEXUS_URL            | Nexus base URL without trailing slash                                       | yes      |               |
| NEXUS_USERNAME       | Nexus user (needs permissions to read and delete components for given repo) | yes      |               |
| NEXUS_PASSWORD       | Password for that Nexus User                                                | yes      |               |
| REPO_NAME            | Name of the repo to cleanup components for                                  | yes      |               |
| KEEP_ITEMS           | Keep this amount of items for given path depth                              | yes      |               |
| PATH_DEPTH           | Path depth to do cleanup for                                                | yes      |               |
| EXECUTE_DELETE       | If false, only print components to delete, instead of really deleting them  | no       | "false"       |
| LOG_LEVEL            | Log level for logging                                                       | no       | "info"        |
| KEEP_COMPONENT_PATHS | comma separated list of component path regexps to keep instead of deleting  | no       | []            |

### Docker

#### Build

You can build the docker image by yourself with typical docker build commands:

    docker build -t nexus-custom-cleanup:latest .

but it is recommended to use the released docker images from the GitHub registry in this repo.

#### Run

The container started using this image will terminate, after the cleanup is completed. It does not run as daemon and
does not provide any cron- or interval-like scheduling. Please implement a reoccuring run by yourself, if required.

The container needs to be run with the configuration (see above) set as environment variables.

An example execution could be:

    docker run -it --rm -e NEXUS_URL="https://nexus.copany.com" -e NEXUS_USERNAME="nexususer" -e NEXUS_PASSWORD="XXXXXXXXX" -e REPO_NAME="application-snapshots-maven-hosted" -e KEEP_ITEMS=4 -e PATH_DEPTH=7 -e EXECUTE_DELETE="false" nexus-custom-cleanup:latest

### Native node application

For this it is required that NodeJS is installed on your system already.

Instead of using docker, the solution can be used as a node application directly, be sure to build it first before using
it:

    npm install
    npm run build

You can either set the needed configuration parameters (see above) via environment variables or via an .env file. If you
use a .env file, place it in same directory like this README.md

Example call to start the application (it will terminate once the cleanup is completed):

    npm run start

# Development

For development you need to install typescript and before executing the generated javascript you need to generate it 
before your first run and after every change with

    npm run build

in the same directory like this README.md. Typescript code can be found in the src/ directory. Code in dist/ will be overwritten by the code
generation