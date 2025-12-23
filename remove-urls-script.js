/**
 * Google URL Removal Script
 *
 * 使用方法:
 * node remove-urls-script.js google-removal-batch-1.json  (第1天: 提交前200个URL)
 * node remove-urls-script.js google-removal-batch-2.json  (第2天: 提交URL 201-400)
 * node remove-urls-script.js google-removal-batch-3.json  (第3天: 提交URL 401-449)
 */

const fs = require('fs');
const { google } = require('googleapis');

async function submitUrlToIndex(url, type = 'URL_DELETED') {
  try {
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (!clientEmail || !privateKey) {
      throw new Error('缺少 GOOGLE_CLIENT_EMAIL 或 GOOGLE_PRIVATE_KEY 环境变量');
    }

    // 处理私钥格式 (替换 \\n 为实际换行符)
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: formattedPrivateKey,
      },
      scopes: ['https://www.googleapis.com/auth/indexing'],
    });

    const indexing = google.indexing({ version: 'v3', auth });

    const response = await indexing.urlNotifications.publish({
      requestBody: {
        url: url,
        type: type,
      },
    });

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

async function main() {
  // 读取批次文件
  const batchFile = process.argv[2] || 'google-removal-batch-1.json';

  if (!fs.existsSync(batchFile)) {
    console.error(`❌ 文件不存在: ${batchFile}`);
    process.exit(1);
  }

  const batchData = JSON.parse(fs.readFileSync(batchFile, 'utf-8'));
  const urls = batchData.urls;

  console.log(`\n📤 开始提交 ${urls.length} 个 URL 到 Google Indexing API...`);
  console.log(`📁 批次文件: ${batchFile}\n`);

  const results = [];
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const result = await submitUrlToIndex(url, 'URL_DELETED');

    results.push({ url, success: result.success, error: result.error });

    if (result.success) {
      successful++;
      console.log(`✅ [${i + 1}/${urls.length}] 成功: ${url}`);
    } else {
      failed++;
      console.error(`❌ [${i + 1}/${urls.length}] 失败: ${url}`);
      console.error(`   错误: ${result.error}`);
    }

    // 速率限制: 每次请求间隔 200ms
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n\n========== 提交完成 ==========`);
  console.log(`✅ 成功: ${successful}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📊 总计: ${urls.length}`);

  // 保存结果到文件
  const resultFile = batchFile.replace('.json', '-result.json');
  fs.writeFileSync(resultFile, JSON.stringify({ successful, failed, total: urls.length, results }, null, 2));
  console.log(`\n💾 结果已保存到: ${resultFile}`);
}

main().catch(error => {
  console.error('❌ 脚本执行错误:', error);
  process.exit(1);
});
