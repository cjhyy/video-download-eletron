@echo off
echo 安装依赖...
npm install

echo.
echo 下载二进制文件...
npm run download-binaries

echo.
echo 安装完成！
echo.
echo 使用方法:
echo   npm start      - 启动应用
echo   npm run dev    - 开发模式
echo   npm run build  - 构建应用
echo.
pause
