#! /bin/bash

set -eu

platform="${1:-android}"
app="${2:-paid}"
mode="${3:-d}"
webpackmode="development"
cordovamode=""

if [ -z "$platform" ]
then
platform="android"
fi

if [ -z "$mode" ]
then
mode="d"
fi

if [ -z "$app" ]
then
app="paid"
fi

if [ "$mode" = "p" ]
then
webpackmode="production"
cordovamode="--release"
fi

node ./utils/config.js "$mode" "$app"
rspack --mode "$webpackmode"
cordova run "$platform" $cordovamode -- --packageType=apk
