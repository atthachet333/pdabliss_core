@echo off
rem PDA BLISS CORE UAT sandbox (EP42.2) - Windows shortcut for: node uat\uat.mjs <command>
rem Examples:  uat\uat.cmd doctor   uat\uat.cmd start --open   uat\uat.cmd status   uat\uat.cmd stop
node "%~dp0uat.mjs" %*
