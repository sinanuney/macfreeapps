// Netlify Function for featured apps API
exports.handler = async (event, context) => {
    // Mock featured apps data
    const featuredApps = [
        {
            name: "DaVinci Resolve Studio",
            category: "Fotoğraf ve Video",
            version: "18.5",
            fileSize: "5.1 GB",
            image: "https://is1-ssl.mzstatic.com/image/thumb/Purple221/v4/a0/e6/09/a0e60971-0d09-de64-ebe7-4c8b113e5bcc/Resolve.png/1200x630bb.png",
            description: "Profesyonel video düzenleme yazılımı",
            downloadUrl: "https://www.blackmagicdesign.com/products/davinciresolve",
            badgeType: "new",
            internalImages: [
                "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/1d/8e/70/1d8e701d-06e3-9ed5-fd5a-926788cb10d9/DaVinciResolve20_AppStore_Cut.png/1286x0w.webp",
                "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/fb/ff/e0/fbffe04c-59f0-9253-3451-85baad667899/DaVinciResolve20_AppStore_Edit.png/1286x0w.webp",
                "https://is1-ssl.mzstatic.com/image/thumb/PurpleSource211/v4/4c/d9/7a/4cd97a6b-1bea-9bca-1633-c6881b038f5b/DaVinciResolve20_AppStore_Fusion.png/1286x0w.webp"
            ]
        },
        {
            name: "Visual Studio Code",
            category: "Geliştirici Araçları",
            version: "1.85",
            fileSize: "200 MB",
            image: "https://code.visualstudio.com/assets/images/code-stable.png",
            description: "Microsoft'un ücretsiz kod editörü",
            downloadUrl: "https://code.visualstudio.com/",
            badgeType: "updated",
            internalImages: [
                "https://code.visualstudio.com/assets/docs/getstarted/tips-and-tricks/hero.png",
                "https://code.visualstudio.com/assets/docs/languages/python/run-python-code-in-terminal.png"
            ]
        },
        {
            name: "Logic Pro",
            category: "Müzik",
            version: "10.7.9",
            fileSize: "6.2 GB",
            image: "https://support.apple.com/library/content/dam/edam/applecare/images/en_US/music/logic-pro-icon.png",
            description: "Apple'ın profesyonel müzik yazılımı",
            downloadUrl: "https://www.apple.com/logic-pro/",
            badgeType: "new"
        }
    ];
    
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        },
        body: JSON.stringify(featuredApps)
    };
};
