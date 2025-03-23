#!/bin/bash

set -e # Exit on error

git clone --depth=1 "$GIT_REPOSITORY_URL" /home/app/output

exec node script.js
