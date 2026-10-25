@echo off
chcp 65001 >nul
title XGAMe-CCG Godot 版
echo 正在启动游戏（关闭窗口即退出游戏）...
"C:\Users\Administrator\Downloads\Godot_v4.7.2-stable_win64.exe\Godot_v4.7.2-stable_win64.exe" --path "%~dp0" >nul 2>&1
