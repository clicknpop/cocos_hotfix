chcp 65001
@echo off
set /p version="input project version(1.0.0):"
@REM 遠端熱更資源所在url, 需修改成正確路徑
set remoteUrl=https://clicknpop.github.io/test/
@REM 本地需要加入熱更的資源路徑
set assetsPath=.\build\android\assets\
@REM 新manifest產出的位置
set exportPath=.\export\
call node version_generator.js -v %version% -u %remoteUrl% -s %assetsPath% -d %exportPath%