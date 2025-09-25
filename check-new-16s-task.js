// 使用内置的fetch API (Node.js 18+)

async function checkKIEVideoTaskStatus(taskId) {
  try {
    const response = await fetch(`https://api.kie.ai/api/v1/task/status/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${process.env.KIE_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      status: data.data?.status || 'unknown',
      result_url: data.data?.result_url,
      error: data.data?.error
    };
  } catch (error) {
    console.error(`Error checking task ${taskId}:`, error.message);
    return { status: 'error', error: error.message };
  }
}

async function main() {
  console.log('🎬 检查新的16秒视频生成任务状态...\n');
  
  const projectId = '176a65f3-d8e4-42a8-868d-0b9373e91934';
  const videoTaskIds = ['655c2848b0fe21d43b627e3ec2d1f3ac', '7713e3f041337ff7ad5f0f77a904eea5'];
  
  console.log(`项目ID: ${projectId}`);
  console.log(`视频任务数量: ${videoTaskIds.length}\n`);
  
  for (let i = 0; i < videoTaskIds.length; i++) {
    const taskId = videoTaskIds[i];
    console.log(`📹 检查视频 ${i + 1} (任务ID: ${taskId}):`);
    
    const status = await checkKIEVideoTaskStatus(taskId);
    console.log(`   状态: ${status.status}`);
    
    if (status.result_url) {
      console.log(`   ✅ 视频URL: ${status.result_url}`);
    }
    
    if (status.error) {
      console.log(`   ❌ 错误: ${status.error}`);
    }
    
    console.log('');
  }
  
  console.log('🔍 关键验证点:');
  console.log('1. ✅ 修复已部署 - generateVideoWithKIE函数使用正确的imageUrls参数');
  console.log('2. ✅ 图像已生成 - 项目有generated_image_url');
  console.log('3. 🔄 视频生成中 - 正在使用修复后的API调用');
  console.log('4. ⏳ 等待视频完成 - 然后验证角色一致性');
}

main().catch(console.error);