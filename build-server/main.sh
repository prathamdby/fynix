#!/bin/bash

set -e # Exit on error

git clone "$GIT_REPOSITORY_URL" /home/app/output

exec node script.js
