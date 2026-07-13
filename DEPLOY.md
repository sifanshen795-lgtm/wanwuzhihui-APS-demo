# 部署说明

本项目已改为静态托管友好的 Hash 路由，构建后可部署到任意静态站点服务。

## 构建

```bash
npm run build
```

构建产物在 `dist/` 目录。

## 局域网 IP 访问

用于让同一网络内的其他电脑、PAD 或手机访问本机 Demo：

```bash
npm run build
npm run serve:ip
```

默认端口为 `4184`，启动后让别人访问：

- PC 端：`http://你的电脑IP:4184`
- APP 端：`http://你的电脑IP:4184/#/app`

例如：

- PC 端：`http://192.168.4.253:4184`
- APP 端：`http://192.168.4.253:4184/#/app`

注意：访问设备需要和本机在同一个局域网内；如果无法访问，检查系统防火墙是否允许 Node.js 接收入站连接。

## 访问地址

部署后：

- PC 端：首页 `https://你的域名/`
- APP 端：`https://你的域名/#/app`

## 可选平台

- Vercel
- Netlify
- Cloudflare Pages
- Nginx / 宝塔 / OSS 静态网站

只需要把 `dist/` 目录作为静态站点根目录即可。
